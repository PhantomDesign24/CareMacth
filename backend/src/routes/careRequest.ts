import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import * as careRequestController from '../controllers/careRequestController';

const router = Router();

// 모든 간병 요청 라우트에 인증 필요
router.use(authenticate);

// POST / - 간병 요청 생성 (보호자)
router.post('/', [
  body('patientId').notEmpty().withMessage('환자 ID를 입력해주세요.'),
  body('careType').notEmpty().withMessage('간병 유형을 입력해주세요.'),
  body('scheduleType').notEmpty().withMessage('스케줄 유형을 입력해주세요.'),
  body('location').notEmpty().withMessage('간병 장소를 입력해주세요.'),
  body('address').notEmpty().withMessage('주소를 입력해주세요.'),
  body('startDate').notEmpty().isISO8601().withMessage('유효한 시작일을 입력해주세요.'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('유효한 종료일을 입력해주세요.'),
  body('medicalActAgreed').optional(),
  body('dailyRate').optional({ nullable: true }).isInt({ min: 0 }).withMessage('일당은 0 이상의 숫자여야 합니다.'),
  body('hourlyRate').optional({ nullable: true }).isInt({ min: 0 }).withMessage('시급은 0 이상의 숫자여야 합니다.'),
], careRequestController.createCareRequest);

// GET /region-stats - 지역별 오픈 요청 수 (목록 앞에 위치해야 /:id 와 충돌 안 함)
router.get('/region-stats', careRequestController.getRegionStats);

// GET / - 간병 요청 목록
router.get('/', careRequestController.getCareRequests);

// GET /:id - 간병 요청 상세
router.get('/:id', careRequestController.getCareRequestById);

// PUT /:id - 간병 요청 수정
router.put('/:id', authorize('GUARDIAN'), [
  body('startDate').optional().isISO8601().withMessage('유효한 시작일을 입력해주세요.'),
  body('endDate').optional().isISO8601().withMessage('유효한 종료일을 입력해주세요.'),
  body('dailyRate').optional({ nullable: true }).isInt({ min: 0 }).withMessage('일당은 0 이상의 숫자여야 합니다.'),
  body('hourlyRate').optional({ nullable: true }).isInt({ min: 0 }).withMessage('시급은 0 이상의 숫자여야 합니다.'),
], careRequestController.updateCareRequest);

// POST /:id/raise-rate - 금액 인상 재공고 (보호자)
router.post('/:id/raise-rate', authorize('GUARDIAN'), [
  body('newDailyRate').isInt({ min: 1 }).withMessage('새 일당은 1 이상의 숫자여야 합니다.'),
], careRequestController.raiseRate);

// POST /:id/expand-regions - 지역 확장 재공고 (보호자)
router.post('/:id/expand-regions', authorize('GUARDIAN'), [
  body('regions').isArray({ min: 1 }).withMessage('추가할 지역을 한 개 이상 선택해주세요.'),
], careRequestController.expandRegions);

// POST /:id/apply - 간병인 지원 (인드라이브 방식)
router.post('/:id/apply', authorize('CAREGIVER'), [
  body('message').optional().trim().isLength({ max: 500 }).withMessage('메시지는 500자 이내여야 합니다.'),
  body('proposedRate').optional({ nullable: true }).isInt({ min: 1 }).withMessage('제안 금액은 1 이상의 숫자여야 합니다.'),
  body('isAccepted').optional().isBoolean().withMessage('수락 여부는 true/false여야 합니다.'),
], careRequestController.applyToCareRequest);

// DELETE /:id/apply - 간병인 본인 지원 취소 (보호자 선택 전까지만)
router.delete('/:id/apply', authorize('CAREGIVER'), careRequestController.cancelApplication);

// DELETE /:id - 간병 요청 취소 (보호자만)
router.delete('/:id', authorize('GUARDIAN'), careRequestController.cancelCareRequest);

export default router;
