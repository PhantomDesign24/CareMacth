import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import * as disputeController from '../controllers/disputeController';

const router = Router();

router.use(authenticate);

// POST /disputes - 보호자/간병인 분쟁 접수
router.post('/', authorize('GUARDIAN', 'CAREGIVER'), disputeController.createDispute);

// GET /disputes - 내 분쟁 목록
router.get('/', disputeController.getMyDisputes);

// GET /disputes/admin - 관리자 전체 목록
router.get('/admin', authorize('ADMIN'), disputeController.adminGetDisputes);

// PATCH /disputes/admin/:id - 관리자 처리
router.patch('/admin/:id', authorize('ADMIN'), disputeController.adminUpdateDispute);

export default router;
