import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import * as placeController from '../controllers/placeController';

const router = Router();

// 병원 장소 검색 (로그인 사용자만 — 카카오 쿼터 보호)
router.get('/hospitals', authenticate, placeController.searchHospitals);

export default router;
