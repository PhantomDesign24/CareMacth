import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/auth';
import * as insuranceController from '../controllers/insuranceController';

const router = Router();

// 모든 보험 서류 라우트에 인증 필요
router.use(authenticate);

// POST / - 간병보험 서류 신청
router.post('/', [
  body('patientName').notEmpty().trim().isLength({ min: 1, max: 50 }).withMessage('환자명을 입력해주세요. (1~50자)'),
  body('birthDate').notEmpty().withMessage('생년월일을 입력해주세요.'),
  body('carePeriod').notEmpty().withMessage('간병기간을 입력해주세요.'),
  body('insuranceCompany').notEmpty().trim().withMessage('보험사를 입력해주세요.'),
  body('documentType').notEmpty().isIn(['간병확인서', '영수증', '간병일지', '진단서']).withMessage('유효한 서류 종류를 선택해주세요. (간병확인서, 영수증, 간병일지, 진단서)'),
], insuranceController.createInsuranceDocRequest);

// GET / - 내 신청 목록
router.get('/', insuranceController.getMyInsuranceRequests);

// GET /:id/status - 진행 상황 확인
router.get('/:id/status', insuranceController.getInsuranceDocStatus);

export default router;
