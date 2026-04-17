import { Response, NextFunction } from 'express';
import axios from 'axios';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { config } from '../config';
import { generateOrderId } from '../utils/generateCode';
import { sendEmail, emailPaymentCompleted } from '../services/emailService';

// POST / - 결제 생성
export const createPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const { contractId, method, pointsUsed, useAllPoints, isRecurring, recurringWeek, testMode } = req.body;

    if (!contractId || !method) {
      throw new AppError('계약 ID와 결제 방법은 필수입니다.', 400);
    }

    // 계약 확인
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        guardianId: guardian.id,
        status: { in: ['ACTIVE', 'EXTENDED'] },
      },
    });

    if (!contract) {
      throw new AppError('유효한 계약을 찾을 수 없습니다.', 404);
    }

    // 중복 결제 시도 방지: 10초 이내 PENDING 결제가 있으면 기존 것 반환
    const recentPending = await prisma.payment.findFirst({
      where: {
        contractId,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 10 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentPending) {
      return res.status(200).json({
        success: true,
        data: {
          payment: recentPending,
          orderId: recentPending.tossOrderId,
          amount: recentPending.totalAmount,
        },
        duplicate: true,
      });
    }

    // 금액 계산
    let paymentAmount = contract.totalAmount;

    // 주 단위 결제인 경우
    if (isRecurring && recurringWeek) {
      paymentAmount = contract.dailyRate * 7;
    }

    // 테스트 모드: 토스 최소 결제액(카드 100원)으로 강제 (개발/테스트 용도)
    if (testMode === true) {
      paymentAmount = 100;
    }

    // 포인트 사용 (자동 전액 사용 또는 수동 입력)
    let actualPointsUsed = 0;
    if ((pointsUsed && pointsUsed > 0) || useAllPoints) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });
      const availablePoints = user?.points || 0;
      const requestedPoints = useAllPoints ? availablePoints : pointsUsed;
      if (requestedPoints > availablePoints) {
        throw new AppError(`사용 가능한 포인트(${availablePoints.toLocaleString()}P)를 초과했습니다.`, 400);
      }
      actualPointsUsed = Math.min(requestedPoints, availablePoints, paymentAmount);
    }

    const amount = paymentAmount - actualPointsUsed;

    if (amount < 0) {
      throw new AppError('결제 금액이 올바르지 않습니다.', 400);
    }

    // VAT 별도 계산 (공급가액 기준 10%) - paymentService와 동일 방식
    // 테스트 모드는 VAT 제외하고 정확히 100원으로 결제
    const vatAmount = testMode === true ? 0 : Math.round(amount / 11);
    const totalAmount = amount + vatAmount;

    if (totalAmount <= 0 && amount > 0) {
      throw new AppError('결제 금액 계산에 오류가 발생했습니다.', 400);
    }

    const orderId = generateOrderId();

    const payment = await prisma.$transaction(async (tx) => {
      // 포인트 차감 (트랜잭션 내에서 재확인하여 음수 방지)
      if (actualPointsUsed > 0) {
        const currentUser = await tx.user.findUnique({ where: { id: req.user!.id } });
        if (!currentUser || currentUser.points < actualPointsUsed) {
          throw new AppError('포인트가 부족합니다. 다시 시도해주세요.', 400);
        }
        await tx.user.update({
          where: { id: req.user!.id },
          data: { points: { decrement: actualPointsUsed } },
        });
      }

      // 결제 생성
      const newPayment = await tx.payment.create({
        data: {
          contractId,
          guardianId: guardian.id,
          amount,
          vatAmount,
          totalAmount,
          method,
          pointsUsed: actualPointsUsed,
          tossOrderId: orderId,
          isRecurring: isRecurring ?? false,
          recurringWeek: recurringWeek ?? null,
          status: method === 'DIRECT' ? 'COMPLETED' : 'PENDING',
          ...(method === 'DIRECT' && { paidAt: new Date() }),
        },
      });

      // 직접 결제의 경우 즉시 완료 처리
      if (method === 'DIRECT') {
        // 간병인 정산 생성
        const platformFeeAmount = Math.round(amount * (contract.platformFee / 100));
        const taxAmount = Math.round(amount * (contract.taxRate / 100));
        const netAmount = amount - platformFeeAmount - taxAmount;

        await tx.earning.create({
          data: {
            caregiverId: contract.caregiverId,
            contractId,
            amount,
            platformFee: platformFeeAmount,
            taxAmount,
            netAmount,
          },
        });
      }

      return newPayment;
    });

    res.status(201).json({
      success: true,
      data: {
        payment,
        orderId,
        amount: totalAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /confirm - 토스페이먼츠 결제 확인
export const confirmPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { paymentKey, orderId, amount } = req.body;

    if (!paymentKey || !orderId || !amount) {
      throw new AppError('결제 확인에 필요한 정보가 누락되었습니다.', 400);
    }

    // 결제 조회
    const payment = await prisma.payment.findUnique({
      where: { tossOrderId: orderId },
      include: {
        contract: true,
      },
    });

    if (!payment) {
      throw new AppError('결제 정보를 찾을 수 없습니다.', 404);
    }

    if (payment.status !== 'PENDING') {
      throw new AppError('이미 처리된 결제입니다.', 400);
    }

    // 금액 검증
    if (payment.totalAmount !== parseInt(amount)) {
      throw new AppError('결제 금액이 일치하지 않습니다.', 400);
    }

    // 토스페이먼츠 결제 승인 API 호출
    const secretKey = config.toss.secretKey;
    const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');

    try {
      const tossResponse = await axios.post(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey, orderId, amount: parseInt(amount) },
        {
          headers: {
            Authorization: `Basic ${encodedKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (tossResponse.data.status === 'DONE') {
        await prisma.$transaction(async (tx) => {
          // 결제 완료 처리
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'ESCROW',
              tossPaymentKey: paymentKey,
              paidAt: new Date(),
            },
          });

          // 간병 요청 상태 업데이트
          if (payment.contract) {
            await tx.careRequest.update({
              where: { id: payment.contract.careRequestId },
              data: { status: 'IN_PROGRESS' },
            });
          }

          // 알림
          if (payment.contract) {
            const caregiver = await tx.caregiver.findUnique({
              where: { id: payment.contract.caregiverId },
            });
            if (caregiver) {
              await tx.notification.create({
                data: {
                  userId: caregiver.userId,
                  type: 'PAYMENT',
                  title: '결제가 완료되었습니다',
                  body: `결제가 완료되어 간병이 시작됩니다. 결제금액: ${parseInt(amount).toLocaleString()}원`,
                  data: { paymentId: payment.id },
                },
              });
            }
          }
        });

        // 이메일 통지 (보호자)
        try {
          const guardianWithUser = await prisma.guardian.findUnique({
            where: { id: payment.guardianId },
            include: { user: { select: { email: true } }, patients: false },
          });
          const patient = await prisma.patient.findFirst({
            where: { careRequests: { some: { contract: { id: payment.contractId! } } } },
          });
          if (guardianWithUser?.user?.email) {
            sendEmail(
              guardianWithUser.user.email,
              '결제 완료 안내',
              emailPaymentCompleted(patient?.name || '환자', payment.totalAmount),
            ).catch(() => {});
          }
        } catch {}

        res.json({
          success: true,
          data: {
            paymentKey,
            orderId,
            status: 'ESCROW',
          },
        });
      } else {
        throw new AppError('결제 승인에 실패했습니다.', 400);
      }
    } catch (tossError: any) {
      // 토스 API 에러 처리
      const errorMessage = tossError.response?.data?.message || '결제 승인 중 오류가 발생했습니다.';

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });

      throw new AppError(errorMessage, 400);
    }
  } catch (error) {
    next(error);
  }
};

// POST /:id/refund - 환불
export const refundPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { reason, amount: refundRequestAmount } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        contract: true,
        guardian: true,
      },
    });

    if (!payment) {
      throw new AppError('결제 정보를 찾을 수 없습니다.', 404);
    }

    // 접근 권한 확인
    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || payment.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (req.user!.role !== 'ADMIN') {
      throw new AppError('접근 권한이 없습니다.', 403);
    }

    if (!['COMPLETED', 'ESCROW'].includes(payment.status)) {
      throw new AppError('환불할 수 없는 결제 상태입니다.', 400);
    }

    const parsedRefundAmount = refundRequestAmount ? parseInt(refundRequestAmount) : null;

    // 환불 금액 검증
    if (parsedRefundAmount !== null) {
      if (parsedRefundAmount <= 0) {
        throw new AppError('환불 금액은 1원 이상이어야 합니다.', 400);
      }
      if (parsedRefundAmount > payment.totalAmount) {
        throw new AppError(`환불 금액은 원래 결제 금액(${payment.totalAmount.toLocaleString()}원)을 초과할 수 없습니다.`, 400);
      }
    }

    const refundAmount = parsedRefundAmount ?? payment.totalAmount;

    const isPartialRefund = refundAmount < payment.totalAmount;

    // 토스페이먼츠 환불 요청
    if (payment.tossPaymentKey) {
      const secretKey = config.toss.secretKey;
      const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');

      try {
        await axios.post(
          `https://api.tosspayments.com/v1/payments/${payment.tossPaymentKey}/cancel`,
          {
            cancelReason: reason || '고객 요청에 의한 환불',
            cancelAmount: refundAmount,
          },
          {
            headers: {
              Authorization: `Basic ${encodedKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (tossError: any) {
        const errorMessage = tossError.response?.data?.message || '환불 처리 중 오류가 발생했습니다.';
        throw new AppError(errorMessage, 400);
      }
    }

    await prisma.$transaction(async (tx) => {
      // 결제 상태 업데이트
      await tx.payment.update({
        where: { id },
        data: {
          status: isPartialRefund ? 'PARTIAL_REFUND' : 'REFUNDED',
          refundedAt: new Date(),
          refundAmount,
          refundReason: reason || '고객 요청에 의한 환불',
        },
      });

      // 포인트 복구
      if (payment.pointsUsed > 0) {
        await tx.user.update({
          where: { id: req.user!.id },
          data: { points: { increment: payment.pointsUsed } },
        });
      }
    });

    res.json({
      success: true,
      data: {
        refundAmount,
        isPartialRefund,
      },
      message: `${refundAmount.toLocaleString()}원이 환불 처리되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /history - 결제 이력
export const getPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    let whereClause: any = {};

    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian) {
        throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
      }
      whereClause.guardianId = guardian.id;
    }

    if (status) {
      whereClause.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        include: {
          contract: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              careRequest: {
                select: {
                  patient: {
                    select: { name: true },
                  },
                },
              },
              caregiver: {
                include: {
                  user: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /:id/receipt - 결제 영수증 PDF
const FONT_REGULAR = '/usr/share/fonts/truetype/nanum/NanumGothic.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf';

export const generatePaymentReceipt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            careRequest: { include: { patient: true } },
            caregiver: { include: { user: { select: { name: true } } } },
            guardian: { include: { user: { select: { name: true, email: true, phone: true } } } },
          },
        },
      },
    });
    if (!payment) throw new AppError('결제를 찾을 수 없습니다.', 404);

    const userId = req.user!.id;
    const role = req.user!.role;
    const isRelated =
      role === 'ADMIN' ||
      payment.contract?.guardian.userId === userId ||
      payment.contract?.caregiver.userId === userId;
    if (!isRelated) throw new AppError('조회 권한이 없습니다.', 403);
    if (payment.status !== 'COMPLETED' && payment.status !== 'ESCROW') {
      throw new AppError('완료된 결제만 영수증 발급 가능합니다.', 400);
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.tossOrderId}.pdf"`);
    doc.pipe(res);

    if (fs.existsSync(FONT_REGULAR)) doc.registerFont('Kor', FONT_REGULAR);
    if (fs.existsSync(FONT_BOLD)) doc.registerFont('KorBold', FONT_BOLD);

    const PAGE_W = 595.28;
    const COLOR_PRIMARY = '#1E3A5F';
    const COLOR_SUB = '#4A5568';
    const COLOR_BORDER = '#CBD5E0';

    // 헤더
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY).text('CAREMATCH', 50, 50);
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB).text('케어매치 주식회사', 50, 64);
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB)
      .text(`영수증 번호  ${payment.tossOrderId}`, 50, 50, { width: PAGE_W - 100, align: 'right' });
    doc.text(`발행일  ${new Date().toISOString().slice(0, 10)}`, 50, 64, { width: PAGE_W - 100, align: 'right' });

    // 타이틀
    doc.font('KorBold').fontSize(24).fillColor(COLOR_PRIMARY)
      .text('결제 영수증', 50, 100, { width: PAGE_W - 100, align: 'center', characterSpacing: 2 });
    doc.font('Kor').fontSize(9).fillColor(COLOR_SUB)
      .text('Payment Receipt', 50, 130, { width: PAGE_W - 100, align: 'center' });
    doc.lineWidth(1.5).strokeColor(COLOR_PRIMARY).moveTo(50, 150).lineTo(PAGE_W - 50, 150).stroke();

    // 내용
    let y = 170;
    const rowH = 26;
    const labelW = 110;
    const valueX = 50 + labelW;
    const valueW = PAGE_W - 100 - labelW;

    const drawRow = (label: string, value: string, isBold = false) => {
      doc.lineWidth(0.5).strokeColor(COLOR_BORDER).moveTo(50, y + rowH).lineTo(PAGE_W - 50, y + rowH).stroke();
      doc.font('KorBold').fontSize(10).fillColor(COLOR_PRIMARY).text(label, 50, y + 8, { width: labelW });
      doc.font(isBold ? 'KorBold' : 'Kor').fontSize(isBold ? 14 : 11).fillColor('#1A202C')
        .text(value, valueX, y + 8, { width: valueW });
      y += rowH;
    };

    const guardian = payment.contract?.guardian.user;
    const patient = payment.contract?.careRequest.patient;
    const caregiver = payment.contract?.caregiver.user;

    drawRow('결제자', guardian?.name || '-');
    drawRow('연락처', guardian?.phone || '-');
    drawRow('이메일', guardian?.email || '-');
    drawRow('환자명', patient?.name || '-');
    drawRow('간병인', caregiver?.name || '-');
    drawRow('결제 방법', ({ CARD: '카드', BANK_TRANSFER: '무통장입금', DIRECT: '직접결제' } as any)[payment.method] || payment.method);
    drawRow('서비스 금액', `${payment.amount.toLocaleString()}원`);
    drawRow('VAT', `${payment.vatAmount.toLocaleString()}원`);
    if (payment.pointsUsed > 0) drawRow('포인트 사용', `-${payment.pointsUsed.toLocaleString()}원`);
    drawRow('결제일시', payment.paidAt ? new Date(payment.paidAt).toLocaleString('ko-KR') : new Date(payment.createdAt).toLocaleString('ko-KR'));
    y += 10;
    drawRow('총 결제 금액', `${payment.totalAmount.toLocaleString()}원`, true);

    // 푸터
    y += 30;
    doc.font('Kor').fontSize(9).fillColor(COLOR_SUB)
      .text('본 영수증은 전자적으로 발행된 문서입니다.', 50, y, { width: PAGE_W - 100, align: 'center' });
    y += 16;
    doc.fontSize(8)
      .text('케어매치 주식회사 | 사업자등록번호 173-81-03376', 50, y, { width: PAGE_W - 100, align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
};

// POST /additional-fees - 간병인이 추가 간병비 요청
export const createAdditionalFee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId, amount, reason } = req.body;
    if (!contractId || !amount || !reason) throw new AppError('필수 항목 누락', 400);

    const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
    if (!caregiver) throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, caregiverId: caregiver.id, status: { in: ['ACTIVE', 'EXTENDED'] } },
    });
    if (!contract) throw new AppError('유효한 계약이 아닙니다.', 404);

    const fee = await prisma.additionalFee.create({
      data: {
        contractId,
        amount: parseInt(amount),
        reason: String(reason).trim(),
        requestedBy: caregiver.id,
      },
    });

    // 보호자 알림
    await prisma.notification.create({
      data: {
        userId: contract.guardianId,
        type: 'PAYMENT',
        title: '추가 간병비 요청',
        body: `간병인이 ${parseInt(amount).toLocaleString()}원 추가 간병비를 요청했습니다.`,
        data: { feeId: fee.id, contractId },
      },
    }).catch(() => {});

    res.status(201).json({ success: true, data: fee });
  } catch (error) {
    next(error);
  }
};

// GET /additional-fees - 내 추가 간병비 목록
export const getAdditionalFees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    let fees: any[] = [];
    if (role === 'CAREGIVER') {
      const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
      if (!caregiver) throw new AppError('간병인 정보 없음', 404);
      fees = await prisma.additionalFee.findMany({
        where: { requestedBy: caregiver.id },
        include: { contract: { include: { careRequest: { include: { patient: { select: { name: true } } } } } } },
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
      if (!guardian) throw new AppError('보호자 정보 없음', 404);
      fees = await prisma.additionalFee.findMany({
        where: { contract: { guardianId: guardian.id } },
        include: { contract: { include: { careRequest: { include: { patient: { select: { name: true } } } } } } },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      fees = [];
    }
    res.json({ success: true, data: fees });
  } catch (error) {
    next(error);
  }
};

// POST /additional-fees/:id/approve - 보호자가 승인 (결제 없이 승인 처리)
export const approveAdditionalFee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
    if (!guardian) throw new AppError('보호자 정보 없음', 404);

    const fee = await prisma.additionalFee.findUnique({
      where: { id },
      include: { contract: true },
    });
    if (!fee) throw new AppError('요청을 찾을 수 없습니다.', 404);
    if (fee.contract.guardianId !== guardian.id) throw new AppError('권한 없음', 403);

    const updated = await prisma.additionalFee.update({
      where: { id },
      data: { approvedByGuardian: true },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// POST /additional-fees/:id/reject - 보호자가 거절
export const rejectAdditionalFee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
    if (!guardian) throw new AppError('보호자 정보 없음', 404);
    const fee = await prisma.additionalFee.findUnique({
      where: { id },
      include: { contract: true },
    });
    if (!fee) throw new AppError('요청을 찾을 수 없습니다.', 404);
    if (fee.contract.guardianId !== guardian.id) throw new AppError('권한 없음', 403);
    await prisma.additionalFee.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
