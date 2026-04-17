import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import * as educationController from '../controllers/educationController';

const router = Router();

// 모든 교육 라우트에 인증 필요 (간병인)
router.use(authenticate);
router.use(authorize('CAREGIVER'));

// GET / - 교육 목록
router.get('/', educationController.getEducations);

// POST /:id/progress - 수강 진행도 업데이트
router.post('/:id/progress', [
  body('progress').isFloat({ min: 0, max: 100 }).withMessage('진행도는 0~100 사이의 값이어야 합니다.'),
], educationController.updateProgress);

// GET /certificate/:id - 수료증 발급
router.get('/certificate/:id', educationController.getCertificate);

// GET /certificate/:id/download - 수료증 HTML 다운로드
router.get('/certificate/:id/download', educationController.downloadCertificate);

// GET /certificate/:id/pdf - 수료증 PDF 다운로드 (pdfkit)
router.get('/certificate/:id/pdf', educationController.downloadCertificatePdf);

export default router;
