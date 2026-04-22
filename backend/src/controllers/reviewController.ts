import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { sendFromTemplate } from '../services/notificationService';

// POST / - 리뷰 작성
export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const { contractId, rating, comment, wouldRehire } = req.body;

    if (!contractId || rating === undefined) {
      throw new AppError('계약 ID와 평점은 필수입니다.', 400);
    }

    if (rating < 1 || rating > 5) {
      throw new AppError('평점은 1~5 사이의 값이어야 합니다.', 400);
    }

    if (comment && typeof comment === 'string' && comment.length > 1000) {
      throw new AppError('리뷰는 1000자 이내여야 합니다.', 400);
    }

    // 계약 확인
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        guardianId: guardian.id,
        status: { in: ['COMPLETED', 'CANCELLED'] },
      },
    });

    if (!contract) {
      throw new AppError('리뷰를 작성할 수 있는 계약을 찾을 수 없습니다. 완료되거나 취소된 계약만 리뷰할 수 있습니다.', 404);
    }

    // 이미 리뷰를 작성했는지 확인
    const existingReview = await prisma.review.findUnique({
      where: {
        guardianId_contractId: {
          guardianId: guardian.id,
          contractId,
        },
      },
    });

    if (existingReview) {
      throw new AppError('이미 이 계약에 대한 리뷰를 작성하셨습니다.', 400);
    }

    const review = await prisma.$transaction(async (tx) => {
      // 리뷰 생성
      const newReview = await tx.review.create({
        data: {
          guardianId: guardian.id,
          caregiverId: contract.caregiverId,
          contractId,
          rating: parseFloat(rating),
          comment,
          wouldRehire: wouldRehire ?? false,
        },
      });

      // 간병인 평균 평점 및 재고용률 업데이트
      const allReviews = await tx.review.findMany({
        where: { caregiverId: contract.caregiverId },
      });

      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      const rehireRate = allReviews.filter((r) => r.wouldRehire).length / allReviews.length;

      await tx.caregiver.update({
        where: { id: contract.caregiverId },
        data: {
          avgRating: Math.round(avgRating * 10) / 10,
          rehireRate: Math.round(rehireRate * 100) / 100,
        },
      });

      return newReview;
    });

    // 간병인에게 리뷰 등록 알림 (트랜잭션 밖 — 푸시 실패해도 리뷰는 저장)
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: contract.caregiverId },
      include: { user: { select: { name: true } } },
    });
    if (caregiver) {
      await sendFromTemplate({
        userId: caregiver.userId,
        key: 'REVIEW_CREATED',
        vars: { caregiverName: caregiver.user?.name || '', rating: String(rating) },
        fallbackTitle: '새로운 리뷰가 등록되었습니다',
        fallbackBody: `평점 ${rating}점의 리뷰가 등록되었습니다.`,
        fallbackType: 'SYSTEM',
        data: { reviewId: review.id },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// GET /caregiver/:caregiverId - 간병인 리뷰 조회
export const getCaregiverReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { caregiverId } = req.params;

    const caregiver = await prisma.caregiver.findUnique({
      where: { id: caregiverId },
      select: {
        id: true,
        avgRating: true,
        totalMatches: true,
        rehireRate: true,
        hasBadge: true,
        user: {
          select: { name: true, profileImage: true },
        },
      },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { caregiverId },
        include: {
          guardian: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { caregiverId } }),
    ]);

    // 평점 분포
    const ratingDistribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { caregiverId },
      _count: { rating: true },
    });

    res.json({
      success: true,
      data: {
        caregiver,
        reviews,
        ratingDistribution: ratingDistribution.map((r) => ({
          rating: r.rating,
          count: r._count.rating,
        })),
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

// GET /reviews/my - 내가 받은 리뷰 (간병인)
export const getMyReceivedReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });
    if (!caregiver) {
      return res.json({ success: true, data: { reviews: [] } });
    }

    const reviews = await prisma.review.findMany({
      where: { caregiverId: caregiver.id, isHidden: false },
      include: {
        guardian: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: { reviews } });
  } catch (error) {
    next(error);
  }
};

// GET /reviews/written - 보호자가 작성한 리뷰 목록
export const getMyWrittenReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
    if (!guardian) {
      return res.json({ success: true, data: { reviews: [] } });
    }

    const reviews = await prisma.review.findMany({
      where: { guardianId: guardian.id },
      include: {
        caregiver: { include: { user: { select: { name: true, profileImage: true } } } },
        contract: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            careRequest: { select: { patient: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { reviews } });
  } catch (error) {
    next(error);
  }
};
