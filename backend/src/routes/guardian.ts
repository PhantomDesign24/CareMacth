import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import * as guardianController from '../controllers/guardianController';

const router = Router();

// 모든 보호자 라우트에 인증 필요
router.use(authenticate);
router.use(authorize('GUARDIAN'));

// GET / - 내 정보 조회
router.get('/', guardianController.getMyInfo);

// POST /patients - 환자 등록
router.post('/patients', [
  body('name').notEmpty().trim().isLength({ min: 1, max: 50 }).withMessage('환자 이름을 입력해주세요. (1~50자)'),
  body('birthDate').notEmpty().isISO8601().withMessage('유효한 생년월일을 입력해주세요.'),
  body('gender').notEmpty().withMessage('성별을 입력해주세요.'),
  body('mobilityStatus').notEmpty().withMessage('거동 상태를 입력해주세요.'),
  body('weight').optional({ nullable: true }).isFloat({ min: 0, max: 300 }).withMessage('체중은 0~300kg 사이여야 합니다.'),
  body('height').optional({ nullable: true }).isFloat({ min: 0, max: 300 }).withMessage('신장은 0~300cm 사이여야 합니다.'),
], guardianController.registerPatient);

// GET /patients - 환자 목록
router.get('/patients', guardianController.getPatients);

// PUT /patients/:id - 환자 정보 수정
router.put('/patients/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('환자 이름은 1~50자 이내여야 합니다.'),
  body('birthDate').optional().isISO8601().withMessage('유효한 생년월일을 입력해주세요.'),
  body('weight').optional({ nullable: true }).isFloat({ min: 0, max: 300 }).withMessage('체중은 0~300kg 사이여야 합니다.'),
  body('height').optional({ nullable: true }).isFloat({ min: 0, max: 300 }).withMessage('신장은 0~300cm 사이여야 합니다.'),
], guardianController.updatePatient);

// GET /care-history - 간병 이력
router.get('/care-history', guardianController.getCareHistory);

// GET /payments - 결제 내역
router.get('/payments', guardianController.getPayments);

export default router;
