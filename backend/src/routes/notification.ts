import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/auth';
import * as notificationController from '../controllers/notificationController';

const router = Router();

// 비회원도 가능: 디바이스 토큰 등록
router.post('/device-token', [
  body('token').notEmpty().withMessage('푸시 토큰이 필요합니다.'),
  body('platform').optional().isIn(['android', 'ios']),
], notificationController.registerDeviceToken);

// 이하 인증 필요
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
