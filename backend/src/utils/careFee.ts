// 간병비 산출 룰 — PlatformConfig 의 careFee* 필드 기반
// 등급 결정 우선순위:
//   1. 감염성 질환 YES → 고위험 (감염) base
//   2. 석션/치매/마비욕창 중 하나 이상 YES → 고위험 base
//   3. 편마비 YES (다른 고위험 없음) → 중증 base
//   4. 모두 NO → 경증 base
// 가산: 70kg 이상 / 기저귀 사용 시 각각 +surchargeHeavy / +surchargeDiaper
// 범위: min = avg - minOffset, max = avg + maxOffset
import { prisma } from '../app';

export type CareFeeRules = {
  baseLight: number;
  baseMedium: number;
  baseHigh: number;
  baseHighInfection: number;
  minOffset: number;
  maxOffset: number;
  surchargeHeavy: number;
  surchargeDiaper: number;
  avgDays: number;
};

const DEFAULT_RULES: CareFeeRules = {
  baseLight: 130000,
  baseMedium: 140000,
  baseHigh: 160000,
  baseHighInfection: 180000,
  minOffset: 10000,
  maxOffset: 20000,
  surchargeHeavy: 5000,
  surchargeDiaper: 5000,
  avgDays: 6.2,
};

let cached: { rules: CareFeeRules; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1분 캐시

export async function getCareFeeRules(): Promise<CareFeeRules> {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.rules;
  try {
    const cfg = await prisma.platformConfig.findFirst();
    if (!cfg) {
      cached = { rules: DEFAULT_RULES, loadedAt: Date.now() };
      return DEFAULT_RULES;
    }
    const rules: CareFeeRules = {
      baseLight: (cfg as any).careFeeBaseLight ?? DEFAULT_RULES.baseLight,
      baseMedium: (cfg as any).careFeeBaseMedium ?? DEFAULT_RULES.baseMedium,
      baseHigh: (cfg as any).careFeeBaseHigh ?? DEFAULT_RULES.baseHigh,
      baseHighInfection: (cfg as any).careFeeBaseHighInfection ?? DEFAULT_RULES.baseHighInfection,
      minOffset: (cfg as any).careFeeMinOffset ?? DEFAULT_RULES.minOffset,
      maxOffset: (cfg as any).careFeeMaxOffset ?? DEFAULT_RULES.maxOffset,
      surchargeHeavy: (cfg as any).careFeeSurchargeHeavy ?? DEFAULT_RULES.surchargeHeavy,
      surchargeDiaper: (cfg as any).careFeeSurchargeDiaper ?? DEFAULT_RULES.surchargeDiaper,
      avgDays: (cfg as any).careFeeAvgDays ?? DEFAULT_RULES.avgDays,
    };
    cached = { rules, loadedAt: Date.now() };
    return rules;
  } catch {
    return DEFAULT_RULES;
  }
}

export function invalidateCareFeeCache() { cached = null; }

export type CareFeeInput = {
  suction?: boolean;
  dementia?: boolean;
  paralysis?: boolean;     // 마비 / 욕창 / 와상 / 사지마비 / 하반신마비
  infection?: boolean;     // 감염성 질환
  hemiplegia?: boolean;    // 편마비 (중증 구분용)
  heavy?: boolean;         // 몸무게 70kg 이상
  diaper?: boolean;        // 기저귀 사용
};

export type CareFeeResult = {
  min: number;
  average: number;
  max: number;
  tier: 'LIGHT' | 'MEDIUM' | 'HIGH' | 'HIGH_INFECTION';
  tierLabel: string;
  surcharge: number;
};

export function calculateCareFee(input: CareFeeInput, rules: CareFeeRules): CareFeeResult {
  let base: number;
  let tier: CareFeeResult['tier'];
  let tierLabel: string;
  if (input.infection) {
    base = rules.baseHighInfection;
    tier = 'HIGH_INFECTION';
    tierLabel = '고위험 (감염성 질환)';
  } else if (input.suction || input.dementia || input.paralysis) {
    base = rules.baseHigh;
    tier = 'HIGH';
    tierLabel = '고위험';
  } else if (input.hemiplegia) {
    base = rules.baseMedium;
    tier = 'MEDIUM';
    tierLabel = '중증';
  } else {
    base = rules.baseLight;
    tier = 'LIGHT';
    tierLabel = '경증';
  }
  const surcharge = (input.heavy ? rules.surchargeHeavy : 0) + (input.diaper ? rules.surchargeDiaper : 0);
  const avg = base + surcharge;
  return {
    min: avg - rules.minOffset,
    average: avg,
    max: avg + rules.maxOffset,
    tier,
    tierLabel,
    surcharge,
  };
}
