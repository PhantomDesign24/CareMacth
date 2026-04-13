import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import { matchingLimiter } from '../middlewares/rateLimiter';
import * as matchingController from '../controllers/matchingController';

const router = Router();

// 모든 매칭 라우트에 인증 필요
router.use(authenticate);

// POST /auto/:careRequestId - 자동 매칭 실행 (보호자, 관리자만)
router.post('/auto/:careRequestId', [
  authorize('GUARDIAN', 'ADMIN'),
  matchingLimiter,
  param('careRequestId').notEmpty().withMessage('간병 요청 ID가 필요합니다.'),
], matchingController.autoMatch);

// GET /candidates/:careRequestId - 후보군 조회 (보호자, 관리자만)
router.get('/candidates/:careRequestId',
  authorize('GUARDIAN', 'ADMIN'),
  matchingController.getCandidates,
);

export default router;
