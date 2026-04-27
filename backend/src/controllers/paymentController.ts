import { Response, NextFunction } from 'express';
import axios from 'axios';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { logAdminAction } from '../services/auditLog';
import { config } from '../config';
import { generateOrderId } from '../utils/generateCode';
import { sendEmail, emailPaymentCompleted } from '../services/emailService';
import { sendFromTemplate, renderTemplate, sendToAdmins } from '../services/notificationService';

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

    const { contractId, method, pointsUsed, useAllPoints, isRecurring, recurringWeek, testMode, extensionId } = req.body;

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

    // 연장 결제 모드: extension 검증
    let extension: any = null;
    if (extensionId) {
      extension = await prisma.contractExtension.findUnique({
        where: { id: extensionId },
      });
      if (!extension || extension.contractId !== contractId) {
        throw new AppError('연장 정보를 찾을 수 없습니다.', 404);
      }
      if (extension.status !== 'PENDING_PAYMENT') {
        throw new AppError(`이미 처리된 연장입니다. (${extension.status})`, 400);
      }
    }

    // 중복 결제 사전 체크 (빠른 경로 — 트랜잭션 밖 1차 가드)
    // 정확한 동시성 보장은 아래 $transaction 내부에서 수행
    const recentPending = await prisma.payment.findFirst({
      where: {
        contractId,
        status: { in: ['PENDING', 'COMPLETED', 'ESCROW'] },
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

    // 연장 결제: extension.additionalAmount 사용
    if (extension) {
      paymentAmount = extension.additionalAmount;
    }
    // 주 단위 결제인 경우
    else if (isRecurring && recurringWeek) {
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
      // 트랜지션 락: contract 행 잠금 + 트랜잭션 내부 재검증
      // (동시 두 요청이 모두 빠른 경로 가드를 통과해도 여기서 직렬화됨)
      await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${contractId} FOR UPDATE`;
      // PENDING 또는 DIRECT 즉시 완료 결제 모두 dedup 대상
      // (DIRECT 결제는 status=COMPLETED 로 바로 들어가므로 status 필터 없이 createdAt 만 확인)
      const dupCheck = await tx.payment.findFirst({
        where: {
          contractId,
          status: { in: ['PENDING', 'COMPLETED', 'ESCROW'] },
          createdAt: { gte: new Date(Date.now() - 10 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (dupCheck) {
        // 동시 요청에서 먼저 만들어진 결제 있으면 그것을 반환
        return dupCheck;
      }

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

      // 연장 결제: payment ↔ extension 연결
      if (extension) {
        await tx.contractExtension.update({
          where: { id: extension.id },
          data: { paymentId: newPayment.id },
        });
      }

      // 직접 결제의 경우 즉시 완료 처리
      if (method === 'DIRECT') {
        // 간병인 정산 생성 (% 수수료 + 고정 수수료)
        const platformFeeAmount = Math.round(amount * (contract.platformFee / 100)) + ((contract as any).platformFeeFixed || 0);
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

        // 연장 + DIRECT: 즉시 endDate 갱신 + extension CONFIRMED
        if (extension) {
          const now = new Date();
          await tx.contractExtension.update({
            where: { id: extension.id },
            data: { status: 'CONFIRMED', paidAt: now },
          });
          await tx.contract.update({
            where: { id: contractId },
            data: {
              endDate: extension.newEndDate,
              totalAmount: { increment: extension.additionalAmount },
              status: 'EXTENDED',
            },
          });
          await tx.careRequest.update({
            where: { id: contract.careRequestId },
            data: { endDate: extension.newEndDate },
          });
        }
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

    // 소유자 검증 (해당 결제의 보호자 본인 또는 ADMIN 만 confirm 가능)
    if (req.user!.role !== 'ADMIN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || payment.guardianId !== guardian.id) {
        throw new AppError('이 결제에 대한 권한이 없습니다.', 403);
      }
    }

    if (payment.status !== 'PENDING') {
      throw new AppError('이미 처리된 결제입니다.', 400);
    }

    // 금액 검증
    if (payment.totalAmount !== parseInt(amount)) {
      throw new AppError('결제 금액이 일치하지 않습니다.', 400);
    }

    // 트랜지션 락: tossPaymentKey 클레임으로 단일 요청만 토스 호출 진행
    // (동시 confirm 호출 시 한쪽만 클레임 성공, 다른쪽은 409)
    const claim = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING', tossPaymentKey: null },
      data: { tossPaymentKey: paymentKey },
    });
    if (claim.count === 0) {
      throw new AppError('이미 처리 중이거나 처리된 결제입니다.', 409);
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
        // 연장 결제인지 확인
        const linkedExtension = await prisma.contractExtension.findUnique({
          where: { paymentId: payment.id },
        });

        await prisma.$transaction(async (tx) => {
          // 결제 완료 처리 (트랜지션 락: 클레임된 status=PENDING + tossPaymentKey=paymentKey 만 통과)
          const finalize = await tx.payment.updateMany({
            where: { id: payment.id, status: 'PENDING', tossPaymentKey: paymentKey },
            data: {
              status: 'ESCROW',
              paidAt: new Date(),
            },
          });
          if (finalize.count === 0) {
            // 다른 요청이 이미 finalize 했거나 상태 변경됨 — 안전하게 종료
            throw new AppError('결제 완료 처리 중 충돌이 발생했습니다.', 409);
          }

          // 연장 결제: extension CONFIRMED + Contract.endDate 갱신
          if (linkedExtension && payment.contract) {
            const now = new Date();
            // 연장도 트랜지션 락 (PENDING_PAYMENT → CONFIRMED 만 1회 진행)
            const extResult = await tx.contractExtension.updateMany({
              where: { id: linkedExtension.id, status: 'PENDING_PAYMENT' },
              data: { status: 'CONFIRMED', paidAt: now },
            });
            if (extResult.count === 1) {
              // 우리 요청이 연장을 처음으로 CONFIRMED 시킨 경우에만 contract increment
              await tx.contract.update({
                where: { id: payment.contract.id },
                data: {
                  endDate: linkedExtension.newEndDate,
                  totalAmount: { increment: linkedExtension.additionalAmount },
                  status: 'EXTENDED',
                },
              });
              await tx.careRequest.update({
                where: { id: payment.contract.careRequestId },
                data: { endDate: linkedExtension.newEndDate },
              });
            }
          }
          // 일반 결제: 간병 요청 상태 업데이트
          else if (payment.contract) {
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
                  title: linkedExtension ? '연장 결제 완료' : '결제가 완료되었습니다',
                  body: linkedExtension
                    ? `연장 결제가 완료되어 ${linkedExtension.additionalDays}일 추가됩니다. (${parseInt(amount).toLocaleString()}원)`
                    : `결제가 완료되어 간병이 시작됩니다. 결제금액: ${parseInt(amount).toLocaleString()}원`,
                  data: { paymentId: payment.id, ...(linkedExtension && { extensionId: linkedExtension.id }) },
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
            where: { careRequests: { some: { contracts: { some: { id: payment.contractId! } } } } },
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

      // FAILED 마킹은 PENDING 일 때만 (이미 ESCROW 로 전이됐다면 overwrite 금지)
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });

      throw new AppError(errorMessage, 400);
    }
  } catch (error) {
    next(error);
  }
};

// POST /:id/refund - 환불 요청 (보호자) 또는 즉시 환불 (관리자)
// 보호자/간병인: 환불 요청만 생성 (PENDING) → 관리자가 approve/reject
// 관리자: 즉시 환불 실행
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
        contract: { include: { caregiver: { select: { userId: true } }, guardian: { select: { userId: true } } } },
        guardian: { include: { user: { select: { name: true } } } },
      },
    });
    if (!payment) throw new AppError('결제 정보를 찾을 수 없습니다.', 404);

    // 접근 권한
    const role = req.user!.role;
    const isAdmin = role === 'ADMIN';
    if (role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
      if (!guardian || payment.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (role === 'CAREGIVER') {
      // 간병인도 분쟁 상황에서 환불 요청 가능
      if (payment.contract?.caregiver?.userId !== req.user!.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (!isAdmin) {
      throw new AppError('접근 권한이 없습니다.', 403);
    }

    if (!['COMPLETED', 'ESCROW'].includes(payment.status)) {
      throw new AppError('환불할 수 없는 결제 상태입니다.', 400);
    }
    if (payment.refundRequestStatus === 'PENDING') {
      throw new AppError('이미 환불 요청이 접수되어 관리자 검토 중입니다.', 400);
    }

    const parsed = refundRequestAmount ? parseInt(refundRequestAmount) : null;
    if (parsed !== null) {
      if (parsed <= 0) throw new AppError('환불 금액은 1원 이상이어야 합니다.', 400);
      if (parsed > payment.totalAmount) {
        throw new AppError(`환불 금액은 원래 결제 금액(${payment.totalAmount.toLocaleString()}원)을 초과할 수 없습니다.`, 400);
      }
    }
    const refundAmount = parsed ?? payment.totalAmount;

    // ── 보호자/간병인: 환불 요청만 생성 (2단계 플로우)
    if (!isAdmin) {
      await prisma.payment.update({
        where: { id },
        data: {
          refundRequestStatus: 'PENDING',
          refundRequestedAt: new Date(),
          refundRequestedBy: req.user!.id,
          refundRequestReason: reason || '고객 요청에 의한 환불',
          refundRequestAmount: refundAmount,
        },
      });
      // 관리자 전원에게 푸시
      await sendToAdmins({
        key: 'REFUND_REQUEST_ADMIN',
        vars: {
          guardianName: payment.guardian?.user?.name || '사용자',
          amount: refundAmount.toLocaleString(),
          reason: reason || '고객 요청',
        },
        data: { paymentId: id, contractId: payment.contractId, refundRequest: true },
      }).catch(() => {});
      return res.json({
        success: true,
        data: { refundAmount, pending: true },
        message: '환불 요청이 접수되었습니다. 관리자 검토 후 처리됩니다.',
      });
    }

    // ── 관리자: 즉시 환불 실행
    await executeRefund(payment, refundAmount, reason || '관리자 직접 환불', req.user!.id);
    res.json({
      success: true,
      data: { refundAmount, isPartialRefund: refundAmount < payment.totalAmount },
      message: `${refundAmount.toLocaleString()}원이 환불 처리되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};

// 내부 유틸: 실제 환불 실행 (Toss cancel + Payment/Contract/Earning 동기화 + 알림)
async function executeRefund(
  payment: any,
  refundAmount: number,
  reason: string,
  reviewerUserId: string,
) {
  const isPartialRefund = refundAmount < payment.totalAmount;

  // 1) 토스페이먼츠 실환불
  if (payment.tossPaymentKey) {
    const secretKey = config.toss.secretKey;
    const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
    try {
      await axios.post(
        `https://api.tosspayments.com/v1/payments/${payment.tossPaymentKey}/cancel`,
        { cancelReason: reason, cancelAmount: refundAmount },
        { headers: { Authorization: `Basic ${encodedKey}`, 'Content-Type': 'application/json' } },
      );
    } catch (tossError: any) {
      const msg = tossError.response?.data?.message || '토스 환불 실패';
      throw new AppError(msg, 400);
    }
  }

  // 2) DB 연쇄 업데이트
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: isPartialRefund ? 'PARTIAL_REFUND' : 'REFUNDED',
        refundedAt: new Date(),
        refundAmount,
        refundReason: reason,
        refundRequestStatus: 'APPROVED',
        refundReviewedAt: new Date(),
        refundReviewedBy: reviewerUserId,
      },
    });

    // 포인트 복구
    if (payment.pointsUsed > 0 && payment.guardian?.userId) {
      await tx.user.update({
        where: { id: payment.guardian.userId },
        data: { points: { increment: payment.pointsUsed } },
      });
    }

    // 전액 환불일 때 연관 Contract 상태 연쇄 처리
    if (!isPartialRefund && payment.contract && payment.contract.status === 'ACTIVE') {
      await tx.contract.update({
        where: { id: payment.contract.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: reviewerUserId,
          cancellationReason: `전액 환불로 인한 계약 취소: ${reason}`,
        },
      });
      // 간병인 근무 상태 해제
      await tx.caregiver.update({
        where: { id: payment.contract.caregiverId },
        data: { workStatus: 'AVAILABLE' },
      });
      // CareApplication 정리
      await tx.careApplication.updateMany({
        where: {
          careRequestId: payment.contract.careRequestId,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        data: { status: 'CANCELLED' },
      });
    }

    // 미정산 Earning 차감/제거
    if (payment.contract) {
      const unpaidEarnings = await tx.earning.findMany({
        where: { contractId: payment.contract.id, isPaid: false },
      });
      if (unpaidEarnings.length > 0) {
        // 환불액 만큼 Earning에서 차감
        let remaining = refundAmount;
        for (const e of unpaidEarnings) {
          if (remaining <= 0) break;
          if (e.amount <= remaining) {
            await tx.earning.delete({ where: { id: e.id } });
            remaining -= e.amount;
          } else {
            const newAmount = e.amount - remaining;
            const newPlatformFee = Math.round(newAmount * ((payment.contract.platformFee || 10) / 100)) + ((payment.contract as any).platformFeeFixed || 0);
            const newTax = Math.round((newAmount - newPlatformFee) * ((payment.contract.taxRate || 3.3) / 100));
            await tx.earning.update({
              where: { id: e.id },
              data: {
                amount: newAmount,
                platformFee: newPlatformFee,
                taxAmount: newTax,
                netAmount: newAmount - newPlatformFee - newTax,
              },
            });
            remaining = 0;
          }
        }
      }
    }

  });

  // 트랜잭션 완료 후 템플릿 기반 푸시 발송
  const refundFormatted = refundAmount.toLocaleString();
  if (payment.guardian?.userId) {
    const gKey = isPartialRefund ? 'REFUND_PARTIAL_GUARDIAN' : 'REFUND_APPROVED_GUARDIAN';
    await sendFromTemplate({
      userId: payment.guardian.userId,
      key: gKey,
      vars: { refundAmount: refundFormatted },
      fallbackTitle: isPartialRefund ? '부분 환불 완료' : '환불 완료',
      fallbackBody: `${refundFormatted}원이 환불되었습니다.`,
      fallbackType: 'PAYMENT',
      data: { paymentId: payment.id },
    }).catch(() => {});
  }
  if (payment.contract?.caregiver?.userId) {
    const cKey = isPartialRefund ? 'REFUND_PARTIAL_CAREGIVER' : 'REFUND_APPROVED_CAREGIVER';
    await sendFromTemplate({
      userId: payment.contract.caregiver.userId,
      key: cKey,
      vars: { refundAmount: refundFormatted },
      fallbackTitle: isPartialRefund ? '부분 환불 발생' : '전액 환불 발생',
      fallbackBody: `${refundFormatted}원 환불이 발생했습니다. 정산에 영향이 있습니다.`,
      fallbackType: 'PAYMENT',
      data: { paymentId: payment.id, contractId: payment.contractId },
    }).catch(() => {});
  }
}

// POST /admin/payments/:id/refund-approve - 관리자: 환불 요청 승인 → 실제 환불
export const approveRefundRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        contract: { include: { caregiver: { select: { userId: true } }, guardian: { select: { userId: true } } } },
        guardian: { include: { user: { select: { name: true } } } },
      },
    });
    if (!payment) throw new AppError('결제 정보를 찾을 수 없습니다.', 404);
    if (payment.refundRequestStatus !== 'PENDING') {
      throw new AppError('처리 대기 중인 환불 요청이 아닙니다.', 400);
    }
    const refundAmount = payment.refundRequestAmount ?? payment.totalAmount;
    const reason = payment.refundRequestReason || '환불 요청 승인';

    // 트랜지션 락: refundReviewedAt=null 인 PENDING 만 클레임 (1회만 통과)
    // 동시 두 관리자 승인 시 한쪽만 executeRefund 진행
    const claim = await prisma.payment.updateMany({
      where: { id, refundRequestStatus: 'PENDING', refundReviewedAt: null },
      data: { refundReviewedAt: new Date(), refundReviewedBy: req.user!.id },
    });
    if (claim.count === 0) {
      throw new AppError('이미 처리 중이거나 처리된 환불 요청입니다.', 409);
    }

    try {
      await executeRefund(payment, refundAmount, reason, req.user!.id);
      // executeRefund 가 status='APPROVED' 로 최종 마킹
    } catch (e) {
      // 실패 시 락 해제 (재시도 가능)
      await prisma.payment.updateMany({
        where: { id, refundRequestStatus: 'PENDING' },
        data: { refundReviewedAt: null, refundReviewedBy: null },
      });
      throw e;
    }
    await logAdminAction(req, 'REFUND_APPROVE', {
      targetType: 'Payment', targetId: id,
      payload: { refundAmount, reason },
    });

    res.json({ success: true, data: { refundAmount }, message: '환불이 승인·처리되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// POST /admin/payments/:id/refund-reject - 관리자: 환불 요청 거절
export const rejectRefundRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { guardian: { select: { userId: true } } },
    });
    if (!payment) throw new AppError('결제 정보를 찾을 수 없습니다.', 404);
    if (payment.refundRequestStatus !== 'PENDING') {
      throw new AppError('처리 대기 중인 환불 요청이 아닙니다.', 400);
    }

    // 트랜지션 락: PENDING 인 경우에만 REJECTED 로 1회 전이
    const lock = await prisma.payment.updateMany({
      where: { id, refundRequestStatus: 'PENDING' },
      data: {
        refundRequestStatus: 'REJECTED',
        refundReviewedAt: new Date(),
        refundReviewedBy: req.user!.id,
        refundRejectReason: reason || '환불 불가',
      },
    });
    if (lock.count === 0) {
      throw new AppError('이미 처리된 환불 요청입니다.', 409);
    }

    if (payment.guardian?.userId) {
      await sendFromTemplate({
        userId: payment.guardian.userId,
        key: 'REFUND_REJECTED',
        vars: { reason: reason || '환불 불가' },
        fallbackTitle: '환불 요청 거절',
        fallbackBody: `환불 요청이 거절되었습니다. ${reason ? '사유: ' + reason : ''}`,
        fallbackType: 'PAYMENT',
        data: { paymentId: id },
      }).catch(() => {});
    }

    await logAdminAction(req, 'REFUND_REJECT', {
      targetType: 'Payment', targetId: id,
      payload: { reason: reason || null },
    });

    res.json({ success: true, message: '환불 요청이 거절되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// GET /admin/refund-requests - 관리자: 환불 요청 목록
export const getRefundRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = (req.query.status as string) || 'PENDING';
    const payments = await prisma.payment.findMany({
      where: { refundRequestStatus: status as any },
      include: {
        contract: {
          include: {
            caregiver: { include: { user: { select: { name: true } } } },
            careRequest: { include: { patient: { select: { name: true } } } },
          },
        },
        guardian: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { refundRequestedAt: 'desc' },
    });
    res.json({
      success: true,
      data: payments.map((p) => ({
        id: p.id,
        guardianName: p.guardian?.user?.name,
        guardianPhone: p.guardian?.user?.phone,
        caregiverName: p.contract?.caregiver?.user?.name,
        patientName: p.contract?.careRequest?.patient?.name,
        totalAmount: p.totalAmount,
        refundRequestAmount: p.refundRequestAmount,
        refundRequestReason: p.refundRequestReason,
        refundRequestedAt: p.refundRequestedAt,
        refundRequestStatus: p.refundRequestStatus,
        refundRejectReason: p.refundRejectReason,
        method: p.method,
        paidAt: p.paidAt,
      })),
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
    const contractId = req.query.contractId as string | undefined;

    let whereClause: any = {};

    if (contractId) {
      whereClause.contractId = contractId;
    }

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

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.tossOrderId}.pdf"`);
    doc.pipe(res);

    if (fs.existsSync(FONT_REGULAR)) doc.registerFont('Kor', FONT_REGULAR);
    if (fs.existsSync(FONT_BOLD)) doc.registerFont('KorBold', FONT_BOLD);

    // ── 디자인 토큰
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const M = 48;                 // 좌우 여백
    const C = PAGE_W - M * 2;     // 본문 너비
    const PRIMARY = '#1E3A5F';
    const ACCENT = '#0F766E';     // 청록 — 결제 완료 강조
    const TEXT = '#0F172A';
    const SUB = '#64748B';
    const BORDER = '#E2E8F0';
    const BG_SOFT = '#F8FAFC';
    const BG_HEAD = '#F1F5F9';

    const guardian = payment.contract?.guardian.user;
    const patient = payment.contract?.careRequest.patient;
    const caregiver = payment.contract?.caregiver.user;

    const methodLabel = ({ CARD: '신용카드', BANK_TRANSFER: '무통장입금', DIRECT: '직접결제' } as any)[payment.method] || payment.method;
    const paidStr = payment.paidAt
      ? new Date(payment.paidAt).toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' })
      : new Date(payment.createdAt).toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' });
    const issuedStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    // ── 1. 상단 컬러 밴드 + 브랜드
    doc.rect(0, 0, PAGE_W, 96).fill(PRIMARY);
    doc.font('KorBold').fontSize(20).fillColor('#FFFFFF').text('CAREMATCH', M, 30);
    doc.font('Kor').fontSize(9).fillColor('#CBD5E0').text('케어매치 주식회사 · 간병인 매칭 플랫폼', M, 56);

    // 우측: 영수증 타이틀
    doc.font('KorBold').fontSize(15).fillColor('#FFFFFF')
      .text('PAYMENT  RECEIPT', M, 28, { width: C, align: 'right', characterSpacing: 1.5 });
    doc.font('Kor').fontSize(8).fillColor('#CBD5E0')
      .text('전자 결제 영수증', M, 50, { width: C, align: 'right' });
    doc.fontSize(9).fillColor('#FFFFFF')
      .text(`발행일  ${issuedStr}`, M, 66, { width: C, align: 'right' });

    // ── 2. 영수증 번호 강조 박스
    let y = 116;
    doc.roundedRect(M, y, C, 56, 6).fillAndStroke(BG_SOFT, BORDER);
    doc.font('Kor').fontSize(8).fillColor(SUB).text('영수증 번호', M + 16, y + 10);
    doc.font('KorBold').fontSize(13).fillColor(TEXT).text(payment.tossOrderId || payment.id.slice(0, 18), M + 16, y + 24);
    // 우측 결제 완료 배지
    const badgeW = 110, badgeH = 30, badgeX = PAGE_W - M - 16 - badgeW, badgeY = y + 13;
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 15).fill(ACCENT);
    doc.font('KorBold').fontSize(11).fillColor('#FFFFFF')
      .text(payment.status === 'ESCROW' ? '에스크로 보관' : '결제 완료', badgeX, badgeY + 8, { width: badgeW, align: 'center' });

    y += 56 + 22;

    // ── 3. 받는 분 / 공급자 (2컬럼)
    const colW = (C - 14) / 2;
    const drawPartyBox = (x: number, title: string, lines: { k: string; v: string }[]) => {
      doc.roundedRect(x, y, colW, 110, 6).fillAndStroke('#FFFFFF', BORDER);
      // 헤더
      doc.rect(x, y, colW, 26).fill(BG_HEAD);
      doc.font('KorBold').fontSize(9).fillColor(PRIMARY).text(title, x + 14, y + 9);
      // 라인
      let ly = y + 36;
      for (const ln of lines) {
        doc.font('Kor').fontSize(8).fillColor(SUB).text(ln.k, x + 14, ly, { width: 50 });
        doc.font('Kor').fontSize(9).fillColor(TEXT).text(ln.v || '-', x + 70, ly, { width: colW - 84 });
        ly += 18;
      }
    };
    drawPartyBox(M, '받는 분 (BILL TO)', [
      { k: '성명', v: guardian?.name || '-' },
      { k: '연락처', v: guardian?.phone || '-' },
      { k: '이메일', v: guardian?.email || '-' },
      { k: '환자', v: patient?.name || '-' },
    ]);
    drawPartyBox(M + colW + 14, '공급자 (PROVIDER)', [
      { k: '상호', v: '케어매치 주식회사' },
      { k: '등록번호', v: '173-81-03376' },
      { k: '대표', v: '관리자' },
      { k: '간병인', v: caregiver?.name || '-' },
    ]);
    y += 110 + 24;

    // ── 4. 서비스 / 결제 금액 표
    // 헤더 행
    const colSvc = C - 110 - 110; // 항목 / 단위 / 금액
    doc.rect(M, y, C, 28).fill(BG_HEAD);
    doc.lineWidth(0.5).strokeColor(BORDER).rect(M, y, C, 28).stroke();
    doc.font('KorBold').fontSize(9).fillColor(PRIMARY)
      .text('항목 (DESCRIPTION)', M + 14, y + 9);
    doc.text('수량/단위', M + 14 + colSvc, y + 9, { width: 110, align: 'center' });
    doc.text('금액 (KRW)', M + 14 + colSvc + 110, y + 9, { width: 110 - 14, align: 'right' });
    y += 28;

    // 데이터 행 그리는 헬퍼
    const drawAmtRow = (label: string, qty: string, amt: string, opts?: { bold?: boolean; bg?: string; color?: string; size?: number }) => {
      const h = opts?.size === 13 ? 38 : 30;
      if (opts?.bg) {
        doc.rect(M, y, C, h).fill(opts.bg);
      }
      doc.lineWidth(0.5).strokeColor(BORDER).moveTo(M, y + h).lineTo(M + C, y + h).stroke();
      const font = opts?.bold ? 'KorBold' : 'Kor';
      const size = opts?.size || 10;
      const color = opts?.color || TEXT;
      const yMid = y + (h - size) / 2 - 1;
      doc.font(font).fontSize(size).fillColor(color).text(label, M + 14, yMid, { width: colSvc - 14 });
      doc.font('Kor').fontSize(9).fillColor(SUB).text(qty, M + 14 + colSvc, yMid + (size - 9) / 2, { width: 110, align: 'center' });
      doc.font(font).fontSize(size).fillColor(color).text(amt, M + 14 + colSvc + 110, yMid, { width: 110 - 14, align: 'right' });
      y += h;
    };

    // 간병 서비스 (메인 라인)
    const ct = payment.contract;
    let svcLabel = '간병 서비스 이용료';
    let svcQty = '-';
    if (ct?.startDate && ct?.endDate) {
      const days = Math.max(1, Math.ceil((new Date(ct.endDate).getTime() - new Date(ct.startDate).getTime()) / 86400000));
      svcQty = `${days}일`;
      const sd = new Date(ct.startDate).toLocaleDateString('ko-KR');
      const ed = new Date(ct.endDate).toLocaleDateString('ko-KR');
      svcLabel = `간병 서비스 (${sd} ~ ${ed})`;
    }
    drawAmtRow(svcLabel, svcQty, `${payment.amount.toLocaleString()}원`);

    // VAT
    if (payment.vatAmount > 0) {
      drawAmtRow('부가가치세 (VAT 10%)', '-', `${payment.vatAmount.toLocaleString()}원`);
    }

    // 포인트 사용 (할인)
    if (payment.pointsUsed > 0) {
      drawAmtRow('포인트 사용', '-', `-${payment.pointsUsed.toLocaleString()}원`, { color: '#2563EB' });
    }

    // 합계 (강조)
    drawAmtRow(
      '총 결제금액',
      payment.method === 'CARD' && payment.vatAmount === 0 ? '(VAT 별도)' : '(VAT 포함)',
      `${payment.totalAmount.toLocaleString()}원`,
      { bold: true, bg: BG_SOFT, color: PRIMARY, size: 13 },
    );

    y += 24;

    // ── 5. 결제 정보 박스
    doc.roundedRect(M, y, C, 80, 6).fillAndStroke('#FFFFFF', BORDER);
    doc.font('KorBold').fontSize(9).fillColor(PRIMARY).text('결제 정보', M + 14, y + 12);
    // 3 컬럼
    const infoColW = (C - 28) / 3;
    const infoY = y + 32;
    const drawInfoCol = (idx: number, k: string, v: string) => {
      const x = M + 14 + idx * infoColW;
      doc.font('Kor').fontSize(8).fillColor(SUB).text(k, x, infoY);
      doc.font('KorBold').fontSize(10).fillColor(TEXT).text(v, x, infoY + 14, { width: infoColW - 8 });
    };
    drawInfoCol(0, '결제 수단', methodLabel);
    drawInfoCol(1, '결제 일시', paidStr);
    drawInfoCol(2, '거래 ID', (payment.tossPaymentKey || payment.tossOrderId || '').slice(0, 22));
    y += 80 + 24;

    // ── 6. 환불 정보 (있을 때만)
    if (payment.refundAmount && payment.refundedAt) {
      doc.roundedRect(M, y, C, 60, 6).fillAndStroke('#FEF2F2', '#FCA5A5');
      doc.font('KorBold').fontSize(9).fillColor('#B91C1C').text('환불 처리 내역', M + 14, y + 12);
      doc.font('Kor').fontSize(9).fillColor('#7F1D1D')
        .text(`환불 금액: ${payment.refundAmount.toLocaleString()}원  ·  처리일: ${new Date(payment.refundedAt).toLocaleString('ko-KR')}`, M + 14, y + 30);
      if (payment.refundReason) {
        doc.fontSize(8).text(`사유: ${payment.refundReason}`, M + 14, y + 44, { width: C - 28 });
      }
      y += 60 + 16;
    }

    // ── 7. 안내 문구
    if (y > PAGE_H - 130) { doc.addPage(); y = M; }
    doc.font('Kor').fontSize(8).fillColor(SUB)
      .text(
        '※ 본 영수증은 전자적으로 발행된 문서이며, 별도의 서명·날인 없이 효력을 가집니다. 부가세 신고 자료로 사용 가능합니다.',
        M, y, { width: C, align: 'left' },
      );
    y += 14;
    doc.text(
      '※ 환불 및 취소 문의는 케어매치 고객센터를 통해 접수해주시기 바라며, 관련 법령(전자상거래법, 개인정보보호법)에 따라 일정 기간 보관됩니다.',
      M, y, { width: C, align: 'left' },
    );

    // ── 8. 하단 회사 정보 + 인감 자리
    const bottomY = PAGE_H - 110;
    doc.lineWidth(0.5).strokeColor(BORDER).moveTo(M, bottomY).lineTo(M + C, bottomY).stroke();
    doc.font('KorBold').fontSize(10).fillColor(PRIMARY).text('케어매치 주식회사', M, bottomY + 14);
    doc.font('Kor').fontSize(8).fillColor(SUB)
      .text('사업자등록번호: 173-81-03376', M, bottomY + 32);
    doc.text('통신판매업: 제2025-0000호  ·  대표이사: 관리자', M, bottomY + 46);
    doc.text('고객센터 운영시간: 평일 09:30~17:30 (점심 12:00~13:00)', M, bottomY + 60);

    // 인감
    const stampX = PAGE_W - M - 80;
    const stampY = bottomY + 14;
    doc.lineWidth(2).strokeColor('#DC2626').circle(stampX + 40, stampY + 40, 36).stroke();
    doc.font('KorBold').fontSize(11).fillColor('#DC2626')
      .text('CAREMATCH', stampX, stampY + 22, { width: 80, align: 'center', characterSpacing: 1 });
    doc.fontSize(8).text('확  인', stampX, stampY + 44, { width: 80, align: 'center' });

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
      include: { guardian: { select: { userId: true } } },
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

    // 보호자 알림 (guardian.userId → User.id)
    await sendFromTemplate({
      userId: contract.guardian.userId,
      key: 'ADDITIONAL_FEE_REQUEST',
      vars: {
        amount: parseInt(amount).toLocaleString(),
        reason: String(reason).trim(),
      },
      data: { feeId: fee.id, contractId },
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
    // 간병인 보기: 본인이 요청한 건
    if (role === 'CAREGIVER') {
      const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
      if (!caregiver) throw new AppError('간병인 정보 없음', 404);
      fees = await prisma.additionalFee.findMany({
        where: { requestedBy: caregiver.id },
        include: { contract: { include: { careRequest: { include: { patient: { select: { name: true } } } } } } },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // 보호자 보기 (ADMIN도 Guardian 레코드 있으면 허용)
      const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
      if (!guardian) {
        // ADMIN이면서 Guardian 없으면 전체 목록 반환
        if (role === 'ADMIN') {
          fees = await prisma.additionalFee.findMany({
            include: { contract: { include: { careRequest: { include: { patient: { select: { name: true } } } } } } },
            orderBy: { createdAt: 'desc' },
          });
        } else {
          throw new AppError('보호자 정보 없음', 404);
        }
      } else {
        fees = await prisma.additionalFee.findMany({
          where: { contract: { guardianId: guardian.id } },
          include: { contract: { include: { careRequest: { include: { patient: { select: { name: true } } } } } } },
          orderBy: { createdAt: 'desc' },
        });
      }
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
      include: { contract: { include: { caregiver: { select: { userId: true } } } } },
    });
    if (!fee) throw new AppError('요청을 찾을 수 없습니다.', 404);
    if (fee.contract.guardianId !== guardian.id) throw new AppError('권한 없음', 403);

    // 트랜지션 락: 미승인+미거절 상태에서만 1회 승인
    const claim = await prisma.additionalFee.updateMany({
      where: { id, approvedByGuardian: false, rejected: false },
      data: { approvedByGuardian: true },
    });
    if (claim.count === 0) {
      throw new AppError('이미 처리된 추가비 요청입니다.', 409);
    }
    const updated = await prisma.additionalFee.findUnique({ where: { id } });
    // 간병인 알림
    await sendFromTemplate({
      userId: fee.contract.caregiver.userId,
      key: 'ADDITIONAL_FEE_APPROVED',
      vars: { amount: fee.amount.toLocaleString() },
      data: { feeId: id, contractId: fee.contractId } as any,
    }).catch(() => {});
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// POST /additional-fees/:id/reject - 보호자가 거절 (이력 보존)
export const rejectAdditionalFee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
    if (!guardian) throw new AppError('보호자 정보 없음', 404);
    const fee = await prisma.additionalFee.findUnique({
      where: { id },
      include: { contract: { include: { caregiver: { select: { userId: true } } } } },
    });
    if (!fee) throw new AppError('요청을 찾을 수 없습니다.', 404);
    if (fee.contract.guardianId !== guardian.id) throw new AppError('권한 없음', 403);
    // 트랜지션 락: 미승인+미거절 상태에서만 1회 거절
    const claim = await prisma.additionalFee.updateMany({
      where: { id, approvedByGuardian: false, rejected: false },
      data: { rejected: true, rejectReason: reason || null },
    });
    if (claim.count === 0) {
      throw new AppError('이미 처리된 추가비 요청입니다.', 409);
    }
    const updated = await prisma.additionalFee.findUnique({ where: { id } });
    // 간병인 알림
    await sendFromTemplate({
      userId: fee.contract.caregiver.userId,
      key: 'ADDITIONAL_FEE_REJECTED',
      vars: {
        amount: fee.amount.toLocaleString(),
        reasonSuffix: reason ? ' 사유: ' + reason : '',
      },
      data: { contractId: fee.contractId, feeId: id, rejectReason: reason } as any,
    }).catch(() => {});
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
