import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// GET / - 알림 목록
export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    const whereClause: any = {
      userId: req.user!.id,
    };

    if (unreadOnly) {
      whereClause.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
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

// PUT /:id/read - 읽음 처리
export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 'all'인 경우 전체 읽음 처리
    if (id === 'all') {
      await prisma.notification.updateMany({
        where: {
          userId: req.user!.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      res.json({
        success: true,
        message: '모든 알림을 읽음 처리했습니다.',
      });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!notification) {
      throw new AppError('알림을 찾을 수 없습니다.', 404);
    }

    if (notification.isRead) {
      res.json({
        success: true,
        message: '이미 읽은 알림입니다.',
      });
      return;
    }

    await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: '알림을 읽음 처리했습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// POST /fcm-token - FCM 토큰 등록/갱신
export const registerFcmToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { fcmToken } = req.body;

    // 다른 유저에게 할당된 같은 토큰 제거 (기기 변경 대응)
    await prisma.user.updateMany({
      where: {
        fcmToken,
        id: { not: req.user!.id },
      },
      data: { fcmToken: null },
    });

    // 현재 유저에 토큰 등록
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { fcmToken },
    });

    res.json({
      success: true,
      message: 'FCM 토큰이 등록되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /fcm-token - FCM 토큰 삭제 (로그아웃 시)
export const removeFcmToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { fcmToken: null },
    });

    res.json({
      success: true,
      message: 'FCM 토큰이 삭제되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};
