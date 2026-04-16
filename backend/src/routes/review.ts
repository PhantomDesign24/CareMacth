import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/auth';
import * as reviewController from '../controllers/reviewController';

const router = Router();

// 모든 리뷰 라우트에 인증 필요
router.use(authenticate);

// POST / - 리뷰 작성
router.post('/', [
  body('contractId').notEmpty().withMessage('계약 ID가 필요합니다.'),
  body('rating').isFloat({ min: 1, max: 5 }).withMessage('평점은 1~5 사이의 값이어야 합니다.'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('리뷰는 1000자 이내여야 합니다.'),
], reviewController.createReview);

// GET /caregiver/:caregiverId - 간병인 리뷰 조회
router.get('/caregiver/:caregiverId', reviewController.getCaregiverReviews);

// GET /my - 내가 받은 리뷰 (간병인)
router.get('/my', reviewController.getMyReceivedReviews);

export default router;
