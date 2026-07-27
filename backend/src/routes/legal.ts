import { Router } from 'express';
import { getLegalDocument } from '../controllers/legalController';

const router = Router();

// 공개: 약관/개인정보처리방침 조회 (웹 페이지 렌더용)
router.get('/:type', getLegalDocument);

export default router;
