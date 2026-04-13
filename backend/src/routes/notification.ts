import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/auth';
import * as notificationController from '../controllers/notificationController';

const router = Router();

// 모든 알림 라우트에 인증 필요
router.use(authenticate);

// GET / - 알림 목록
router.get('/', notificationController.getNotifications);

// PUT /:id/read - 읽음 처리 (id='all'이면 전체 읽음 처리)
router.put('/:id/read', notificationController.markAsRead);

// POST /fcm-token - FCM 토큰 등록/갱신
router.post('/fcm-token', [
  body('fcmToken').notEmpty().withMessage('FCM 토큰이 필요합니다.'),
], notificationController.registerFcmToken);

// DELETE /fcm-token - FCM 토큰 삭제 (로그아웃 시)
router.delete('/fcm-token', notificationController.removeFcmToken);

export default router;
