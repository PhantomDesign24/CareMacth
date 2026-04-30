import { Response, NextFunction } from 'express';
import axios from 'axios';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { logAdminAction } from '../services/auditLog';
import { config } from '../config';
import { calculateEarning } from '../utils/earning';
import { renderTemplate, sendFromTemplate, sendToAdmins } from '../services/notificationService';

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

    // 기간 계산 (금액은 트랜잭션 안에서 application.proposedRate 반영하여 결정)
    const startDate = careRequest.startDate;
    const endDate = careRequest.endDate || new Date(startDate.getTime() + (careRequest.durationDays || 7) * 86400000);
    const durationDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

    // 트랜잭션으로 계약 생성 + 상태 업데이트 (race condition 방지)
    const contract = await prisma.$transaction(async (tx) => {
      // ── careRequest atomic claim — OPEN/MATCHING 상태에서만 MATCHED 로 1회 전이.
      // (자동 만료 cron 또는 다른 선택 요청과 race 시 한쪽만 통과)
      const reqClaim = await tx.careRequest.updateMany({
        where: {
          id: careRequestId,
          guardianId: guardian.id,
          status: { in: ['OPEN', 'MATCHING'] },
        },
        data: { status: 'MATCHED' },
      });
      if (reqClaim.count !== 1) {
        throw new AppError('이미 매칭/취소된 간병 요청입니다.', 409);
      }

      // 트랜잭션 내에서 중복 계약 확인 (취소된 계약은 허용 — 재매칭 가능)
      const existingContract = await tx.contract.findFirst({
        where: { careRequestId, status: { not: 'CANCELLED' } },
      });
      if (existingContract) {
        throw new AppError('이미 계약이 생성된 간병 요청입니다.', 400);
      }

      // ── 선택된 간병인이 실제로 PENDING 지원 상태인지 검증 (지원도 안 한 간병인 차단)
      // 역제안(proposedRate) 반영을 위해 row 를 먼저 읽고 atomic claim
      const application = await tx.careApplication.findUnique({
        where: { careRequestId_caregiverId: { careRequestId, caregiverId } },
        select: { id: true, status: true, proposedRate: true, isAccepted: true },
      });
      if (!application || application.status !== 'PENDING') {
        throw new AppError('선택한 간병인의 지원 정보를 찾을 수 없습니다.', 400);
      }
      const acceptResult = await tx.careApplication.updateMany({
        where: { id: application.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (acceptResult.count !== 1) {
        throw new AppError('선택한 간병인의 지원 정보를 찾을 수 없습니다.', 400);
      }

      // careRequest 를 트랜잭션 안에서 다시 잠그고 최신 dailyRate 로 계산
      // (raise-rate 가 동시에 커밋되어도 인상된 금액으로 계약 잡히도록)
      const lockedReq = await tx.$queryRaw<Array<{ dailyRate: number | null }>>`
        SELECT "dailyRate" FROM "CareRequest" WHERE id = ${careRequestId} FOR UPDATE
      `;
      const latestDailyRate = lockedReq[0]?.dailyRate ?? null;

      // 계약 일당: 간병인이 역제안(proposedRate) 했고 그대로 수락이 아닌 경우 그 값을, 아니면 보호자 제시 (최신) 일당
      const dailyRate = (!application.isAccepted && application.proposedRate && application.proposedRate > 0)
        ? application.proposedRate
        : (latestDailyRate || 150000);
      const totalAmount = dailyRate * durationDays;
      if (totalAmount <= 0) {
        throw new AppError('계약 금액은 0보다 커야 합니다.', 400);
      }

      // 실제 진행 중 계약 확인 (workStatus 캐시 의존하지 않음)
      // — 동시성: caregiver 행을 SELECT FOR UPDATE 로 잠근 후 contract 카운트로 검증
      await tx.$queryRaw`SELECT id FROM "Caregiver" WHERE id = ${caregiverId} FOR UPDATE`;
      const ongoing = await tx.contract.count({
        where: {
          caregiverId,
          status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] },
        },
      });
      if (ongoing > 0) {
        throw new AppError('간병인이 이미 다른 간병을 진행 중입니다.', 400);
      }
      // workStatus 캐시 동기화
      await tx.caregiver.update({
        where: { id: caregiverId },
        data: { workStatus: 'WORKING', totalMatches: { increment: 1 } },
      });

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

      // 다른 지원 거절 처리 (선택된 간병인은 위에서 ACCEPTED 처리됨)
      await tx.careApplication.updateMany({
        where: {
          careRequestId,
          caregiverId: { not: caregiverId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
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

    if (contract.status !== 'ACTIVE' && contract.status !== 'EXTENDED') {
      throw new AppError('활성/연장 상태의 계약만 취소할 수 있습니다.', 400);
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

    // 간병인 귀속 금액 (간병인 정산 base, VAT 별도)
    const usedAmount = contract.dailyRate * usedDays;
    const proportionRemaining = totalDays > 0 ? remainingDays / totalDays : 0;

    // 간병인 정산: 단일 calculateEarning 으로 통일
    const earningCalc = calculateEarning({
      amount: usedAmount,
      platformFeePercent: contract.platformFee,
      platformFeeFixed: (contract as any).platformFeeFixed || 0,
      taxRate: contract.taxRate,
    });
    const platformFeeAmount = earningCalc.platformFee;
    const taxAmount = earningCalc.taxAmount;
    const netEarning = earningCalc.netAmount;

    // ── ATOMIC CLAIM ── (Toss API 호출 전에 contract 상태를 먼저 락으로 선점)
    // 동시 두 취소 요청이 들어와도 한쪽만 통과 → 다른 쪽은 409. Toss cancel 중복 호출 차단.
    const cancelledByLabel = isCaregiverCancel ? '간병인' : '보호자';
    const claim = await prisma.contract.updateMany({
      where: { id, status: { in: ['ACTIVE', 'EXTENDED'] } },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: req.user!.id,
        cancellationReason: reason || `${cancelledByLabel} 요청에 의한 취소`,
        cancellationPolicy: `총 ${totalDays}일 중 ${usedDays}일 사용`,
      },
    });
    if (claim.count === 0) {
      throw new AppError('이미 취소된 계약입니다.', 409);
    }
    // 여기서부터는 단일 winner 만 도달.

    // ── 활성 결제 전부 조회 (다중 결제: 일반/주차/연장 모두 포함)
    const activePayments = await prisma.payment.findMany({
      where: {
        contractId: contract.id,
        status: { in: ['ESCROW', 'COMPLETED', 'PARTIAL_REFUND'] },
        // 이미 사용자 환불 요청 PENDING 또는 관리자 직접 환불 PROCESSING 락 잡힌 결제는 제외
        // (PROCESSING 락 상태는 Toss cancel 진행 중일 수 있어 중복 환불 방지)
        OR: [
          { refundRequestStatus: null },
          { refundRequestStatus: { notIn: ['PENDING', 'PROCESSING'] } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // 결제별 환불 계획 + Toss cancel 시도 (외부 API)
    type RefundPlan = {
      paymentId: string;
      cashRefund: number;
      pointsRefund: number;
      method: string;
      tossSuccess: boolean;
      manualNeeded: boolean;
      tossError?: string;
    };
    const plans: RefundPlan[] = [];
    for (const p of activePayments) {
      const remainingPayable = Math.max(0, p.totalAmount - (p.refundAmount || 0));
      const grossRefund = Math.round(p.totalAmount * proportionRemaining);
      const cashRefund = Math.min(grossRefund, remainingPayable);
      const pointsRefund = Math.round((p.pointsUsed || 0) * proportionRemaining);

      const plan: RefundPlan = {
        paymentId: p.id,
        cashRefund,
        pointsRefund,
        method: p.method,
        tossSuccess: false,
        manualNeeded: false,
      };

      if (cashRefund > 0) {
        if (p.method === 'CARD' && p.tossPaymentKey) {
          try {
            const secretKey = config.toss.secretKey;
            const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
            await axios.post(
              `https://api.tosspayments.com/v1/payments/${p.tossPaymentKey}/cancel`,
              { cancelReason: reason || '계약 취소에 의한 일할 환불', cancelAmount: cashRefund },
              {
                headers: {
                  Authorization: `Basic ${encodedKey}`,
                  'Content-Type': 'application/json',
                },
              },
            );
            plan.tossSuccess = true;
          } catch (tossErr: any) {
            plan.tossError = tossErr?.response?.data?.message || '토스 환불 실패';
            plan.manualNeeded = true;
          }
        } else {
          // BANK_TRANSFER (가상계좌 환불은 통장정보 필요), DIRECT, tossPaymentKey 없음
          // → 자동 환불 불가, 관리자 수동 처리 큐로 등록
          plan.manualNeeded = true;
        }
      }
      plans.push(plan);
    }

    // ── DB finalize 트랜잭션 (Toss 결과 반영 + 부수 효과)
    // contract.status 는 이미 CANCELLED 로 claim 됐고 Toss 환불 일부 성공한 상태 — DB 동기화 실패시 관리자 reconcile.
    let penaltyWarning: string | null = null;
    let totalCashRefundedNow = 0;
    let totalPointsRefundedNow = 0;
    let manualPendingCount = 0;
    let finalizeFailed = false;

    try {
    await prisma.$transaction(async (tx) => {
      // 간병 요청 상태 업데이트
      await tx.careRequest.update({
        where: { id: contract.careRequestId },
        data: { status: 'CANCELLED' },
      });

      // 해당 careRequest의 모든 CareApplication 상태 CANCELLED로 동기화
      await tx.careApplication.updateMany({
        where: { careRequestId: contract.careRequestId, status: { in: ['PENDING', 'ACCEPTED'] } },
        data: { status: 'CANCELLED' },
      });

      // 해당 계약 관련 분쟁 자동 처리
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

        await tx.caregiver.update({
          where: { id: contract.caregiverId },
          data: {
            penaltyCount: { increment: 1 },
          },
        });

        const updatedCaregiver = await tx.caregiver.findUnique({
          where: { id: contract.caregiverId },
        });

        if (updatedCaregiver && updatedCaregiver.penaltyCount >= 3) {
          await tx.caregiver.update({
            where: { id: contract.caregiverId },
            data: { status: 'SUSPENDED' },
          });
          penaltyWarning = '취소 3회 이상으로 활동이 정지되었습니다.';
        }
      }

      // ── 부분 정산: 기존 미정산 Earning 재조정
      const existingEarnings = await tx.earning.findMany({
        where: { contractId: contract.id, isPaid: false },
        orderBy: { createdAt: 'asc' },
      });
      if (existingEarnings.length > 0) {
        if (usedDays > 0) {
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

      // ── 결제별 환불 처리
      for (const plan of plans) {
        const original = activePayments.find((p) => p.id === plan.paymentId);
        if (!original) continue;

        if (plan.tossSuccess && plan.cashRefund > 0) {
          // Toss 환불 성공 → DB 반영 (누적 환불액)
          const existingRefunded = original.refundAmount || 0;
          const totalRefundedAfter = existingRefunded + plan.cashRefund;
          const newStatus = totalRefundedAfter >= original.totalAmount ? 'REFUNDED' : 'PARTIAL_REFUND';
          await tx.payment.update({
            where: { id: original.id },
            data: {
              status: newStatus,
              refundedAt: now,
              refundAmount: totalRefundedAfter,
              refundReason: reason || '계약 취소에 의한 일할 환불',
            },
          });
          // 포인트 delta 복구 (목표 누적 - 이미 복구된 추정치)
          if ((original.pointsUsed || 0) > 0) {
            const totalAmt = Math.max(1, original.totalAmount);
            const targetCumulativePoints = Math.round(((original.pointsUsed || 0) * totalRefundedAfter) / totalAmt);
            const alreadyRestoredEstimate = Math.round(((original.pointsUsed || 0) * existingRefunded) / totalAmt);
            const pointsDelta = Math.max(0, targetCumulativePoints - alreadyRestoredEstimate);
            if (pointsDelta > 0) {
              await tx.user.update({
                where: { id: contract.guardian.userId },
                data: { points: { increment: pointsDelta } },
              });
              totalPointsRefundedNow += pointsDelta;
            }
          }
          totalCashRefundedNow += plan.cashRefund;
        } else if (plan.manualNeeded && plan.cashRefund > 0) {
          // 자동 환불 불가 → 관리자 환불 요청 큐로 등록 (Payment.status 미변경)
          await tx.payment.update({
            where: { id: original.id },
            data: {
              refundRequestStatus: 'PENDING',
              refundRequestedAt: now,
              refundRequestedBy: req.user!.id,
              refundRequestReason: `계약 취소(자동 환불 불가${plan.tossError ? `: ${plan.tossError}` : ''}): ${reason}`,
              refundRequestAmount: plan.cashRefund,
            },
          });
          manualPendingCount += 1;
        } else if (plan.cashRefund <= 0 && plan.pointsRefund > 0) {
          // 전액 포인트 결제(totalAmount=0) 등의 케이스: 현금 환불은 없지만 포인트는 비례 복구해야 함.
          const existingRefunded = original.refundAmount || 0;
          const totalAmt = Math.max(1, original.totalAmount || (original.pointsUsed || 0));
          const targetCumulativePoints = Math.round(((original.pointsUsed || 0) * (existingRefunded + plan.cashRefund)) / totalAmt);
          // totalAmount=0 이면 위 식이 0 — 비례식으로 못 잡으므로 proportionRemaining 직접 적용
          const fallbackPoints = original.totalAmount === 0
            ? Math.round((original.pointsUsed || 0) * proportionRemaining)
            : 0;
          const targetPoints = Math.max(targetCumulativePoints, fallbackPoints);
          const alreadyRestoredEstimate = original.totalAmount > 0
            ? Math.round(((original.pointsUsed || 0) * existingRefunded) / totalAmt)
            : 0;
          const pointsDelta = Math.max(0, targetPoints - alreadyRestoredEstimate);
          if (pointsDelta > 0) {
            await tx.user.update({
              where: { id: contract.guardian.userId },
              data: { points: { increment: pointsDelta } },
            });
            totalPointsRefundedNow += pointsDelta;
          }
          // ESCROW 정리 (필요 시)
          if (original.status === 'ESCROW') {
            await tx.payment.update({
              where: { id: original.id },
              data: { status: 'COMPLETED' },
            });
          }
        } else if (plan.cashRefund <= 0 && original.status === 'ESCROW') {
          // 사용일수로 전액 소진 → ESCROW → COMPLETED 정리
          await tx.payment.update({
            where: { id: original.id },
            data: { status: 'COMPLETED' },
          });
        }
      }
    });

    } catch (finalizeErr: any) {
      // ATOMIC CLAIM 으로 contract 는 이미 CANCELLED, Toss 환불도 일부 성공했을 수 있음.
      // DB finalize 실패 → 관리자 즉시 알림 + cancellationPolicy 에 sync 실패 표시 (best-effort).
      finalizeFailed = true;
      console.error('[CRITICAL] cancelContract finalize 실패. contractId=', id, finalizeErr);
      try {
        await prisma.contract.update({
          where: { id },
          data: {
            cancellationPolicy: `[FINALIZE_FAILED] 총 ${totalDays}일 중 ${usedDays}일 사용 — DB 동기화 실패. 수동 처리 필요.`,
          },
        });
      } catch {}
      // plans 전체를 구조화해서 reconcile 지시로 통합 (manualNeeded 알림은 별도 발송 X)
      await sendToAdmins({
        key: 'CONTRACT_CANCEL_FINALIZE_FAILED_ADMIN',
        vars: {
          contractId: id,
          message: finalizeErr?.message || 'unknown',
          tossSucceededCount: String(plans.filter((p) => p.tossSuccess).length),
          manualNeededCount: String(plans.filter((p) => p.manualNeeded).length),
        },
        data: {
          contractId: id,
          manualReconcile: true,
          plans: plans.map((p) => ({
            paymentId: p.paymentId,
            method: p.method,
            cashRefund: p.cashRefund,
            pointsRefund: p.pointsRefund,
            tossSuccess: p.tossSuccess,
            manualNeeded: p.manualNeeded,
            tossError: p.tossError,
          })),
        } as any,
      }).catch(() => {});
    }

    // ── 트랜잭션 외부: 수동 환불 필요 결제는 관리자에게 알림 (finalize 실패 시 skip)
    if (!finalizeFailed) {
      for (const plan of plans) {
        if (plan.manualNeeded && plan.cashRefund > 0) {
          await sendToAdmins({
            key: 'CONTRACT_CANCEL_MANUAL_REFUND_ADMIN',
            vars: {
              contractId: id,
              paymentId: plan.paymentId,
              amount: plan.cashRefund.toLocaleString(),
              method: plan.method,
              reason: plan.tossError || `${plan.method} 자동 환불 미지원`,
            },
            data: { contractId: id, paymentId: plan.paymentId, manualRefund: true },
          }).catch(() => {});
        }
      }
    }

    // 응답용 변수 동기화
    const refundAmount = totalCashRefundedNow;
    const pointsRefund = totalPointsRefundedNow;

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

    // 관리자가 강제 취소한 경우만 감사 로그 기록 (보호자/간병인 본인 취소는 기록 X)
    if (req.user!.role === 'ADMIN') {
      await logAdminAction(req, 'CONTRACT_FORCE_CANCEL', {
        targetType: 'Contract', targetId: id,
        payload: { reason, totalDays, usedDays, refundAmount },
      });
    }

    res.json({
      success: true,
      data: {
        totalDays,
        usedDays,
        remainingDays,
        usedAmount,
        refundAmount,
        pointsRefund,
        manualPendingCount,
        finalizeFailed,
        netEarning,
        cancelledBy: isCaregiverCancel ? 'CAREGIVER' : 'GUARDIAN',
        penaltyWarning,
      },
      message: finalizeFailed
        ? '계약은 취소됐지만 후속 처리 중 오류가 발생했습니다. 관리자가 수동 동기화 합니다.'
        : (isCaregiverCancel
            ? `계약이 취소되었습니다. 패널티가 부과되었습니다.`
            : `계약이 취소되었습니다. ${usedDays}일 사용, ${refundAmount.toLocaleString()}원 환불${pointsRefund > 0 ? ` + ${pointsRefund.toLocaleString()}P 복구` : ''}${manualPendingCount > 0 ? ` (관리자 수동 처리 ${manualPendingCount}건 대기)` : ' 예정'}`),
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
        guardian: { select: { id: true, userId: true } },
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
    const newCaregiverFlag = !!isNewCaregiver;
    const initialStatus = newCaregiverFlag ? 'PENDING_PAYMENT' : 'PENDING_CAREGIVER_APPROVAL';

    // 트랜지션 락: contract 행 잠금 → in-flight 검증 → 생성 (동시 신청 차단)
    const extension = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${id} FOR UPDATE`;
      const inFlight = await tx.contractExtension.findFirst({
        where: {
          contractId: id,
          status: { in: ['PENDING_CAREGIVER_APPROVAL', 'PENDING_PAYMENT'] },
        },
      });
      if (inFlight) {
        throw new AppError(
          `이미 진행 중인 연장 요청이 있습니다. (${inFlight.status}) 완료 또는 취소 후 다시 시도해주세요.`,
          400,
        );
      }
      return tx.contractExtension.create({
        data: {
          contractId: id,
          newEndDate,
          additionalDays: parseInt(additionalDays),
          additionalAmount,
          isNewCaregiver: newCaregiverFlag,
          status: initialStatus,
        },
      });
    });

    // 신규 간병인 모드: 보호자에게 즉시 결제 안내 (간병인 동의 단계 스킵)
    if (newCaregiverFlag) {
      await sendFromTemplate({
        userId: contract.guardian.userId,
        key: 'PAYMENT_EXTENSION_REQUIRED',
        vars: {
          additionalDays: String(additionalDays),
          additionalAmount: additionalAmount.toLocaleString(),
        },
        fallbackTitle: '연장 결제 진행',
        fallbackBody: `새 간병인 매칭으로 ${additionalDays}일 연장이 신청되었습니다. 추가금 ${additionalAmount.toLocaleString()}원 결제를 진행해주세요.`,
        fallbackType: 'EXTENSION',
        data: { contractId: id, extensionId: extension.id },
      }).catch(() => {});
    } else {
      // 기존 간병인: 간병인에게 수락/거절 요청 푸시
      await sendFromTemplate({
        userId: contract.caregiver.userId,
        key: 'EXTENSION_REQUEST',
        vars: {
          patientName: contract.careRequest.patient.name,
          additionalDays: String(additionalDays),
          newEndDate: newEndDate.toLocaleDateString('ko-KR'),
        },
        fallbackTitle: '간병 연장 수락 요청',
        fallbackBody: `${contract.careRequest.patient.name} 환자 ${additionalDays}일 연장 수락 여부를 알려주세요.`,
        fallbackType: 'EXTENSION',
        data: { contractId: id, extensionId: extension.id, requiresApproval: true },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: {
        extension,
        newEndDate,
        additionalAmount,
        message: newCaregiverFlag
          ? '신규 간병인 연장 신청이 접수되었습니다. 결제를 진행해주세요.'
          : '간병인 수락 후 결제 단계로 진행됩니다.',
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

    // 서명 영역 (양측 서명 이미지 삽입)
    const sigBoxW = (CONTENT_W - 20) / 2;
    const sigBoxH = 90;
    const sigBoxY = y;
    // 보호자
    doc.lineWidth(0.6).strokeColor('#D1D5DB').rect(MARGIN, sigBoxY, sigBoxW, sigBoxH).stroke();
    doc.font('KorBold').fontSize(9).fillColor(COLOR_SUB).text('갑 (보호자) 서명', MARGIN + 8, sigBoxY + 6);
    if ((contract as any).guardianSignature) {
      try {
        const sig = (contract as any).guardianSignature as string;
        const base64 = sig.includes(',') ? sig.split(',')[1] : sig;
        const buf = Buffer.from(base64, 'base64');
        doc.image(buf, MARGIN + 10, sigBoxY + 22, { fit: [sigBoxW - 20, sigBoxH - 40] });
      } catch {}
      const signedAt = (contract as any).guardianSignedAt;
      if (signedAt) {
        doc.font('Kor').fontSize(7).fillColor('#9CA3AF')
          .text(`서명일시: ${new Date(signedAt).toLocaleString('ko-KR')}`, MARGIN + 8, sigBoxY + sigBoxH - 14);
      }
    } else {
      doc.font('Kor').fontSize(9).fillColor('#9CA3AF')
        .text('(미서명)', MARGIN, sigBoxY + sigBoxH / 2, { width: sigBoxW, align: 'center' });
    }
    // 간병인
    const sigX2 = MARGIN + sigBoxW + 20;
    doc.lineWidth(0.6).strokeColor('#D1D5DB').rect(sigX2, sigBoxY, sigBoxW, sigBoxH).stroke();
    doc.font('KorBold').fontSize(9).fillColor(COLOR_SUB).text('을 (간병인) 서명', sigX2 + 8, sigBoxY + 6);
    if ((contract as any).caregiverSignature) {
      try {
        const sig = (contract as any).caregiverSignature as string;
        const base64 = sig.includes(',') ? sig.split(',')[1] : sig;
        const buf = Buffer.from(base64, 'base64');
        doc.image(buf, sigX2 + 10, sigBoxY + 22, { fit: [sigBoxW - 20, sigBoxH - 40] });
      } catch {}
      const signedAt = (contract as any).caregiverSignedAt;
      if (signedAt) {
        doc.font('Kor').fontSize(7).fillColor('#9CA3AF')
          .text(`서명일시: ${new Date(signedAt).toLocaleString('ko-KR')}`, sigX2 + 8, sigBoxY + sigBoxH - 14);
      }
    } else {
      doc.font('Kor').fontSize(9).fillColor('#9CA3AF')
        .text('(미서명)', sigX2, sigBoxY + sigBoxH / 2, { width: sigBoxW, align: 'center' });
    }

    y = sigBoxY + sigBoxH + 16;
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

// ============================================
// 디지털 서명
// ============================================

// POST /:id/sign - 계약 서명 (보호자 또는 간병인)
// Body: { signature: string (base64 PNG data URL) }
export const signContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { signature } = req.body;

    if (!signature || typeof signature !== 'string' || !signature.startsWith('data:image/')) {
      throw new AppError('유효한 서명 이미지가 필요합니다. (base64 data URL)', 400);
    }
    if (signature.length > 500_000) {
      throw new AppError('서명 이미지가 너무 큽니다. (최대 500KB)', 400);
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { guardian: true, caregiver: true },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);

    const role = req.user!.role;
    const now = new Date();

    let signerRole: 'GUARDIAN' | 'CAREGIVER';
    let lockResult: { count: number };

    if (role === 'GUARDIAN' || role === 'HOSPITAL') {
      const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
      if (!guardian || contract.guardianId !== guardian.id) {
        throw new AppError('이 계약의 보호자가 아닙니다.', 403);
      }
      // 트랜지션 락: guardianSignedAt = null 일 때만 1회 서명 기록
      lockResult = await prisma.contract.updateMany({
        where: { id, guardianSignedAt: null },
        data: { guardianSignature: signature, guardianSignedAt: now },
      });
      if (lockResult.count === 0) {
        throw new AppError('이미 서명을 완료했습니다.', 400);
      }
      signerRole = 'GUARDIAN';
    } else if (role === 'CAREGIVER') {
      const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
      if (!caregiver || contract.caregiverId !== caregiver.id) {
        throw new AppError('이 계약의 간병인이 아닙니다.', 403);
      }
      lockResult = await prisma.contract.updateMany({
        where: { id, caregiverSignedAt: null },
        data: { caregiverSignature: signature, caregiverSignedAt: now },
      });
      if (lockResult.count === 0) {
        throw new AppError('이미 서명을 완료했습니다.', 400);
      }
      signerRole = 'CAREGIVER';
    } else {
      throw new AppError('서명 권한이 없습니다.', 403);
    }

    // 양측 모두 서명되었는지 확인 후 ACTIVE 전환 (별도 트랜지션 락)
    // PENDING_SIGNATURE 이고 양측 signedAt 모두 not null 일 때만 ACTIVE
    await prisma.contract.updateMany({
      where: {
        id,
        status: 'PENDING_SIGNATURE',
        guardianSignedAt: { not: null },
        caregiverSignedAt: { not: null },
      },
      data: { status: 'ACTIVE' },
    });

    const updated = await prisma.contract.findUnique({ where: { id } });

    // 알림 발송
    if (signerRole === 'GUARDIAN') {
      await sendFromTemplate({
        userId: contract.caregiver.userId,
        key: 'CONTRACT_SIGNED_GUARDIAN',
        vars: {},
        fallbackTitle: '보호자가 계약서에 서명했습니다',
        fallbackBody: '계약서 보호자 서명이 완료되었습니다. 본인도 서명 후 계약이 시작됩니다.',
        fallbackType: 'CONTRACT',
        data: { contractId: id },
      }).catch(() => {});
    } else {
      await sendFromTemplate({
        userId: contract.guardian.userId,
        key: 'CONTRACT_SIGNED_CAREGIVER',
        vars: {},
        fallbackTitle: '간병인이 계약서에 서명했습니다',
        fallbackBody: '계약서 간병인 서명이 완료되었습니다. 본인도 서명 후 계약이 시작됩니다.',
        fallbackType: 'CONTRACT',
        data: { contractId: id },
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        guardianSigned: !!updated?.guardianSignedAt,
        caregiverSigned: !!updated?.caregiverSignedAt,
        status: updated?.status,
      },
    });
  } catch (error) {
    next(error);
  }
};


// POST /:contractId/extension/:extensionId/reject - 연장 거절 (간병인 또는 보호자)
export const rejectExtension = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId, extensionId } = req.params;
    const { reason } = req.body;

    const ext = await prisma.contractExtension.findUnique({
      where: { id: extensionId },
      include: {
        contract: {
          include: {
            guardian: true,
            caregiver: true,
            careRequest: { include: { patient: true } },
          },
        },
      },
    });
    if (!ext || ext.contractId !== contractId) {
      throw new AppError('연장 정보를 찾을 수 없습니다.', 404);
    }
    if (ext.status !== 'PENDING_PAYMENT' && ext.status !== 'PENDING_CAREGIVER_APPROVAL') {
      throw new AppError(`이미 처리된 연장입니다. (${ext.status})`, 400);
    }

    // 권한 검증
    const role = req.user!.role;
    if (role === 'GUARDIAN' || role === 'HOSPITAL') {
      const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
      if (!guardian || ext.contract.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (role === 'CAREGIVER') {
      const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
      if (!caregiver || ext.contract.caregiverId !== caregiver.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (role !== 'ADMIN') {
      throw new AppError('접근 권한이 없습니다.', 403);
    }

    // 트랜지션 락: PENDING 상태일 때만 1회 REJECTED 처리
    const lock = await prisma.contractExtension.updateMany({
      where: {
        id: extensionId,
        status: { in: ['PENDING_CAREGIVER_APPROVAL', 'PENDING_PAYMENT'] },
      },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectReason: reason || (role === 'CAREGIVER' ? '간병인이 연장 거절' : '보호자가 연장 취소'),
      },
    });
    if (lock.count === 0) {
      throw new AppError('이미 처리된 연장입니다.', 400);
    }

    // 알림: 상대방에게
    const targetUserId =
      role === 'CAREGIVER' ? ext.contract.guardian.userId : ext.contract.caregiver.userId;
    await sendFromTemplate({
      userId: targetUserId,
      key: 'EXTENSION_CONFIRMED', // 임시 — 별도 REJECTED 템플릿 추가 가능
      vars: {
        patientName: ext.contract.careRequest.patient.name,
        reason: reason || '취소됨',
      },
      fallbackTitle: '연장 신청이 취소되었습니다',
      fallbackBody: `${ext.contract.careRequest.patient.name} 환자 연장이 취소되었습니다. ${reason ? `사유: ${reason}` : ''}`,
      fallbackType: 'EXTENSION',
      data: { contractId, extensionId },
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// POST /:contractId/extension/:extensionId/approve - 간병인 연장 수락
// PENDING_CAREGIVER_APPROVAL → PENDING_PAYMENT 전환, 보호자에게 결제 안내
export const approveExtension = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId, extensionId } = req.params;

    const ext = await prisma.contractExtension.findUnique({
      where: { id: extensionId },
      include: {
        contract: {
          include: {
            guardian: true,
            caregiver: true,
            careRequest: { include: { patient: true } },
          },
        },
      },
    });
    if (!ext || ext.contractId !== contractId) {
      throw new AppError('연장 정보를 찾을 수 없습니다.', 404);
    }
    if (ext.status !== 'PENDING_CAREGIVER_APPROVAL') {
      throw new AppError(`수락 대기 상태가 아닙니다. (${ext.status})`, 400);
    }

    // 간병인 본인 검증
    const role = req.user!.role;
    if (role !== 'CAREGIVER') {
      throw new AppError('간병인만 연장을 수락할 수 있습니다.', 403);
    }
    const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
    if (!caregiver || ext.contract.caregiverId !== caregiver.id) {
      throw new AppError('이 계약의 간병인이 아닙니다.', 403);
    }

    // 트랜지션 락: PENDING_CAREGIVER_APPROVAL 인 경우에만 1회 PENDING_PAYMENT 로 전이
    const lockResult = await prisma.contractExtension.updateMany({
      where: { id: extensionId, status: 'PENDING_CAREGIVER_APPROVAL' },
      data: {
        status: 'PENDING_PAYMENT',
        approvedByCaregiver: true,
      },
    });
    if (lockResult.count === 0) {
      throw new AppError('이미 처리된 연장입니다.', 400);
    }
    const updated = await prisma.contractExtension.findUnique({ where: { id: extensionId } });

    // 보호자에게 결제 안내
    await sendFromTemplate({
      userId: ext.contract.guardian.userId,
      key: 'PAYMENT_EXTENSION_REQUIRED',
      vars: {
        additionalDays: String(ext.additionalDays),
        additionalAmount: ext.additionalAmount.toLocaleString(),
      },
      fallbackTitle: '간병인이 연장을 수락했습니다',
      fallbackBody: `간병인이 연장을 수락했습니다. 추가금 ${ext.additionalAmount.toLocaleString()}원 결제를 진행해주세요.`,
      fallbackType: 'EXTENSION',
      data: { contractId, extensionId },
    }).catch(() => {});

    res.json({
      success: true,
      data: { extension: updated, message: '연장을 수락했습니다. 보호자 결제 후 적용됩니다.' },
    });
  } catch (error) {
    next(error);
  }
};
