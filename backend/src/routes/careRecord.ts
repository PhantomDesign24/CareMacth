import { Router } from 'express';
import { body } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { upload, handleUploadError } from '../middlewares/upload';
import * as careRecordController from '../controllers/careRecordController';

const router = Router();

// PDF 엔드포인트는 쿼리스트링 토큰도 허용 (새 탭으로 다운로드 시 헤더 못 보냄)
// 라우트 정의 순서상 router.use(authenticate) 앞에 둠
router.get(
  '/:contractId/pdf',
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  },
  authenticate,
  careRecordController.generateCareRecordPdf,
);

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

// POST /daily-log - 간병 일지 작성 (케어매치 공식 양식)
router.post('/daily-log', [
  body('contractId').notEmpty().withMessage('계약 ID가 필요합니다.'),
  body('careHours').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 24 }).withMessage('간병시간은 0~24 사이여야 합니다.'),
  body('notes').optional({ nullable: true }).isLength({ max: 2000 }).withMessage('메모는 2000자 이내여야 합니다.'),
  body('otherCareNote').optional({ nullable: true }).isLength({ max: 500 }).withMessage('기타 내용은 500자 이내여야 합니다.'),
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
