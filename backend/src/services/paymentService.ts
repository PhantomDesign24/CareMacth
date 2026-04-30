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

  // 1단계: 에스크로 결제 release 를 먼저 시도. 모두 실패하면 Earning 생성하지 않음
  //   — Earning 선생성 후 release 실패 시 장부-실자금 불일치 발생하던 버그 해결
  let escrowAttempted = 0;
  let escrowReleased = 0;
  const releasedPayments: typeof contract.payments = [];
  const stillEscrowPayments: typeof contract.payments = [];
  const nonEscrowPayments: typeof contract.payments = [];

  for (const payment of contract.payments) {
    if (payment.status === 'ESCROW' && payment.tossPaymentKey) {
      escrowAttempted += 1;
      try {
        await axios.post(
          `${TOSS_API_URL}/payments/${payment.tossPaymentKey}/release`,
          {},
          { headers: { Authorization: getTossAuthHeader(), 'Content-Type': 'application/json' } },
        );
        escrowReleased += 1;
        releasedPayments.push(payment);
      } catch (error: any) {
        console.error(`[settleEarning] Toss release 실패 (payment=${payment.id}):`, error?.response?.data || error?.message);
        stillEscrowPayments.push(payment);
      }
    } else {
      nonEscrowPayments.push(payment);
    }
  }

  // 모든 ESCROW 가 release 실패 + non-escrow 도 없으면 → Earning 생성하지 않고 종료
  if (escrowAttempted > 0 && escrowReleased === 0 && nonEscrowPayments.length === 0) {
    console.warn(`[settleEarning] contract=${contractId}: 모든 escrow release 실패, Earning 미생성. 후속 cron/관리자 reconcile 필요`);
    return null;
  }

  // 정산 일수 — 계약의 실제 startDate~endDate 기준 (연장이 endDate 를 갱신하므로 자동으로 포함)
  const settleDays = Math.max(1, Math.ceil((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / 86400000));
  const calc = calculateEarning({
    amount: remainingAmount,
    platformFeePercent: contract.platformFee,
    platformFeeFixed: (contract as any).platformFeeFixed || 0,
    durationDays: settleDays,
    taxRate: contract.taxRate,
  });

  // 2단계: release 성공 후에 Earning + Payment 상태를 트랜잭션으로 일괄 처리
  const earning = await prisma.$transaction(async (tx) => {
    const createdEarning = await tx.earning.create({
      data: {
        caregiverId: contract.caregiverId,
        contractId: contract.id,
        amount: calc.amount,
        platformFee: calc.platformFee,
        taxAmount: calc.taxAmount,
        netAmount: calc.netAmount,
      },
    });
    // release 성공한 ESCROW → COMPLETED + paidAt
    for (const p of releasedPayments) {
      await tx.payment.update({
        where: { id: p.id },
        data: { status: 'COMPLETED', paidAt: new Date() },
      });
    }
    // 비-ESCROW 중 아직 COMPLETED 아닌 건 (이론상 거의 없음) — 정합성 정리
    for (const p of nonEscrowPayments) {
      if (p.status !== 'COMPLETED') {
        await tx.payment.update({ where: { id: p.id }, data: { status: 'COMPLETED' } });
      }
    }
    // release 실패한 ESCROW 는 ESCROW 유지 — 다음 cron 에서 재시도 (Earning 은 잔여금 기준으로 다시 계산됨)
    return createdEarning;
  });
  if (stillEscrowPayments.length > 0) {
    console.warn(`[settleEarning] contract=${contractId}: ${stillEscrowPayments.length}건 ESCROW 유지 (release 실패), 잔여 정산은 다음 cron 에서 처리`);
  }

  return earning;
}
