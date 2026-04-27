import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import * as educationController from '../controllers/educationController';

const router = Router();

// 수료증 PDF: 쿼리스트링 토큰 허용 (window.open 다운로드용)
// authenticate 전에 위치해야 헤더 변환이 작동함
router.get(
  '/certificate/:id/pdf',
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  },
  authenticate,
  authorize('CAREGIVER'),
  educationController.downloadCertificatePdf,
);

// 그 외 모든 교육 라우트는 인증 + 간병인 권한
router.use(authenticate);
router.use(authorize('CAREGIVER'));

// GET / - 교육 목록
router.get('/', educationController.getEducations);

// POST /:id/progress - (레거시) 수강 진행도 직접 업데이트
router.post('/:id/progress', [
  body('progress').isFloat({ min: 0, max: 100 }).withMessage('진행도는 0~100 사이의 값이어야 합니다.'),
], educationController.updateProgress);

// POST /:id/heartbeat - 서버 기반 시청 진도 (부정 방지)
router.post('/:id/heartbeat', [
  body('videoTime').isFloat({ min: 0 }).withMessage('videoTime은 0 이상의 숫자여야 합니다.'),
  body('duration').isFloat({ min: 1 }).withMessage('duration은 1 이상의 숫자여야 합니다.'),
  body('playing').optional().isBoolean(),
], educationController.heartbeat);

// POST /:id/complete - 명시적 수료 처리 (80% 이상 시청 필수)
router.post('/:id/complete', educationController.completeEducation);

// GET /certificate/:id - 수료증 발급
router.get('/certificate/:id', educationController.getCertificate);

// GET /certificate/:id/download - 수료증 HTML 다운로드
router.get('/certificate/:id/download', educationController.downloadCertificate);

// (PDF 라우트는 위에서 쿼리스트링 토큰 처리 포함하여 정의됨)

export default router;
