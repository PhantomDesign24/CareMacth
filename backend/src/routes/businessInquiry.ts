import { Router } from 'express';
import { createBusinessInquiry } from '../controllers/businessInquiryController';

const router = Router();

// 공개: 병원·기업 제휴 문의 접수 (홈페이지 /business 폼)
router.post('/', createBusinessInquiry);

export default router;
