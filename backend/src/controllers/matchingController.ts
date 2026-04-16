import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import {
  calculateDistance,
  getDistanceScore,
  getExperienceScore,
  getReviewScore,
  getRehireScore,
  getCancelPenalty,
  calculateTotalScore,
} from '../utils/matchingScores';

// POST /auto/:careRequestId - 자동 매칭 실행
export const autoMatch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { careRequestId } = req.params;

    const careRequest = await prisma.careRequest.findUnique({
      where: { id: careRequestId },
      include: {
        patient: true,
        guardian: true,
      },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    if (!['OPEN', 'MATCHING'].includes(careRequest.status)) {
      throw new AppError('매칭이 가능한 상태가 아닙니다. (OPEN 또는 MATCHING 상태만 가능)', 400);
    }

    // 상태를 MATCHING으로 변경
    await prisma.careRequest.update({
      where: { id: careRequestId },
      data: { status: 'MATCHING' },
    });

    // 가용 간병인 조회 (APPROVED 상태, AVAILABLE 또는 IMMEDIATE)
    const whereClause: any = {
      status: 'APPROVED',
      workStatus: { in: ['AVAILABLE', 'IMMEDIATE'] },
    };

    // 선호 성별 필터
    if (careRequest.preferredGender) {
      whereClause.gender = careRequest.preferredGender;
    }

    // 선호 국적 필터
    if (careRequest.preferredNationality) {
      whereClause.nationality = careRequest.preferredNationality;
    }

    const candidates = await prisma.caregiver.findMany({
      where: whereClause,
      include: {
        user: {
          select: { name: true, phone: true },
        },
        certificates: {
          where: { verified: true },
        },
      },
    });

    // 기존 매칭 점수 삭제 후 재계산
    await prisma.matchScore.deleteMany({
      where: { careRequestId },
    });

    const matchScores = candidates.map((caregiver) => {
      // 거리 점수
      let distanceScore = 15; // 좌표 없는 경우 기본값
      if (careRequest.latitude && careRequest.longitude && caregiver.latitude && caregiver.longitude) {
        const distance = calculateDistance(
          careRequest.latitude,
          careRequest.longitude,
          caregiver.latitude,
          caregiver.longitude
        );
        distanceScore = getDistanceScore(distance);
      }

      // 경력 적합도
      const experienceScore = getExperienceScore(
        caregiver.experienceYears,
        caregiver.specialties,
        {
          hasDementia: careRequest.patient.hasDementia,
          hasInfection: careRequest.patient.hasInfection,
          mobilityStatus: careRequest.patient.mobilityStatus,
        }
      );

      // 리뷰 점수
      const reviewScore = getReviewScore(caregiver.avgRating, caregiver.totalMatches);

      // 재고용률
      const rehireScore = getRehireScore(caregiver.rehireRate);

      // 취소 감점
      const cancelPenalty = getCancelPenalty(caregiver.cancellationRate, caregiver.noShowCount);

      // 우수 간병사 뱃지 보너스
      const badgeBonus = caregiver.hasBadge ? 5 : 0;

      // 즉시 가능 보너스
      const immediateBonus = caregiver.workStatus === 'IMMEDIATE' ? 3 : 0;

      const totalScore = distanceScore + experienceScore + reviewScore + rehireScore + cancelPenalty + badgeBonus + immediateBonus;

      return {
        careRequestId,
        caregiverId: caregiver.id,
        score: Math.max(totalScore, 0),
        distanceScore,
        experienceScore,
        reviewScore,
        rehireScore,
        cancelPenalty,
      };
    });

    // 점수순 정렬
    matchScores.sort((a, b) => b.score - a.score);

    // DB에 저장
    if (matchScores.length > 0) {
      await prisma.matchScore.createMany({
        data: matchScores,
      });
    }

    // 모든 후보에게 알림 발송 (배치 처리로 N+1 방지)
    const dailyRateText = careRequest.dailyRate
      ? `제시 일당: ${careRequest.dailyRate.toLocaleString()}원`
      : '일당 미정';

    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const notificationData = matchScores
      .filter((candidate) => candidateMap.has(candidate.caregiverId))
      .map((candidate) => {
        const caregiver = candidateMap.get(candidate.caregiverId)!;
        return {
          userId: caregiver.userId,
          type: 'MATCHING' as const,
          title: '새로운 간병 요청 매칭',
          body: `${careRequest.patient.name} 환자의 간병 요청이 도착했습니다. ${dailyRateText} | 매칭 점수: ${candidate.score.toFixed(1)}점`,
          data: { careRequestId, score: candidate.score, dailyRate: careRequest.dailyRate } as any,
        };
      });

    const candidateIds = matchScores
      .filter((c) => candidateMap.has(c.caregiverId))
      .map((c) => c.caregiverId);

    if (notificationData.length > 0) {
      await prisma.$transaction([
        prisma.notification.createMany({ data: notificationData }),
        prisma.matchScore.updateMany({
          where: {
            careRequestId,
            caregiverId: { in: candidateIds },
          },
          data: {
            notified: true,
            notifiedAt: new Date(),
          },
        }),
      ]);
    }

    res.json({
      success: true,
      data: {
        totalCandidates: matchScores.length,
        notifiedCount: matchScores.length,
        topScores: matchScores.slice(0, 20),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /candidates/:careRequestId - 후보군 조회
export const getCandidates = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { careRequestId } = req.params;

    const careRequest = await prisma.careRequest.findUnique({
      where: { id: careRequestId },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    // 보호자 권한 확인
    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || careRequest.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [matchScores, total] = await Promise.all([
      prisma.matchScore.findMany({
        where: { careRequestId },
        orderBy: { score: 'desc' },
        skip,
        take: limit,
      }),
      prisma.matchScore.count({
        where: { careRequestId },
      }),
    ]);

    // 간병인 상세 정보 조회
    const caregiverIds = matchScores.map((ms) => ms.caregiverId);
    const caregivers = await prisma.caregiver.findMany({
      where: { id: { in: caregiverIds } },
      include: {
        user: {
          select: {
            name: true,
            profileImage: true,
          },
        },
        certificates: {
          where: { verified: true },
          select: { name: true, issuer: true },
        },
      },
    });

    const candidates = matchScores.map((ms) => {
      const caregiver = caregivers.find((c) => c.id === ms.caregiverId);
      return {
        ...ms,
        caregiver: caregiver
          ? {
              id: caregiver.id,
              name: caregiver.user.name,
              profileImage: caregiver.user.profileImage,
              gender: caregiver.gender,
              nationality: caregiver.nationality,
              experienceYears: caregiver.experienceYears,
              specialties: caregiver.specialties,
              avgRating: caregiver.avgRating,
              totalMatches: caregiver.totalMatches,
              rehireRate: caregiver.rehireRate,
              hasBadge: caregiver.hasBadge,
              workStatus: caregiver.workStatus,
              certificates: caregiver.certificates,
            }
          : null,
      };
    });

    res.json({
      success: true,
      data: {
        candidates,
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
