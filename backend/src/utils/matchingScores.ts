/**
 * 매칭 점수 계산 유틸리티 함수들
 * matchingController.ts와 matchingService.ts에서 공통 사용
 */

// 두 좌표 간 거리 계산 (km) - Haversine 공식
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 거리 점수 (0-30점): 가까울수록 높은 점수
export function getDistanceScore(distanceKm: number): number {
  if (distanceKm <= 5) return 30;
  if (distanceKm <= 10) return 25;
  if (distanceKm <= 20) return 20;
  if (distanceKm <= 50) return 10;
  return 5;
}

// 경력 적합도 점수 (0-25점)
export function getExperienceScore(
  years: number,
  specialties: string[],
  patientNeeds: {
    hasDementia: boolean;
    hasInfection: boolean;
    mobilityStatus: string;
  }
): number {
  let score = Math.min(years * 2.5, 15); // 최대 15점 (6년 이상)

  // 전문 분야 일치 보너스
  if (patientNeeds.hasDementia && specialties.includes('치매')) score += 5;
  if (patientNeeds.hasInfection && specialties.includes('감염관리')) score += 3;
  if (patientNeeds.mobilityStatus === 'DEPENDENT' && specialties.includes('중환자')) score += 2;

  return Math.min(score, 25);
}

// 리뷰 점수 (0-20점)
export function getReviewScore(avgRating: number, totalMatches: number): number {
  if (totalMatches === 0) return 10; // 신규 간병인 기본 점수
  return (avgRating / 5) * 20;
}

// 재고용률 점수 (0-15점)
export function getRehireScore(rehireRate: number): number {
  return rehireRate * 15;
}

// 취소 감점 (0~-10점)
export function getCancelPenalty(cancellationRate: number, noShowCount: number): number {
  return -(cancellationRate * 5 + Math.min(noShowCount, 3) * 1.67);
}

// 총 매칭 점수 계산
export interface MatchScoreInput {
  distanceScore: number;
  experienceScore: number;
  reviewScore: number;
  rehireScore: number;
  cancelPenalty: number;
  hasBadge: boolean;
  isImmediate: boolean;
}

export function calculateTotalScore(input: MatchScoreInput): number {
  const badgeBonus = input.hasBadge ? 5 : 0;
  const immediateBonus = input.isImmediate ? 3 : 0;
  const total = input.distanceScore + input.experienceScore + input.reviewScore
    + input.rehireScore + input.cancelPenalty + badgeBonus + immediateBonus;
  return Math.max(total, 0);
}
