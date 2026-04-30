import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, optionalAuthenticate } from '../middlewares/auth';
import * as notificationController from '../controllers/notificationController';

const router = Router();

// 비회원도 가능 — 인증 토큰 있으면 그 사용자에 연결, 없으면 anonymous DeviceToken 만 저장.
// userId 는 body 로 받지 않음 (피해자 토큰 탈취 방지)
router.post('/device-token', optionalAuthenticate, [
  body('token').notEmpty().withMessage('푸시 토큰이 필요합니다.'),
  body('platform').optional().isIn(['android', 'ios']),
  body('logout').optional().isBoolean(),
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

// PUT /push-setting - 푸시 알림 on/off
router.put('/push-setting', notificationController.updatePushSetting);

// GET /push-setting - 푸시 설정 조회
router.get('/push-setting', notificationController.getPushSetting);

// PUT /category-prefs - 카테고리별 알림 ON/OFF
router.put('/category-prefs', notificationController.updateCategoryPrefs);

export default router;
