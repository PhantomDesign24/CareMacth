import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

// 일반 회원가입
router.post('/register', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력해주세요.'),
  body('password')
    .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
    .withMessage('비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.'),
  body('name').notEmpty().trim().isLength({ min: 1, max: 50 }).withMessage('이름을 입력해주세요. (1~50자)'),
  body('phone')
    .notEmpty().withMessage('전화번호를 입력해주세요.')
    .matches(/^(01[016789]-?\d{3,4}-?\d{4}|0\d{1,2}-?\d{3,4}-?\d{4})$/)
    .withMessage('유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678)'),
  body('role').isIn(['GUARDIAN', 'CAREGIVER', 'HOSPITAL']).withMessage('유효한 역할을 선택해주세요.'),
  body('agreeTerms').custom((v) => v === true).withMessage('이용약관 동의가 필요합니다.'),
  body('agreePrivacy').custom((v) => v === true).withMessage('개인정보 처리방침 동의가 필요합니다.'),
  body('hospitalName').if(body('role').equals('HOSPITAL'))
    .notEmpty().withMessage('병원명을 입력해주세요.')
    .isLength({ max: 100 }).withMessage('병원명은 100자 이내여야 합니다.'),
  body('businessNumber').if(body('role').equals('HOSPITAL'))
    .notEmpty().withMessage('사업자등록번호를 입력해주세요.')
    .matches(/^\d{3}-?\d{2}-?\d{5}$/).withMessage('사업자등록번호 형식이 올바르지 않습니다.'),
  body('birthDate').if(body('role').equals('CAREGIVER')).optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('생년월일 형식이 올바르지 않습니다.'),
  body('gender').if(body('role').equals('CAREGIVER')).optional({ nullable: true, checkFalsy: true })
    .isIn(['M', 'F']).withMessage('성별이 올바르지 않습니다.'),
  body('experienceYears').if(body('role').equals('CAREGIVER')).optional({ nullable: true })
    .isInt({ min: 0, max: 80 }).withMessage('경력 연수가 올바르지 않습니다.'),
], authController.register);

// 로그인
router.post('/login', [
  authLimiter,
  body('email').notEmpty().withMessage('아이디를 입력해주세요.'),
  body('password').notEmpty().withMessage('비밀번호를 입력해주세요.'),
], authController.login);

// 카카오 간편가입/로그인 (accessToken 또는 code 지원)
router.post('/kakao', [authLimiter], authController.kakaoAuth);

// 네이버 간편가입/로그인 (accessToken 또는 code 지원)
router.post('/naver', [authLimiter], authController.naverAuth);

// 소셜 가입 마무리 (역할 + 부가정보 + signupToken)
router.post('/social/complete', [
  authLimiter,
  body('signupToken').notEmpty().withMessage('가입 토큰이 필요합니다.'),
  body('role').isIn(['GUARDIAN', 'CAREGIVER', 'HOSPITAL', 'guardian', 'caregiver', 'hospital']).withMessage('유효한 역할을 선택해주세요.'),
  body('name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 1, max: 50 }).withMessage('이름은 1~50자여야 합니다.'),
  body('phone').optional({ nullable: true, checkFalsy: true })
    .matches(/^(01[016789]-?\d{3,4}-?\d{4}|0\d{1,2}-?\d{3,4}-?\d{4})$/).withMessage('유효한 전화번호 형식이 아닙니다.'),
  body('hospitalName').if((value, { req }) => String(req.body.role || '').toUpperCase() === 'HOSPITAL')
    .notEmpty().withMessage('병원명을 입력해주세요.'),
  body('businessNumber').if((value, { req }) => String(req.body.role || '').toUpperCase() === 'HOSPITAL')
    .notEmpty().withMessage('사업자등록번호를 입력해주세요.')
    .matches(/^\d{3}-?\d{2}-?\d{5}$/).withMessage('사업자등록번호 형식이 올바르지 않습니다.'),
], authController.socialSignupComplete);

// 내 정보 조회
router.get('/me', authenticate, authController.getMe);

// 회원 탈퇴 (soft delete)
router.delete('/me', authenticate, [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('사유는 500자 이내여야 합니다.'),
], authController.deleteAccount);

// 토큰 갱신 (refresh_token body 필요, 액세스 토큰 만료 여부 무관)
router.post('/refresh', authController.refreshToken);

// 비밀번호 재설정 — 1단계: 이메일로 일회성 재설정 링크 발송
router.post('/reset-password', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력해주세요.'),
], authController.resetPassword);

// 비밀번호 재설정 — 2단계: 토큰 + 새 비밀번호로 변경
router.post('/reset-password/confirm', [
  authLimiter,
  body('token').notEmpty().withMessage('재설정 토큰이 필요합니다.'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
    .withMessage('비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.'),
], authController.confirmResetPassword);

export default router;
