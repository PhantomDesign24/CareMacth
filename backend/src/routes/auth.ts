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
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('비밀번호는 영문과 숫자를 모두 포함해야 합니다.'),
  body('name').notEmpty().trim().isLength({ min: 1, max: 50 }).withMessage('이름을 입력해주세요. (1~50자)'),
  body('phone')
    .notEmpty().withMessage('전화번호를 입력해주세요.')
    .matches(/^(01[016789]-?\d{3,4}-?\d{4}|0\d{1,2}-?\d{3,4}-?\d{4})$/)
    .withMessage('유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678)'),
  body('role').isIn(['GUARDIAN', 'CAREGIVER', 'HOSPITAL']).withMessage('유효한 역할을 선택해주세요.'),
], authController.register);

// 로그인
router.post('/login', [
  authLimiter,
  body('email').notEmpty().withMessage('아이디를 입력해주세요.'),
  body('password').notEmpty().withMessage('비밀번호를 입력해주세요.'),
], authController.login);

// 카카오 간편가입
router.post('/kakao', [
  authLimiter,
  body('accessToken').notEmpty().withMessage('카카오 액세스 토큰이 필요합니다.'),
], authController.kakaoAuth);

// 네이버 간편가입
router.post('/naver', [
  authLimiter,
  body('accessToken').notEmpty().withMessage('네이버 액세스 토큰이 필요합니다.'),
], authController.naverAuth);

// 내 정보 조회
router.get('/me', authenticate, authController.getMe);

// 토큰 갱신
router.post('/refresh', authenticate, authController.refreshToken);

// 비밀번호 재설정 (임시 비밀번호 발급)
router.post('/reset-password', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력해주세요.'),
], authController.resetPassword);

export default router;
