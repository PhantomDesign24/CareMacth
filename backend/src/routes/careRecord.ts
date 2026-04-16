import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import { upload, handleUploadError } from '../middlewares/upload';
import * as careRecordController from '../controllers/careRecordController';

const router = Router();

// 모든 간병 기록 라우트에 인증 필요
router.use(authenticate);

// POST /check-in - 출근 체크
router.post('/check-in', [
  body('contractId').notEmpty().withMessage('계약 ID가 필요합니다.'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('유효한 위도를 입력해주세요.'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('유효한 경도를 입력해주세요.'),
], careRecordController.checkIn);

// POST /check-out - 퇴근 체크
router.post('/check-out', [
  body('contractId').notEmpty().withMessage('계약 ID가 필요합니다.'),
], careRecordController.checkOut);

// POST /daily-log - 간병 일지 작성
router.post('/daily-log', [
  body('contractId').notEmpty().withMessage('계약 ID가 필요합니다.'),
  body('bodyTemp').optional().isFloat({ min: 30, max: 45 }).withMessage('체온은 30~45도 사이여야 합니다.'),
  body('pulse').optional().isInt({ min: 20, max: 300 }).withMessage('맥박은 20~300 사이여야 합니다.'),
  body('notes').optional().isLength({ max: 2000 }).withMessage('메모는 2000자 이내여야 합니다.'),
], careRecordController.createDailyLog);

// POST /photos - 간병 기록 사진 업로드
router.post('/photos',
  authorize('CAREGIVER'),
  upload.array('photos', 10),
  handleUploadError,
  careRecordController.uploadPhotos,
);

// GET /:contractId - 간병 기록 조회
router.get('/:contractId', careRecordController.getCareRecords);

router.use(handleUploadError);

export default router;
