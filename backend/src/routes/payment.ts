import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/auth';
import { paymentLimiter } from '../middlewares/rateLimiter';
import * as paymentController from '../controllers/paymentController';

const router = Router();

// PDF 영수증: 쿼리스트링 토큰 허용 (새 탭 다운로드)
router.get(
  '/:id/receipt',
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  },
  authenticate,
  paymentController.generatePaymentReceipt,
);

// 모든 결제 라우트에 인증 필요
router.use(authenticate);

// POST / - 결제 생성
router.post('/', paymentLimiter, [
  body('contractId').notEmpty().withMessage('계약 ID가 필요합니다.'),
  body('method').notEmpty().withMessage('결제 방법을 선택해주세요.'),
  body('pointsUsed').optional().isInt({ min: 0 }).withMessage('포인트 사용량은 0 이상이어야 합니다.'),
], paymentController.createPayment);

// POST /confirm - 토스페이먼츠 결제 확인
router.post('/confirm', [
  body('paymentKey').notEmpty().withMessage('결제 키가 필요합니다.'),
  body('orderId').notEmpty().withMessage('주문 ID가 필요합니다.'),
  body('amount').notEmpty().isInt({ min: 1 }).withMessage('결제 금액은 1원 이상이어야 합니다.'),
], paymentController.confirmPayment);

// POST /:id/refund - 환불
router.post('/:id/refund', [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('환불 사유는 500자 이내여야 합니다.'),
  body('amount').optional().isInt({ min: 1 }).withMessage('환불 금액은 1원 이상이어야 합니다.'),
], paymentController.refundPayment);

// GET /history - 결제 이력
router.get('/history', paymentController.getPaymentHistory);

export default router;
