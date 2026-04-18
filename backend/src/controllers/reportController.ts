import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// POST /reports - 신고 등록
export const createReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { targetType, targetId, reason, detail } = req.body;

    // 리뷰 신고일 경우 실제 리뷰 존재 확인
    let reviewId: string | null = null;
    if (targetType === 'REVIEW') {
      const review = await prisma.review.findUnique({ where: { id: targetId } });
      if (!review) throw new AppError('신고할 리뷰를 찾을 수 없습니다.', 404);
      reviewId = targetId;
    }

    // 중복 신고 방지 (같은 신고자가 동일 대상에 대해 PENDING 상태 중복 불가)
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: req.user!.id,
        targetType,
        targetId,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
    });
    if (existing) {
      throw new AppError('이미 신고하신 내용입니다. 관리자 검토 중입니다.', 400);
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        targetType,
        targetId,
        reason,
        detail: detail || null,
        reviewId,
      },
    });

    // 관리자에게 알림
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: 'SYSTEM' as const,
          title: '신고 접수',
          body: `${targetType} (${reason}) 신고가 접수되었습니다.`,
          data: { reportId: report.id, targetType, targetId } as any,
        })),
      });
    }

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// GET /reports/my - 내 신고 이력
export const getMyReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await prisma.report.findMany({
      where: { reporterId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
};

// POST /blocks - 사용자 차단
export const createBlock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, reason } = req.body;
    if (!userId) throw new AppError('차단할 사용자 ID를 입력해주세요.', 400);
    if (userId === req.user!.id) throw new AppError('본인을 차단할 수 없습니다.', 400);

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new AppError('사용자를 찾을 수 없습니다.', 404);

    const block = await prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId: req.user!.id, blockedId: userId },
      },
      create: {
        blockerId: req.user!.id,
        blockedId: userId,
        reason: reason || null,
      },
      update: { reason: reason || null },
    });

    res.json({ success: true, data: block });
  } catch (error) {
    next(error);
  }
};

// DELETE /blocks/:userId - 차단 해제
export const removeBlock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    await prisma.userBlock.deleteMany({
      where: { blockerId: req.user!.id, blockedId: userId },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// GET /blocks - 내 차단 목록
export const getMyBlocks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    // 차단된 사용자 이름 조회
    const blockedIds = blocks.map((b) => b.blockedId);
    const users = await prisma.user.findMany({
      where: { id: { in: blockedIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json({
      success: true,
      data: blocks.map((b) => ({
        ...b,
        blockedUserName: userMap.get(b.blockedId)?.name || '(알 수 없음)',
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ───── 관리자 ─────

// GET /admin/reports - 관리자: 전체 신고 목록
export const adminGetReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const where: any = {};
    if (status) where.status = status;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        review: {
          include: {
            guardian: { include: { user: { select: { name: true } } } },
            caregiver: { include: { user: { select: { name: true } } } },
          },
        },
      },
      take: 200,
    });

    // 신고자 정보 붙이기
    const reporterIds = reports.map((r) => r.reporterId);
    const reporters = await prisma.user.findMany({
      where: { id: { in: reporterIds } },
      select: { id: true, name: true, email: true },
    });
    const reporterMap = new Map(reporters.map((r) => [r.id, r]));

    res.json({
      success: true,
      data: reports.map((r) => ({
        ...r,
        reporter: reporterMap.get(r.reporterId),
      })),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /admin/reports/:id - 관리자: 신고 처리
export const adminUpdateReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, adminNote, hideReview, unhideReview } = req.body;

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new AppError('신고를 찾을 수 없습니다.', 404);

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id },
        data: {
          status,
          adminNote: adminNote || null,
          reviewedAt: new Date(),
          reviewedBy: req.user!.id,
        },
      });

      // 리뷰 가림 처리 옵션
      if (hideReview && report.reviewId && status === 'RESOLVED') {
        await tx.review.update({
          where: { id: report.reviewId },
          data: { isHidden: true },
        });
      }
      // 리뷰 가림 해제 (되돌리기)
      if (unhideReview && report.reviewId) {
        await tx.review.update({
          where: { id: report.reviewId },
          data: { isHidden: false },
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// POST /admin/reviews/:id/unhide - 리뷰 숨김 해제 (단독 엔드포인트)
export const adminUnhideReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new AppError('리뷰를 찾을 수 없습니다.', 404);
    await prisma.review.update({ where: { id }, data: { isHidden: false } });
    res.json({ success: true, message: '리뷰 숨김이 해제되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// POST /admin/reviews/:id/hide - 리뷰 숨김 처리 (단독 엔드포인트)
export const adminHideReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new AppError('리뷰를 찾을 수 없습니다.', 404);
    await prisma.review.update({ where: { id }, data: { isHidden: true } });
    res.json({ success: true, message: '리뷰가 숨김 처리되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// GET /admin/reviews/hidden - 숨김 처리된 리뷰 목록
export const adminGetHiddenReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { isHidden: true },
      include: {
        guardian: { include: { user: { select: { name: true } } } },
        caregiver: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};
