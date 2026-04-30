import axios from 'axios';
import { config } from '../config';
import { calculateEarning } from '../utils/earning';
import { prisma } from '../app';

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

function getTossAuthHeader(): string {
  const encoded = Buffer.from(`${config.toss.secretKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

// 간병인 정산 (종료 후 익일) — 중간정산이 있으면 잔여분만 생성
export async function settleEarning(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      payments: { where: { status: { in: ['ESCROW', 'COMPLETED'] } } },
      careRequest: true,
      additionalFees: { where: { approvedByGuardian: true, paid: true } },
      earnings: true,
    },
  });

  if (!contract) {
    throw new Error('계약을 찾을 수 없습니다.');
  }

  const totalPaid = contract.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalAdditionalFees = contract.additionalFees.reduce((sum, f) => sum + f.amount, 0);
  const totalEarnable = totalPaid + totalAdditionalFees;

  // 이미 생성된 Earning(중간정산 포함) 차감
  const alreadySettled = contract.earnings.reduce((s, e) => s + e.amount, 0);
  const remainingAmount = totalEarnable - alreadySettled;

  if (remainingAmount <= 0) {
    // 더 이상 정산할 금액이 없음 → Earning 새로 만들지 않고 에스크로만 정리
    for (const payment of contract.payments) {
      if (payment.status === 'ESCROW' && payment.tossPaymentKey) {
        try {
          await axios.post(
            `${TOSS_API_URL}/payments/${payment.tossPaymentKey}/release`,
            {},
            { headers: { Authorization: getTossAuthHeader(), 'Content-Type': 'application/json' } },
          );
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'COMPLETED', paidAt: new Date() },
          });
        } catch {
          // best-effort
        }
      }
    }
    return null;
  }

  const calc = calculateEarning({
    amount: remainingAmount,
    platformFeePercent: contract.platformFee,
    platformFeeFixed: (contract as any).platformFeeFixed || 0,
    taxRate: contract.taxRate,
  });

  const earning = await prisma.earning.create({
    data: {
      caregiverId: contract.caregiverId,
      contractId: contract.id,
      amount: calc.amount,
      platformFee: calc.platformFee,
      taxAmount: calc.taxAmount,
      netAmount: calc.netAmount,
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
          },
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
