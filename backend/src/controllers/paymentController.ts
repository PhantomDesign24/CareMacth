import { Response, NextFunction } from 'express';
import axios from 'axios';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { config } from '../config';
import { generateOrderId } from '../utils/generateCode';

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

    const { contractId, method, pointsUsed, useAllPoints, isRecurring, recurringWeek } = req.body;

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

    // 금액 계산
    let paymentAmount = contract.totalAmount;

    // 주 단위 결제인 경우
    if (isRecurring && recurringWeek) {
      paymentAmount = contract.dailyRate * 7;
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
    const vatAmount = Math.round(amount / 11);
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
