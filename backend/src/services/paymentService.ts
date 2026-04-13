import axios from 'axios';
import { PaymentMethod } from '@prisma/client';
import { config } from '../config';
import { generateOrderId } from '../utils/generateCode';
import { prisma } from '../app';

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

function getTossAuthHeader(): string {
  const encoded = Buffer.from(`${config.toss.secretKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

interface CreatePaymentParams {
  contractId: string;
  guardianId: string;
  amount: number;
  method: PaymentMethod;
  pointsToUse?: number;
  isRecurring?: boolean;
  recurringWeek?: number;
}

// 결제 생성 (에스크로)
export async function createPayment(params: CreatePaymentParams) {
  const { contractId, guardianId, amount, method, pointsToUse = 0, isRecurring, recurringWeek } = params;

  // 포인트 차감
  if (pointsToUse > 0) {
    const guardian = await prisma.guardian.findUnique({
      where: { id: guardianId },
      include: { user: true },
    });
    if (!guardian || guardian.user.points < pointsToUse) {
      throw new Error('포인트가 부족합니다.');
    }
    await prisma.user.update({
      where: { id: guardian.userId },
      data: { points: { decrement: pointsToUse } },
    });
  }

  const actualAmount = amount - pointsToUse;
  const vatAmount = Math.round(actualAmount / 11); // VAT 별도
  const totalAmount = actualAmount + vatAmount;

  const orderId = generateOrderId();

  const payment = await prisma.payment.create({
    data: {
      contractId,
      guardianId,
      amount: actualAmount,
      vatAmount,
      totalAmount,
      method,
      status: 'PENDING',
      tossOrderId: orderId,
      pointsUsed: pointsToUse,
      isRecurring: isRecurring || false,
      recurringWeek,
    },
  });

  // 무통장입금인 경우 가상계좌 발급
  if (method === 'BANK_TRANSFER') {
    try {
      const response = await axios.post(
        `${TOSS_API_URL}/virtual-accounts`,
        {
          amount: totalAmount,
          orderId,
          orderName: '간병 서비스 이용료',
          customerName: '보호자',
          bank: '우리',
          validHours: 72,
        },
        {
          headers: {
            Authorization: getTossAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          tossPaymentKey: response.data.paymentKey,
          status: 'ESCROW',
        },
      });
    } catch (error) {
      console.error('가상계좌 발급 실패:', error);
    }
  }

  return payment;
}

// 토스페이먼츠 결제 확인
export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const response = await axios.post(
    `${TOSS_API_URL}/payments/confirm`,
    { paymentKey, orderId, amount },
    {
      headers: {
        Authorization: getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
    }
  );

  const payment = await prisma.payment.findUnique({
    where: { tossOrderId: orderId },
  });

  if (!payment) {
    throw new Error('결제 정보를 찾을 수 없습니다.');
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      tossPaymentKey: paymentKey,
      status: 'ESCROW',
      paidAt: new Date(),
    },
  });

  return response.data;
}

// 환불 처리
export async function processRefund(
  paymentId: string,
  reason: string,
  partialAmount?: number
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error('결제 정보를 찾을 수 없습니다.');
  }

  const refundAmount = partialAmount || payment.totalAmount;

  if (payment.tossPaymentKey) {
    await axios.post(
      `${TOSS_API_URL}/payments/${payment.tossPaymentKey}/cancel`,
      {
        cancelReason: reason,
        cancelAmount: refundAmount,
      },
      {
        headers: {
          Authorization: getTossAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    );
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: partialAmount ? 'PARTIAL_REFUND' : 'REFUNDED',
      refundedAt: new Date(),
      refundAmount,
      refundReason: reason,
    },
  });

  // 포인트 복원
  if (payment.pointsUsed > 0) {
    const guardian = await prisma.guardian.findUnique({
      where: { id: payment.guardianId },
    });
    if (guardian) {
      await prisma.user.update({
        where: { id: guardian.userId },
        data: { points: { increment: payment.pointsUsed } },
      });
    }
  }
}

// 간병인 정산 (종료 후 익일)
export async function settleEarning(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      payments: { where: { status: { in: ['ESCROW', 'COMPLETED'] } } },
      careRequest: true,
      additionalFees: { where: { approvedByGuardian: true, paid: true } },
    },
  });

  if (!contract) {
    throw new Error('계약을 찾을 수 없습니다.');
  }

  const totalPaid = contract.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalAdditionalFees = contract.additionalFees.reduce((sum, f) => sum + f.amount, 0);
  const totalEarnable = totalPaid + totalAdditionalFees;
  const platformFee = Math.round(totalEarnable * (contract.platformFee / 100));
  const taxAmount = Math.round((totalEarnable - platformFee) * (contract.taxRate / 100));
  const netAmount = totalEarnable - platformFee - taxAmount;

  const earning = await prisma.earning.create({
    data: {
      caregiverId: contract.caregiverId,
      contractId: contract.id,
      amount: totalEarnable,
      platformFee,
      taxAmount,
      netAmount,
    },
  });

  // 에스크로 결제 완료 처리
  for (const payment of contract.payments) {
    if (payment.status === 'ESCROW' && payment.tossPaymentKey) {
      try {
        await axios.post(
          `${TOSS_API_URL}/payments/${payment.tossPaymentKey}/release`,
          {},
          {
            headers: {
              Authorization: getTossAuthHeader(),
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error('에스크로 해제 실패:', error);
      }
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });
  }

  return earning;
}

// 일할 계산 (중도 해지 시)
export async function calculateProrated(
  contractId: string,
  endDate: Date
): Promise<{ workedDays: number; totalDays: number; proratedAmount: number; refundAmount: number }> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });

  if (!contract) {
    throw new Error('계약을 찾을 수 없습니다.');
  }

  const totalDays = Math.ceil(
    (contract.endDate.getTime() - contract.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const workedDays = Math.ceil(
    (endDate.getTime() - contract.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dailyRate = contract.totalAmount / totalDays;
  const proratedAmount = Math.round(dailyRate * workedDays);
  const refundAmount = contract.totalAmount - proratedAmount;

  return { workedDays, totalDays, proratedAmount, refundAmount };
}

// 추가 비용 요청
export async function requestAdditionalFee(
  contractId: string,
  caregiverId: string,
  amount: number,
  reason: string
) {
  return prisma.additionalFee.create({
    data: {
      contractId,
      amount,
      reason,
      requestedBy: caregiverId,
    },
  });
}
