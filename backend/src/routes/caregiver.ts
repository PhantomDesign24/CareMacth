import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import { upload, handleUploadError, verifyUploadMagicNumber } from '../middlewares/upload';
import * as caregiverController from '../controllers/caregiverController';

const router = Router();

// 모든 간병인 라우트에 인증 필요
router.use(authenticate);
router.use(authorize('CAREGIVER', 'ADMIN'));

// GET /profile - 프로필 조회
router.get('/profile', caregiverController.getProfile);

// PUT /profile - 프로필 수정
router.put('/profile', [
  body('experienceYears').optional().isInt({ min: 0, max: 50 }).withMessage('경력 연수는 0~50 사이여야 합니다.'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('유효한 위도를 입력해주세요.'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('유효한 경도를 입력해주세요.'),
  body('name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('이름은 1~50자 이내여야 합니다.'),
], caregiverController.updateProfile);

// POST /certificates - 자격증 등록
router.post('/certificates', upload.single('image'), verifyUploadMagicNumber, [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('자격증 이름을 입력해주세요. (1~100자)'),
  body('issuer').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('발급기관을 입력해주세요. (1~100자)'),
  body('issueDate').notEmpty().isISO8601().withMessage('유효한 발급일을 입력해주세요.'),
], caregiverController.addCertificate);

// PUT /work-status - 근무 상태 변경
router.put('/work-status', [
  body('workStatus').notEmpty().isIn(['WORKING', 'AVAILABLE', 'IMMEDIATE']).withMessage('유효한 근무 상태를 입력해주세요. (WORKING, AVAILABLE, IMMEDIATE)'),
], caregiverController.updateWorkStatus);

// GET /earnings - 수익 조회
router.get('/earnings', caregiverController.getEarnings);

// GET /penalties - 패널티 조회
router.get('/penalties', caregiverController.getPenalties);

// GET /activity - 활동 이력
router.get('/activity', caregiverController.getActivity);

// GET /applications - 내가 지원한 요청 목록
router.get('/applications', caregiverController.getMyApplications);

// POST /criminal-check - 범죄이력 확인서 업로드
router.post('/criminal-check', upload.single('document'), handleUploadError, verifyUploadMagicNumber, caregiverController.uploadCriminalCheck);

// POST /id-card - 신분증 업로드
router.post('/id-card', upload.single('image'), handleUploadError, verifyUploadMagicNumber, caregiverController.uploadIdCard);

// 라우트 전체에 업로드 에러 핸들러 적용
router.use(handleUploadError);

export default router;
