import { CareRequest, Caregiver } from '@prisma/client';
import { USER_PUBLIC_SELECT } from '../utils/userSelect';
import {
  calculateDistance,
  getDistanceScore,
  getReviewScore,
  getRehireScore,
  getCancelPenalty,
} from '../utils/matchingScores';

import { prisma } from '../app';

interface MatchScoreResult {
  caregiverId: string;
  totalScore: number;
  distanceScore: number;
  experienceScore: number;
  reviewScore: number;
  rehireScore: number;
  cancelPenalty: number;
}

export async function runAutoMatching(careRequestId: string): Promise<MatchScoreResult[]> {
  const careRequest = await prisma.careRequest.findUnique({
    where: { id: careRequestId },
    include: { patient: true },
  });

  if (!careRequest) {
    throw new Error('간병 요청을 찾을 수 없습니다.');
  }

  // 1단계: Hard Filter - 기본 조건 필터링
  const whereConditions: any = {
    status: 'APPROVED',
    workStatus: { in: ['AVAILABLE', 'IMMEDIATE'] },
  };

  // 성별 필터
  if (careRequest.preferredGender) {
    whereConditions.gender = careRequest.preferredGender;
  }

  // 국적 필터
  if (careRequest.preferredNationality) {
    whereConditions.nationality = careRequest.preferredNationality;
  }

  const candidates = await prisma.caregiver.findMany({
    where: whereConditions,
    include: {
      user: true,
      certificates: true,
    },
  });

  // 2단계: 매칭 점수 계산
  const scores: MatchScoreResult[] = candidates.map((caregiver) => {
    // 거리 점수
    let distanceScore = 15; // 좌표 없을 때 기본값
    if (careRequest.latitude && careRequest.longitude && caregiver.latitude && caregiver.longitude) {
      const distance = calculateDistance(
        careRequest.latitude, careRequest.longitude,
        caregiver.latitude, caregiver.longitude
      );
      distanceScore = getDistanceScore(distance);
    }

    // 희망 지역 매칭 보너스 — careRequest.regions(시·군·구 포함) + address 양쪽으로 매칭
    if (caregiver.preferredRegions.length > 0) {
      const requestRegions: string[] = Array.isArray((careRequest as any).regions) ? (careRequest as any).regions : [];
      const regionMatch = caregiver.preferredRegions.some((cgRegion) => {
        // 1) 정확 일치 또는 prefix (caregiver "서울" ⊂ request "서울 강남구")
        if (requestRegions.some((r) => r === cgRegion || r.startsWith(`${cgRegion} `) || cgRegion.startsWith(`${r} `))) {
          return true;
        }
        // 2) 주소 문자열 substring 매칭 (백워드 호환)
        return typeof careRequest.address === 'string' && careRequest.address.includes(cgRegion);
      });
      if (regionMatch) distanceScore = Math.min(30, distanceScore + 5);
    }

    // utils/matchingScores.ts의 공통 함수 사용
    const experienceScore = Math.min(caregiver.experienceYears * 2.5, 25);
    const reviewScore = getReviewScore(caregiver.avgRating, caregiver.totalMatches);
    const rehireScore = getRehireScore(caregiver.rehireRate);
    const cancelPenalty = getCancelPenalty(caregiver.cancellationRate, caregiver.noShowCount);

    const totalScore = Math.max(0, distanceScore + experienceScore + reviewScore + rehireScore + cancelPenalty);

    return {
      caregiverId: caregiver.id,
      totalScore,
      distanceScore,
      experienceScore,
      reviewScore,
      rehireScore,
      cancelPenalty,
    };
  });

  // 점수순 정렬
  scores.sort((a, b) => b.totalScore - a.totalScore);

  // 3단계: DB에 매칭 점수 저장
  await prisma.matchScore.deleteMany({
    where: { careRequestId },
  });

  await prisma.matchScore.createMany({
    data: scores.map((score) => ({
      careRequestId,
      caregiverId: score.caregiverId,
      score: score.totalScore,
      distanceScore: score.distanceScore,
      experienceScore: score.experienceScore,
      reviewScore: score.reviewScore,
      rehireScore: score.rehireScore,
      cancelPenalty: score.cancelPenalty,
    })),
  });

  // 4단계: 간병 요청 상태 업데이트
  await prisma.careRequest.update({
    where: { id: careRequestId },
    data: { status: 'MATCHING' },
  });

  return scores;
}

// 간병인에게 알림 발송
export async function notifyCandidates(
  careRequestId: string,
  limit: number = 20
): Promise<number> {
  const topCandidates = await prisma.matchScore.findMany({
    where: { careRequestId, notified: false },
    orderBy: { score: 'desc' },
    take: limit,
    include: {
      careRequest: {
        include: { patient: true },
      },
    },
  });

  let notifiedCount = 0;

  for (const candidate of topCandidates) {
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: candidate.caregiverId },
      include: { user: { select: USER_PUBLIC_SELECT } },
    });

    if (!caregiver) continue;

    // 알림 생성 — 결제 전이라 주소 정확값 노출 금지. region 또는 시/구까지만 사용.
    const region = (candidate.careRequest as any).region
      || (Array.isArray((candidate.careRequest as any).regions) && (candidate.careRequest as any).regions[0])
      || (candidate.careRequest.address ? candidate.careRequest.address.split(/\s+/).slice(0, 2).join(' ') : '인근');
    await prisma.notification.create({
      data: {
        userId: caregiver.userId,
        type: 'MATCHING',
        title: '새로운 간병 요청',
        body: `${region}에서 ${candidate.careRequest.scheduleType === 'FULL_TIME' ? '24시간' : '시간제'} 간병인을 찾고 있습니다.`,
        data: {
          careRequestId,
          matchScore: candidate.score,
        },
      },
    });

    // 알림 발송 상태 업데이트
    await prisma.matchScore.update({
      where: { id: candidate.id },
      data: { notified: true, notifiedAt: new Date() },
    });

    notifiedCount++;
  }

  return notifiedCount;
}

// 긴급 재매칭
export async function emergencyRematch(contractId: string): Promise<MatchScoreResult[]> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { careRequest: true },
  });

  if (!contract) {
    throw new Error('계약을 찾을 수 없습니다.');
  }

  // 기존 계약 취소
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: '긴급 재매칭',
    },
  });

  // 간병 요청 다시 열기
  await prisma.careRequest.update({
    where: { id: contract.careRequestId },
    data: { status: 'OPEN' },
  });

  // 자동 매칭 재실행
  return runAutoMatching(contract.careRequestId);
}
