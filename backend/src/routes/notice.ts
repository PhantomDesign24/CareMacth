import { Router } from 'express';
import * as noticeController from '../controllers/noticeController';

const router = Router();

// 공개 — 인증 불필요
router.get('/', noticeController.getPublicNotices);
router.get('/:id', noticeController.getPublicNoticeDetail);

export default router;
