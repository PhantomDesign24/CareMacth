// 간병인 정산 단일 계산 함수.
// 모든 정산/환불/중간정산 경로가 이 함수를 사용해야 동일한 결과를 보장한다.
//
// taxBase = amount - platformFee  (원천징수는 수수료 차감 후 잔액 기준)

export interface EarningCalcInput {
  amount: number;                  // 정산 base (간병인 귀속 금액)
  platformFeePercent: number;      // 플랫폼 수수료율 (0~100)
  platformFeeFixed?: number;       // 플랫폼 정액 수수료 (1일 기준)
  durationDays?: number;           // 정액 수수료 곱할 일수 (기본 1)
  taxRate: number;                 // 원천징수율 (0~100, 보통 3.3)
}

export interface EarningCalcResult {
  amount: number;
  platformFee: number;
  taxAmount: number;
  netAmount: number;               // 간병인 실수령액
}

export function calculateEarning(input: EarningCalcInput): EarningCalcResult {
  const { amount, platformFeePercent, platformFeeFixed = 0, durationDays = 1, taxRate } = input;
  if (amount <= 0) {
    return { amount: 0, platformFee: 0, taxAmount: 0, netAmount: 0 };
  }
  // 정액 수수료는 1일 단가 × 일수 (예: 15,000원 × 7일 = 105,000원)
  const safeDays = Math.max(1, Math.floor(durationDays));
  const fixedTotal = (platformFeeFixed || 0) * safeDays;
  const platformFee = Math.round(amount * (platformFeePercent / 100)) + fixedTotal;
  const taxBase = Math.max(0, amount - platformFee);
  const taxAmount = Math.round(taxBase * (taxRate / 100));
  const netAmount = Math.max(0, amount - platformFee - taxAmount);
  return { amount, platformFee, taxAmount, netAmount };
}
