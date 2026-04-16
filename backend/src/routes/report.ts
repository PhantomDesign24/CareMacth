import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/auth';
import * as reportController from '../controllers/reportController';

const router = Router();

router.use(authenticate);

// POST /reports - 신고 등록
router.post('/', [
  body('targetType').isIn(['REVIEW', 'USER', 'CARE_RECORD', 'MESSAGE']).withMessage('유효한 신고 대상 유형을 선택해주세요.'),
  body('targetId').notEmpty().withMessage('신고 대상 ID가 필요합니다.'),
  body('reason').isIn(['INAPPROPRIATE', 'SPAM', 'ABUSE', 'FAKE', 'PRIVACY', 'OTHER']).withMessage('유효한 신고 사유를 선택해주세요.'),
  body('detail').optional().trim().isLength({ max: 1000 }).withMessage('상세 설명은 1000자 이내여야 합니다.'),
], reportController.createReport);

// GET /reports/my - 내 신고 이력
router.get('/my', reportController.getMyReports);

// POST /reports/blocks - 사용자 차단
router.post('/blocks', [
  body('userId').notEmpty().withMessage('차단할 사용자 ID가 필요합니다.'),
], reportController.createBlock);

// DELETE /reports/blocks/:userId - 차단 해제
router.delete('/blocks/:userId', reportController.removeBlock);

// GET /reports/blocks - 내 차단 목록
router.get('/blocks', reportController.getMyBlocks);

export default router;
