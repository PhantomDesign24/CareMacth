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
  // 서류 종류 체크 제거 요청(2차 검수 6-7)에 따라 웹은 '일괄 신청' 한 건으로 보낸다.
  //  기존 화이트리스트를 그대로 두면 그 값이 걸려 모든 신청이 400 으로 거절되므로 길이 검증만 남긴다.
  body('documentType').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('서류 종류는 200자 이내로 입력해주세요.'),
], insuranceController.createInsuranceDocRequest);

// GET / - 내 신청 목록
router.get('/', insuranceController.getMyInsuranceRequests);

// GET /:id/status - 진행 상황 확인
router.get('/:id/status', insuranceController.getInsuranceDocStatus);

export default router;
