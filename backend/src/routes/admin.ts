import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import * as adminController from '../controllers/adminController';
import * as reportController from '../controllers/reportController';

const router = Router();

// 모든 관리자 라우트에 인증 + ADMIN 권한 필요
router.use(authenticate);
router.use(authorize('ADMIN'));

// 대시보드
router.get('/dashboard', adminController.getDashboard);

// 간병인 관리
router.get('/caregivers', adminController.getCaregivers);
router.get('/caregivers/:id', adminController.getCaregiverDetail);
router.put('/caregivers/:id/approve', adminController.approveCaregiver);
router.put('/caregivers/:id/reject', adminController.rejectCaregiver);
router.put('/caregivers/:id/blacklist', adminController.blacklistCaregiver);
router.put('/caregivers/:id/badge', adminController.grantBadge);
router.post('/caregivers/:id/penalty', [
  body('type').notEmpty().isIn(['NO_SHOW', 'CANCELLATION', 'COMPLAINT', 'MANUAL']).withMessage('유효한 패널티 유형을 선택해주세요. (NO_SHOW, CANCELLATION, COMPLAINT, MANUAL)'),
  body('reason').notEmpty().trim().isLength({ min: 1, max: 500 }).withMessage('패널티 사유를 입력해주세요. (1~500자)'),
], adminController.addPenalty);
router.post('/caregivers/:id/memo', [
  body('content').notEmpty().trim().isLength({ min: 1, max: 2000 }).withMessage('메모 내용을 입력해주세요. (1~2000자)'),
], adminController.addConsultMemo);
router.put('/caregivers/:caregiverId/certificates/:certId/verify', adminController.verifyCertificate);

// 알림 관리
router.get('/notifications', adminController.getNotifications);
router.post('/notifications/send', [
  body('title').notEmpty().trim().isLength({ min: 1, max: 200 }).withMessage('제목을 입력해주세요. (1~200자)'),
  body('body').notEmpty().trim().isLength({ min: 1, max: 2000 }).withMessage('내용을 입력해주세요. (1~2000자)'),
  body('target').notEmpty().isIn(['all', 'individual', 'all_devices', 'guardians', 'caregivers']).withMessage('발송 대상을 선택해주세요.'),
  body('type').optional().isIn(['MATCHING', 'APPLICATION', 'CONTRACT', 'PAYMENT', 'CARE_RECORD', 'EXTENSION', 'PENALTY', 'SYSTEM']).withMessage('유효한 알림 유형을 선택해주세요.'),
], adminController.sendNotification);
router.delete('/notifications/unsent', adminController.deleteUnsentNotifications);

// 간병 일감(요청) 관리
router.get('/care-requests', adminController.getCareRequests);
router.get('/care-requests/:id', adminController.getCareRequestDetail);

// 환자 관리
router.get('/patients', adminController.getPatients);
router.get('/patients/:id', adminController.getPatientDetail);
router.put('/patients/:id', adminController.updatePatientByAdmin);
router.delete('/patients/:id', adminController.deletePatientByAdmin);

// 통계
router.get('/stats', adminController.getStats);
router.get('/stats/export', adminController.exportStats);
router.get('/stats/export/caregivers', adminController.exportStats);
router.get('/stats/export/patients', adminController.exportStats);

// 분쟁
router.get('/disputes', adminController.getDisputes);

// 긴급 재매칭
router.post('/emergency-rematch/:contractId', [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('사유는 500자 이내여야 합니다.'),
], adminController.emergencyRematch);

// 긴급 재매칭 되돌리기 (새 매칭 없을 때만 가능)
router.post('/emergency-rematch/:contractId/revert', adminController.revertEmergencyRematch);

// 리뷰 숨김 해제
router.post('/reviews/:id/unhide', reportController.adminUnhideReview);

// 리뷰 숨김 처리 (재숨김)
router.post('/reviews/:id/hide', reportController.adminHideReview);

// 숨김 처리된 리뷰 목록
router.get('/reviews/hidden', reportController.adminGetHiddenReviews);

// 보험서류 신청 관리
import * as insuranceController from '../controllers/insuranceController';
import { upload as uploadMiddleware, handleUploadError as handleInsuranceUploadError } from '../middlewares/upload';
router.get('/insurance', insuranceController.adminListInsurance);
// PATCH: multipart(파일업로드) 또는 JSON 둘 다 허용
router.patch(
  '/insurance/:id',
  uploadMiddleware.single('document'),
  handleInsuranceUploadError,
  insuranceController.adminUpdateInsurance,
);

// 결제/정산 관리
router.get('/payments', adminController.getPayments);
router.get('/sidebar-badges', adminController.getSidebarBadges);
router.get('/additional-fees', adminController.adminListAdditionalFees);
router.get('/settlements', adminController.getSettlements);
router.post('/settlements/bulk-pay', adminController.bulkPaySettlements);
router.post('/settlements/:id/pay', adminController.paySettlement);

// 중간정산
router.get('/contracts/active-for-settlement', adminController.getActiveContractsForSettlement);
router.post('/contracts/:contractId/mid-settlement', adminController.createMidSettlement);

// 계약 통합 관리
router.get('/contracts/:contractId/detail', adminController.getAdminContractDetail);
router.post('/contracts/:contractId/force-cancel', adminController.forceCancelContract);
router.post('/contracts/:contractId/force-complete', adminController.forceCompleteContract);

// 환불 요청 관리 (2단계 플로우)
import * as paymentController from '../controllers/paymentController';
router.get('/refund-requests', paymentController.getRefundRequests);
router.post('/payments/:id/refund-approve', paymentController.approveRefundRequest);
router.post('/payments/:id/refund-reject', paymentController.rejectRefundRequest);

// 플랫폼 설정
router.get('/platform-config', adminController.getPlatformConfig);
router.put('/platform-config', [
  body('individualFeePercent').optional().isFloat({ min: 0, max: 100 }).withMessage('개인 수수료는 0~100% 사이여야 합니다.'),
  body('individualFeeFixed').optional().isInt({ min: 0 }).withMessage('개인 고정 수수료는 0 이상이어야 합니다.'),
  body('familyFeePercent').optional().isFloat({ min: 0, max: 100 }).withMessage('가족 수수료는 0~100% 사이여야 합니다.'),
  body('familyFeeFixed').optional().isInt({ min: 0 }).withMessage('가족 고정 수수료는 0 이상이어야 합니다.'),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('세율은 0~100% 사이여야 합니다.'),
  body('referralPoints').optional().isInt({ min: 0 }).withMessage('추천 포인트는 0 이상이어야 합니다.'),
  body('noShowPenaltyThreshold').optional().isInt({ min: 1 }).withMessage('노쇼 임계값은 1 이상이어야 합니다.'),
  body('badgeThreshold').optional().isInt({ min: 1 }).withMessage('뱃지 임계값은 1 이상이어야 합니다.'),
  body('associationFeeDefault').optional().isInt({ min: 0 }).withMessage('협회비 기본 금액은 0 이상이어야 합니다.'),
  body('cancellationFee').optional().isInt({ min: 0 }).withMessage('취소 수수료는 0 이상이어야 합니다.'),
], adminController.updatePlatformConfig);

// 프로모션
router.get('/promotions', adminController.getPromotions);
router.put('/promotions', [
  body('referralPoints').optional().isInt({ min: 0 }).withMessage('추천 포인트는 0 이상이어야 합니다.'),
  body('badgeThreshold').optional().isInt({ min: 1 }).withMessage('뱃지 임계값은 1 이상이어야 합니다.'),
], adminController.updatePromotions);

// 신고 관리 (iOS 심사 필수 - UGC 모더레이션)
router.get('/reports', require('../controllers/reportController').adminGetReports);
router.put('/reports/:id', require('../controllers/reportController').adminUpdateReport);

// 알림 템플릿 관리
router.get('/notification-templates', adminController.getNotificationTemplates);
router.post('/notification-templates', adminController.createNotificationTemplate);
router.put('/notification-templates/:id', adminController.updateNotificationTemplate);
router.delete('/notification-templates/:id', adminController.deleteNotificationTemplate);

// 협회비 월별 관리
router.get('/association-fees', adminController.getAssociationFees);
router.get('/association-fees/export', adminController.exportAssociationFees);
router.put('/association-fees/:caregiverId', [
  body('year').isInt({ min: 2020 }).withMessage('유효한 연도를 입력해주세요.'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('유효한 월을 입력해주세요.'),
  body('paid').isBoolean().withMessage('paid 값은 boolean이어야 합니다.'),
  body('amount').optional().isInt({ min: 0 }).withMessage('납부액은 0 이상이어야 합니다.'),
], adminController.updateAssociationFee);

// 교육 관리
router.get('/education', adminController.getAdminEducations);
router.post('/education', [
  body('title').notEmpty().trim().isLength({ min: 1, max: 200 }).withMessage('제목을 입력해주세요. (1~200자)'),
  body('duration').isInt({ min: 1 }).withMessage('소요시간은 1분 이상이어야 합니다.'),
  body('order').optional().isInt({ min: 0 }).withMessage('순서는 0 이상이어야 합니다.'),
], adminController.createEducation);
router.put('/education/:id', [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('제목은 1~200자여야 합니다.'),
  body('duration').optional().isInt({ min: 1 }).withMessage('소요시간은 1분 이상이어야 합니다.'),
  body('order').optional().isInt({ min: 0 }).withMessage('순서는 0 이상이어야 합니다.'),
], adminController.updateEducation);
router.delete('/education/:id', adminController.deleteEducation);

export default router;
