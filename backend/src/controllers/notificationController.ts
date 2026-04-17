import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// POST /device-token - 디바이스 토큰 등록 (비회원 포함, 로그인 시 유저 연결)
export const registerDeviceToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token, platform = 'android', userId } = req.body;

    // 디바이스 토큰 저장/갱신
    await prisma.deviceToken.upsert({
      where: { token },
      update: { platform, userId: userId === null ? null : (userId || undefined), updatedAt: new Date() },
      create: { token, platform, userId: userId === null ? null : (userId || undefined) },
    });

    // userId가 명시적으로 null이면 연결 해제 (로그아웃)
    if (userId === null) {
      // 해당 토큰에 연결된 유저의 fcmToken 클리어
      const deviceToken = await prisma.deviceToken.findUnique({ where: { token } });
      if (deviceToken) {
        await prisma.user.updateMany({
          where: { fcmToken: token },
          data: { fcmToken: null },
        });
      }
    }

    // userId가 있으면 User.fcmToken에도 저장 (기존 푸시 로직 호환)
    if (userId) {
      // 다른 유저에게 할당된 같은 토큰 제거
      await prisma.user.updateMany({
        where: { fcmToken: token, id: { not: userId } },
        data: { fcmToken: null },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { fcmToken: token },
      }).catch(() => {}); // 유저 없으면 무시
    }

    res.json({ success: true, message: '디바이스 토큰이 등록되었습니다.' });
  } catch (error) {
    next(error);
  }
};

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

// PUT /push-setting - 푸시 알림 on/off
export const updatePushSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled 값이 필요합니다.' });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { pushEnabled: enabled },
    });

    res.json({
      success: true,
      data: { pushEnabled: enabled },
      message: enabled ? '푸시 알림이 활성화되었습니다.' : '푸시 알림이 비활성화되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /push-setting - 푸시 설정 조회
export const getPushSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { pushEnabled: true, notificationPrefs: true },
    });

    res.json({
      success: true,
      data: {
        pushEnabled: user?.pushEnabled ?? true,
        notificationPrefs: user?.notificationPrefs || {},
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /category-prefs - 카테고리별 알림 설정
export const updateCategoryPrefs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { prefs } = req.body;
    if (!prefs || typeof prefs !== 'object') {
      return res.status(400).json({ success: false, message: 'prefs 객체가 필요합니다.' });
    }
    // 유효한 카테고리만 필터링
    const validKeys = ['MATCHING', 'APPLICATION', 'CONTRACT', 'PAYMENT', 'CARE_RECORD', 'EXTENSION', 'PENALTY', 'SYSTEM'];
    const filtered: Record<string, boolean> = {};
    for (const k of validKeys) {
      if (typeof prefs[k] === 'boolean') filtered[k] = prefs[k];
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { notificationPrefs: filtered },
    });

    res.json({ success: true, data: { notificationPrefs: filtered } });
  } catch (error) {
    next(error);
  }
};
