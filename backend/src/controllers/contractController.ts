import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { renderTemplate, sendFromTemplate } from '../services/notificationService';

// POST / - 계약 생성 (보호자가 간병인 선택 후)
export const createContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const { careRequestId, caregiverId } = req.body;

    if (!careRequestId || !caregiverId) {
      throw new AppError('간병 요청 ID와 간병인 ID가 필요합니다.', 400);
    }

    // 간병 요청 확인
    const careRequest = await prisma.careRequest.findFirst({
      where: {
        id: careRequestId,
        guardianId: guardian.id,
        status: { in: ['OPEN', 'MATCHING'] },
      },
    });

    if (!careRequest) {
      throw new AppError('유효한 간병 요청을 찾을 수 없습니다.', 404);
    }

    // 간병인 확인
    const caregiver = await prisma.caregiver.findFirst({
      where: {
        id: caregiverId,
        status: 'APPROVED',
        workStatus: { in: ['AVAILABLE', 'IMMEDIATE'] },
      },
      include: { user: { select: { name: true } } },
    });

    if (!caregiver) {
      throw new AppError('선택한 간병인이 현재 가용 상태가 아닙니다.', 400);
    }

    // 플랫폼 수수료 설정 조회
    const platformConfig = await prisma.platformConfig.findUnique({
      where: { id: 'default' },
    });

    const feePercent = careRequest.careType === 'INDIVIDUAL'
      ? (platformConfig?.individualFeePercent ?? 10)
      : (platformConfig?.familyFeePercent ?? 15);
    const feeFixed = careRequest.careType === 'INDIVIDUAL'
      ? (platformConfig?.individualFeeFixed ?? 0)
      : (platformConfig?.familyFeeFixed ?? 0);

    const taxRate = platformConfig?.taxRate ?? 3.3;

    // 금액 계산
    const dailyRate = careRequest.dailyRate || 150000;
    const startDate = careRequest.startDate;
    const endDate = careRequest.endDate || new Date(startDate.getTime() + (careRequest.durationDays || 7) * 86400000);
    const durationDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
    const totalAmount = dailyRate * durationDays;

    if (totalAmount <= 0) {
      throw new AppError('계약 금액은 0보다 커야 합니다.', 400);
    }

    // 트랜잭션으로 계약 생성 + 상태 업데이트 (race condition 방지)
    const contract = await prisma.$transaction(async (tx) => {
      // 트랜잭션 내에서 중복 계약 확인 (취소된 계약은 허용 — 재매칭 가능)
      const existingContract = await tx.contract.findFirst({
        where: { careRequestId, status: { not: 'CANCELLED' } },
      });
      if (existingContract) {
        throw new AppError('이미 계약이 생성된 간병 요청입니다.', 400);
      }

      // 간병인 근무 상태 재확인 (race condition 방지)
      const freshCaregiver = await tx.caregiver.findUnique({ where: { id: caregiverId } });
      if (freshCaregiver?.workStatus === 'WORKING') {
        throw new AppError('간병인이 이미 다른 간병을 진행 중입니다.', 400);
      }

      // 계약 생성
      const newContract = await tx.contract.create({
        data: {
          careRequestId,
          guardianId: guardian.id,
          caregiverId,
          startDate,
          endDate,
          dailyRate,
          totalAmount,
          platformFee: feePercent,
          platformFeeFixed: feeFixed,
          taxRate,
          medicalActClause: careRequest.medicalActAgreed,
        },
        include: {
          careRequest: {
            include: { patient: true },
          },
          caregiver: {
            include: {
              user: { select: { name: true, phone: true } },
            },
          },
        },
      });

      // 간병 요청 상태 업데이트
      await tx.careRequest.update({
        where: { id: careRequestId },
        data: { status: 'MATCHED' },
      });

      // 간병인 근무 상태 업데이트
      await tx.caregiver.update({
        where: { id: caregiverId },
        data: {
          workStatus: 'WORKING',
          totalMatches: { increment: 1 },
        },
      });

      // 다른 지원 거절 처리
      await tx.careApplication.updateMany({
        where: {
          careRequestId,
          caregiverId: { not: caregiverId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });

      // 선택된 간병인 지원 수락
      await tx.careApplication.updateMany({
        where: { careRequestId, caregiverId },
        data: { status: 'ACCEPTED' },
      });

      // Cancel all other pending applications for this caregiver
      await tx.careApplication.updateMany({
        where: {
          caregiverId,
          status: 'PENDING',
          careRequestId: { not: careRequestId },
        },
        data: { status: 'CANCELLED' },
      });

      // 알림 발송 - 간병인 + 보호자 (템플릿)
      const startDateStr = startDate.toLocaleDateString('ko-KR');
      const cgTpl = await renderTemplate('CONTRACT_SIGNED_CAREGIVER', {
        patientName: newContract.careRequest.patient.name,
        startDate: startDateStr,
      });
      const gTpl = await renderTemplate('CONTRACT_SIGNED_GUARDIAN', {
        caregiverName: caregiver.user.name,
        startDate: startDateStr,
      });
      const notifData: any[] = [];
      if (cgTpl && cgTpl.enabled) {
        notifData.push({ userId: caregiver.userId, type: cgTpl.type, title: cgTpl.title, body: cgTpl.body, data: { contractId: newContract.id } as any });
      }
      if (gTpl && gTpl.enabled) {
        notifData.push({ userId: guardian.userId, type: gTpl.type, title: gTpl.title, body: gTpl.body, data: { contractId: newContract.id } as any });
      }
      if (notifData.length > 0) {
        await tx.notification.createMany({ data: notifData });
      }

      return newContract;
    });

    res.status(201).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};

// GET /:id - 계약 상세
export const getContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        careRequest: {
          include: {
            patient: true,
          },
        },
        guardian: {
          include: {
            user: {
              select: { name: true, phone: true, email: true },
            },
          },
        },
        caregiver: {
          include: {
            user: {
              select: { name: true, phone: true, profileImage: true },
            },
            certificates: {
              where: { verified: true },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        careRecords: {
          orderBy: { date: 'desc' },
          take: 7,
        },
        extensions: {
          orderBy: { createdAt: 'desc' },
        },
        additionalFees: true,
      },
    });

    if (!contract) {
      throw new AppError('계약을 찾을 수 없습니다.', 404);
    }

    // 접근 권한 확인
    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || contract.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (req.user!.role === 'CAREGIVER') {
      const caregiver = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });
      if (!caregiver || contract.caregiverId !== caregiver.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    }

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /:id/cancel - 계약 취소 (일할 계산, 보호자/간병인/관리자)
export const cancelContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      throw new AppError('취소 사유를 입력해주세요.', 400);
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        caregiver: true,
        guardian: true,
        careRequest: true,
      },
    });

    if (!contract) {
      throw new AppError('계약을 찾을 수 없습니다.', 404);
    }

    if (contract.status !== 'ACTIVE') {
      throw new AppError('활성 상태의 계약만 취소할 수 있습니다.', 400);
    }

    // 접근 권한 확인 (보호자, 간병인, 관리자 모두 취소 가능)
    const isCaregiverCancel = req.user!.role === 'CAREGIVER';
    const isGuardianCancel = req.user!.role === 'GUARDIAN';

    if (isGuardianCancel) {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || contract.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (isCaregiverCancel) {
      const caregiver = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });
      if (!caregiver || contract.caregiverId !== caregiver.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (req.user!.role !== 'ADMIN') {
      throw new AppError('접근 권한이 없습니다.', 403);
    }

    // 일할 계산
    const now = new Date();
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
    const usedDays = Math.min(totalDays, Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / 86400000)));
    const remainingDays = Math.max(0, totalDays - usedDays);

    // 사용한 일수에 대한 금액
    const usedAmount = contract.dailyRate * usedDays;
    // 환불 금액
    const refundAmount = contract.dailyRate * remainingDays;

    // 간병인 정산 금액 계산 (% 수수료 + 고정 수수료)
    const platformFeeAmount = Math.round(usedAmount * (contract.platformFee / 100)) + (contract.platformFeeFixed || 0);
    const taxAmount = Math.round(usedAmount * (contract.taxRate / 100));
    const netEarning = usedAmount - platformFeeAmount - taxAmount;

    let penaltyWarning: string | null = null;

    await prisma.$transaction(async (tx) => {
      // 계약 취소
      const cancelledByLabel = isCaregiverCancel ? '간병인' : '보호자';
      await tx.contract.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledBy: req.user!.id,
          cancellationReason: reason || `${cancelledByLabel} 요청에 의한 취소`,
          cancellationPolicy: `총 ${totalDays}일 중 ${usedDays}일 사용. 사용금액: ${usedAmount}원, 환불금액: ${refundAmount}원`,
        },
      });

      // 간병 요청 상태 업데이트
      await tx.careRequest.update({
        where: { id: contract.careRequestId },
        data: { status: 'CANCELLED' },
      });

      // 해당 careRequest의 모든 CareApplication 상태 CANCELLED로 동기화
      // (간병인이 "수락됨" 상태로 계속 보이던 문제 해결)
      await tx.careApplication.updateMany({
        where: { careRequestId: contract.careRequestId, status: { in: ['PENDING', 'ACCEPTED'] } },
        data: { status: 'CANCELLED' },
      });

      // 해당 계약 관련 분쟁 자동 처리 (취소로 인한 분쟁 해결)
      await tx.dispute.updateMany({
        where: { contractId: id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'RESOLVED', resolution: '계약 취소로 처리됨', handledAt: new Date() },
      });

      // 간병인 근무 상태 변경
      await tx.caregiver.update({
        where: { id: contract.caregiverId },
        data: {
          workStatus: 'AVAILABLE',
          ...(isCaregiverCancel
            ? {
                cancellationRate: {
                  increment: 1 / Math.max(contract.caregiver.totalMatches, 1),
                },
              }
            : {}),
        },
      });

      // 간병인이 취소한 경우: 페널티 부과
      if (isCaregiverCancel) {
        await tx.penalty.create({
          data: {
            caregiverId: contract.caregiverId,
            type: 'CANCELLATION',
            reason: reason || '간병인에 의한 계약 취소',
            isAutomatic: true,
          },
        });

        // 패널티 횟수 증가
        await tx.caregiver.update({
          where: { id: contract.caregiverId },
          data: {
            penaltyCount: { increment: 1 },
          },
        });

        const updatedCaregiver = await tx.caregiver.findUnique({
          where: { id: contract.caregiverId },
        });

        // 3회 이상 취소 시 활동 정지
        if (updatedCaregiver && updatedCaregiver.penaltyCount >= 3) {
          await tx.caregiver.update({
            where: { id: contract.caregiverId },
            data: { status: 'SUSPENDED' },
          });
          penaltyWarning = '취소 3회 이상으로 활동이 정지되었습니다.';
        }

        // 알림은 트랜잭션 밖에서 sendFromTemplate 호출 (푸시까지 발송)
      }

      // ── 부분 정산: 기존 미정산 Earning 재조정 (DIRECT 결제는 생성 시 full amount로 기록됨)
      const existingEarnings = await tx.earning.findMany({
        where: { contractId: contract.id, isPaid: false },
        orderBy: { createdAt: 'asc' },
      });
      if (existingEarnings.length > 0) {
        if (usedDays > 0) {
          // 첫 Earning을 usedAmount로 재조정, 나머지는 정리
          await tx.earning.update({
            where: { id: existingEarnings[0].id },
            data: {
              amount: usedAmount,
              platformFee: platformFeeAmount,
              taxAmount,
              netAmount: netEarning,
            },
          });
          if (existingEarnings.length > 1) {
            await tx.earning.deleteMany({
              where: {
                contractId: contract.id,
                isPaid: false,
                id: { notIn: [existingEarnings[0].id] },
              },
            });
          }
        } else {
          // 사용일 0 → 미정산 Earning 전부 제거
          await tx.earning.deleteMany({
            where: { contractId: contract.id, isPaid: false },
          });
        }
      } else if (usedDays > 0) {
        await tx.earning.create({
          data: {
            caregiverId: contract.caregiverId,
            contractId: contract.id,
            amount: usedAmount,
            platformFee: platformFeeAmount,
            taxAmount,
            netAmount: netEarning,
          },
        });
      }

      // ── 자동 환불 규칙: Payment 상태를 정확히 반영 (DIRECT 포함 모든 방법)
      const originalPayment = await tx.payment.findFirst({
        where: {
          contractId: contract.id,
          status: { in: ['COMPLETED', 'ESCROW'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (originalPayment) {
        let newStatus: 'COMPLETED' | 'PARTIAL_REFUND' | 'REFUNDED' = originalPayment.status as any;
        if (refundAmount <= 0) {
          // 사용일수로 전액 소진 → 상태 유지 (COMPLETED)
          newStatus = originalPayment.status === 'ESCROW' ? 'COMPLETED' : (originalPayment.status as any);
        } else if (refundAmount >= originalPayment.totalAmount) {
          newStatus = 'REFUNDED';
        } else {
          newStatus = 'PARTIAL_REFUND';
        }
        await tx.payment.update({
          where: { id: originalPayment.id },
          data: {
            status: newStatus,
            ...(refundAmount > 0 && {
              refundedAt: now,
              refundAmount,
              refundReason: reason || '계약 취소에 의한 일할 환불',
            }),
          },
        });
      }
    });

    // 트랜잭션 완료 후 템플릿 기반 푸시 발송
    if (isCaregiverCancel) {
      await sendFromTemplate({
        userId: contract.guardian.userId,
        key: 'CONTRACT_CANCELLED_BY_CAREGIVER',
        vars: { reason: reason || '' },
        fallbackTitle: '간병 계약이 취소되었습니다',
        fallbackBody: `간병인이 계약을 취소했습니다. 사유: ${reason}`,
        fallbackType: 'CONTRACT',
        data: { contractId: id },
      }).catch(() => {});
    }
    if (isGuardianCancel || req.user!.role === 'ADMIN') {
      await sendFromTemplate({
        userId: contract.caregiver.userId,
        key: 'CONTRACT_CANCELLED_BY_GUARDIAN',
        vars: {
          usedDays: String(usedDays),
          netEarning: netEarning.toLocaleString(),
        },
        fallbackTitle: '간병 계약이 취소되었습니다',
        fallbackBody: `보호자가 계약을 취소했습니다. 사용 ${usedDays}일 기준 ${netEarning.toLocaleString()}원 정산됩니다.`,
        fallbackType: 'CONTRACT',
        data: { contractId: id },
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        totalDays,
        usedDays,
        remainingDays,
        usedAmount,
        refundAmount,
        netEarning,
        cancelledBy: isCaregiverCancel ? 'CAREGIVER' : 'GUARDIAN',
        penaltyWarning,
      },
      message: isCaregiverCancel
        ? `계약이 취소되었습니다. 패널티가 부과되었습니다.`
        : `계약이 취소되었습니다. ${usedDays}일 사용, ${refundAmount.toLocaleString()}원 환불 예정`,
    });
  } catch (error) {
    next(error);
  }
};

// POST /:id/extend - 연장 요청
export const extendContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { additionalDays, isNewCaregiver } = req.body;

    if (!additionalDays || additionalDays <= 0) {
      throw new AppError('연장 일수를 입력해주세요.', 400);
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        caregiver: {
          include: { user: { select: { name: true } } },
        },
        careRequest: {
          include: { patient: true },
        },
      },
    });

    if (!contract) {
      throw new AppError('계약을 찾을 수 없습니다.', 404);
    }

    if (contract.status !== 'ACTIVE') {
      throw new AppError('활성 상태의 계약만 연장할 수 있습니다.', 400);
    }

    // 보호자 권한 확인
    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || contract.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    }

    const currentEndDate = new Date(contract.endDate);
    const newEndDate = new Date(currentEndDate.getTime() + additionalDays * 86400000);
    const additionalAmount = contract.dailyRate * additionalDays;

    const extension = await prisma.$transaction(async (tx) => {
      // 연장 기록 생성
      const ext = await tx.contractExtension.create({
        data: {
          contractId: id,
          newEndDate,
          additionalDays: parseInt(additionalDays),
          additionalAmount,
          isNewCaregiver: isNewCaregiver ?? false,
        },
      });

      // 계약 종료일 업데이트
      await tx.contract.update({
        where: { id },
        data: {
          endDate: newEndDate,
          totalAmount: { increment: additionalAmount },
          status: 'EXTENDED',
        },
      });

      // 간병 요청 종료일도 업데이트
      await tx.careRequest.update({
        where: { id: contract.careRequestId },
        data: { endDate: newEndDate },
      });

      return ext;
    });

    // 간병인에게 연장 요청 푸시 (트랜잭션 밖)
    await sendFromTemplate({
      userId: contract.caregiver.userId,
      key: 'EXTENSION_REQUEST',
      vars: {
        patientName: contract.careRequest.patient.name,
        additionalDays: String(additionalDays),
        newEndDate: newEndDate.toLocaleDateString('ko-KR'),
      },
      fallbackTitle: '계약 연장 요청',
      fallbackBody: `${contract.careRequest.patient.name} 환자의 간병이 ${additionalDays}일 연장되었습니다. 새 종료일: ${newEndDate.toLocaleDateString('ko-KR')}`,
      fallbackType: 'EXTENSION',
      data: { contractId: id, extensionId: extension.id },
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        extension,
        newEndDate,
        additionalAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /:id/corporate-name - 간병일지 PDF용 법인명 업데이트 (간병인 본인)
export const updateCorporateName = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { corporateName } = req.body;

    const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
    if (!caregiver) throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);

    const contract = await prisma.contract.findFirst({
      where: { id, caregiverId: caregiver.id },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);

    const updated = await prisma.contract.update({
      where: { id },
      data: { corporateName: corporateName || null },
    });

    res.json({ success: true, data: { id: updated.id, corporateName: updated.corporateName } });
  } catch (error) {
    next(error);
  }
};

// GET /:id/pdf - 계약서 PDF 생성
export const generateContractPdf = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const { id } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        careRequest: { include: { patient: true } },
        caregiver: { include: { user: { select: { name: true, phone: true } } } },
        guardian: { include: { user: { select: { name: true, phone: true, email: true } } } },
      },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);

    const userId = req.user!.id;
    const role = req.user!.role;
    const isRelated =
      role === 'ADMIN' ||
      contract.guardian.userId === userId ||
      contract.caregiver.userId === userId;
    if (!isRelated) throw new AppError('조회 권한이 없습니다.', 403);

    const FONT_REGULAR = '/usr/share/fonts/truetype/nanum/NanumGothic.ttf';
    const FONT_BOLD = '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf';

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract-${id.slice(0, 8)}.pdf"`);
    doc.pipe(res);

    if (fs.existsSync(FONT_REGULAR)) doc.registerFont('Kor', FONT_REGULAR);
    if (fs.existsSync(FONT_BOLD)) doc.registerFont('KorBold', FONT_BOLD);

    const PAGE_W = 595.28;
    const MARGIN = 50;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const COLOR_PRIMARY = '#1E3A5F';
    const COLOR_SUB = '#4A5568';
    const COLOR_BORDER = '#CBD5E0';
    const COLOR_HEADER_BG = '#EDF2F7';

    // 헤더
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY).text('CAREMATCH', MARGIN, 50);
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB).text('케어매치 주식회사', MARGIN, 64);
    const docId = `CT-${id.slice(0, 8).toUpperCase()}`;
    doc.fontSize(8).fillColor(COLOR_SUB)
      .text(`계약번호  ${docId}`, MARGIN, 50, { width: CONTENT_W, align: 'right' });
    doc.fontSize(8)
      .text(`발행일  ${new Date().toISOString().slice(0, 10)}`, MARGIN, 64, { width: CONTENT_W, align: 'right' });

    // 타이틀
    doc.font('KorBold').fontSize(22).fillColor(COLOR_PRIMARY)
      .text('간 병 서 비 스 계 약 서', MARGIN, 100, { width: CONTENT_W, align: 'center', characterSpacing: 2 });
    doc.lineWidth(1.5).strokeColor(COLOR_PRIMARY).moveTo(MARGIN, 140).lineTo(PAGE_W - MARGIN, 140).stroke();

    let y = 160;

    // 취소된 계약이면 효력 없음 안내 배너
    if (contract.status === 'CANCELLED') {
      const bannerH = 40;
      doc.rect(MARGIN, y, CONTENT_W, bannerH).fillAndStroke('#FEE2E2', '#DC2626');
      doc.font('KorBold').fontSize(13).fillColor('#B91C1C')
        .text('※ 본 계약은 취소되어 효력이 없습니다', MARGIN, y + 6, { width: CONTENT_W, align: 'center' });
      const cancelDate = contract.cancelledAt
        ? new Date(contract.cancelledAt).toLocaleDateString('ko-KR')
        : '-';
      doc.font('Kor').fontSize(9).fillColor('#7F1D1D')
        .text(`취소일: ${cancelDate}${contract.cancellationReason ? ' · 사유: ' + contract.cancellationReason : ''}`,
          MARGIN, y + 24, { width: CONTENT_W, align: 'center' });
      y += bannerH + 12;
    }

    const drawTableRow = (label: string, value: string) => {
      const rowH = 24;
      const labelW = 120;
      doc.lineWidth(0.5).strokeColor(COLOR_BORDER);
      doc.rect(MARGIN, y, labelW, rowH).fillAndStroke(COLOR_HEADER_BG, COLOR_BORDER);
      doc.rect(MARGIN + labelW, y, CONTENT_W - labelW, rowH).stroke();
      doc.fillColor(COLOR_PRIMARY).font('KorBold').fontSize(10)
        .text(label, MARGIN + 8, y + 7, { width: labelW - 16 });
      doc.fillColor('#1A202C').font('Kor').fontSize(10)
        .text(value, MARGIN + labelW + 8, y + 7, { width: CONTENT_W - labelW - 16 });
      y += rowH;
    };

    // 당사자
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY).text('Ⅰ. 계약 당사자', MARGIN, y);
    y += 18;
    drawTableRow('갑 (보호자)', `${contract.guardian.user?.name || '-'} (${contract.guardian.user?.phone || '-'})`);
    drawTableRow('을 (간병인)', `${contract.caregiver.user?.name || '-'} (${contract.caregiver.user?.phone || '-'})`);
    drawTableRow('환자', contract.careRequest.patient.name);
    y += 12;

    // 계약 내용
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY).text('Ⅱ. 간병 내용', MARGIN, y);
    y += 18;
    drawTableRow('간병 유형', contract.careRequest.careType === 'INDIVIDUAL' ? '1:1 개인 간병' : '가족 간병');
    drawTableRow('스케줄', contract.careRequest.scheduleType === 'FULL_TIME' ? '24시간' : '시간제');
    drawTableRow('장소', `${contract.careRequest.location === 'HOSPITAL' ? '병원' : '자택'}${contract.careRequest.hospitalName ? ' · ' + contract.careRequest.hospitalName : ''}`);
    drawTableRow('주소', contract.careRequest.address || '-');
    drawTableRow('간병 기간', `${new Date(contract.startDate).toLocaleDateString('ko-KR')} ~ ${new Date(contract.endDate).toLocaleDateString('ko-KR')}`);
    drawTableRow('일당', `${contract.dailyRate.toLocaleString()}원`);
    drawTableRow('총 금액', `${contract.totalAmount.toLocaleString()}원 (VAT 별도)`);
    const feeText = (contract as any).platformFeeFixed
      ? `${contract.platformFee}% + ${(contract as any).platformFeeFixed.toLocaleString()}원`
      : `${contract.platformFee}%`;
    drawTableRow('플랫폼 수수료', feeText);
    drawTableRow('세율 (원천징수)', `${contract.taxRate}%`);
    y += 20;

    // 주요 조항
    if (y + 200 > 780) { doc.addPage(); y = MARGIN; }
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY).text('Ⅲ. 주요 조항', MARGIN, y);
    y += 18;

    const clauses = [
      {
        t: '제1조 (의료행위 금지)',
        b: '본 플랫폼의 간병인은 「의료법」상 의료인이 아니므로 의료행위(석션, 도뇨관 삽입·교체 등)를 수행할 수 없습니다. 보호자(갑)가 의료행위를 요청하거나 간병인(을)이 이를 수행할 경우, 관련 법령에 따라 법적 책임이 발생할 수 있으며, 모든 책임은 요청자 또는 행위자 본인에게 귀속됩니다. 의료행위는 반드시 의료기관 또는 의료인을 통해 진행해야 합니다.',
      },
      {
        t: '제2조 (결제 및 정산)',
        b: '보호자(갑)는 계약 체결과 동시에 케어매치 에스크로를 통해 선결제하며, 간병 종료 익일 간병인(을)에게 정산금(총액 - 플랫폼 수수료 - 원천징수 세액 3.3%)이 지급됩니다.',
      },
      {
        t: '제3조 (취소 및 연장)',
        b: '매칭 확정 후 간병인(을)의 일방 취소는 취소 패널티가 부과되며, 노쇼 3회 누적 시 활동이 자동 정지됩니다. 간병 연장은 보호자(갑)의 요청에 따라 간병인(을) 수락 시 자동 처리됩니다.',
      },
      {
        t: '제4조 (분쟁 해결)',
        b: '본 계약과 관련된 분쟁은 케어매치 고객센터를 통한 조정으로 우선 해결하며, 미해결 시 관련 법령에 따라 처리됩니다.',
      },
    ];

    clauses.forEach((c) => {
      doc.font('KorBold').fontSize(10).fillColor(COLOR_PRIMARY).text(c.t, MARGIN, y);
      y += 15;
      doc.font('Kor').fontSize(9).fillColor('#333');
      const textH = doc.heightOfString(c.b, { width: CONTENT_W });
      if (y + textH > 760) { doc.addPage(); y = MARGIN; }
      doc.text(c.b, MARGIN, y, { width: CONTENT_W, align: 'justify' });
      y += textH + 14;
    });

    // 서명
    if (y + 120 > 780) { doc.addPage(); y = MARGIN + 20; }
    y += 20;
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY)
      .text('상기 내용에 동의하며 본 계약을 체결합니다.', MARGIN, y, { width: CONTENT_W, align: 'center' });
    y += 30;

    const boxW = (CONTENT_W - 20) / 2;
    const boxH = 80;
    doc.lineWidth(0.6).strokeColor(COLOR_BORDER);
    doc.rect(MARGIN, y, boxW, boxH).stroke();
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB).text('갑 (보호자)', MARGIN + 10, y + 10);
    doc.font('KorBold').fontSize(11).fillColor('#1A202C').text(contract.guardian.user?.name || '', MARGIN + 10, y + 28);
    doc.font('Kor').fontSize(10).fillColor(COLOR_SUB).text('(서명 / 인)', MARGIN + 10, y + 58);

    doc.rect(MARGIN + boxW + 20, y, boxW, boxH).stroke();
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB).text('을 (간병인)', MARGIN + boxW + 30, y + 10);
    doc.font('KorBold').fontSize(11).fillColor('#1A202C').text(contract.caregiver.user?.name || '', MARGIN + boxW + 30, y + 28);
    doc.font('Kor').fontSize(10).fillColor(COLOR_SUB).text('(서명 / 인)', MARGIN + boxW + 30, y + 58);

    y += boxH + 16;
    doc.font('Kor').fontSize(9).fillColor(COLOR_SUB)
      .text(`계약일: ${new Date(contract.createdAt || new Date()).toLocaleDateString('ko-KR')}`, MARGIN, y, { width: CONTENT_W, align: 'center' });
    y += 14;
    doc.fontSize(8)
      .text('주관 | 케어매치 주식회사 · 사업자등록번호 173-81-03376', MARGIN, y, { width: CONTENT_W, align: 'center' });

    // 취소된 계약 — 각 페이지 중앙에 대각선 "VOID / 취소됨" 워터마크
    if (contract.status === 'CANCELLED') {
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(pages.start + i);
        doc.save();
        doc.translate(PAGE_W / 2, 420);
        doc.rotate(-30);
        doc.font('KorBold').fontSize(96).fillColor('#DC2626').opacity(0.12)
          .text('VOID · 취소됨', -250, -50, { width: 500, align: 'center' });
        doc.restore();
        doc.opacity(1);
      }
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};
