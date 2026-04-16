import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import * as contractController from '../controllers/contractController';

const router = Router();

// 모든 계약 라우트에 인증 필요
router.use(authenticate);

// POST / - 계약 생성 (보호자만)
router.post('/', authorize('GUARDIAN'), [
  body('careRequestId').notEmpty().withMessage('간병 요청 ID가 필요합니다.'),
  body('caregiverId').notEmpty().withMessage('간병인 ID가 필요합니다.'),
], contractController.createContract);

// GET /:id - 계약 상세 (보호자/간병인/관리자 본인 것만)
router.get('/:id', authorize('GUARDIAN', 'CAREGIVER', 'ADMIN'), contractController.getContract);

// PUT /:id/cancel - 계약 취소 (보호자/간병인/관리자)
router.put('/:id/cancel', authorize('GUARDIAN', 'CAREGIVER', 'ADMIN'), [
  body('reason').notEmpty().trim().isLength({ min: 1, max: 500 }).withMessage('취소 사유를 입력해주세요. (1~500자)'),
], contractController.cancelContract);

// POST /:id/cancel - 계약 취소 (POST 방식도 지원)
router.post('/:id/cancel', authorize('GUARDIAN', 'CAREGIVER', 'ADMIN'), [
  body('reason').notEmpty().trim().isLength({ min: 1, max: 500 }).withMessage('취소 사유를 입력해주세요. (1~500자)'),
], contractController.cancelContract);

// POST /:id/extend - 연장 요청 (보호자만)
router.post('/:id/extend', authorize('GUARDIAN'), [
  body('additionalDays').optional().isInt({ min: 1 }).withMessage('연장 일수는 1일 이상이어야 합니다.'),
], contractController.extendContract);

export default router;
