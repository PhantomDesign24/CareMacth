import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { config } from '../config';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { generateReferralCode } from '../utils/generateCode';
import { sendToAdmins } from '../services/notificationService';

const generateToken = (user: { id: string; email: string; role: string }) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: '7d' }
  );
};

const generateRefreshToken = (user: { id: string; email: string; role: string }) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: '30d' }
  );
};

const tokenPair = (user: { id: string; email: string; role: string }) => {
  const access_token = generateToken(user);
  const refresh_token = generateRefreshToken(user);
  return { token: access_token, access_token, refresh_token };
};

// 일반 회원가입
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, name, phone, role: rawRole, referredBy, careType } = req.body;

    // Normalize role: frontend may send lowercase "guardian"/"caregiver"/"hospital"
    const roleMap: Record<string, string> = { guardian: 'GUARDIAN', caregiver: 'CAREGIVER', hospital: 'HOSPITAL' };
    const role = roleMap[rawRole?.toLowerCase()] || rawRole?.toUpperCase() || rawRole;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existingUser) {
      throw new AppError('이미 가입된 이메일 또는 전화번호입니다.', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const referralCode = generateReferralCode();

    // 플랫폼 설정에서 추천 포인트 가져오기
    const platformConfig = await prisma.platformConfig.findFirst();
    const referralPoints = platformConfig?.referralPoints || 10000;

    // 추천인 처리 — 추천인과 신규 가입자 양쪽에 포인트 지급
    let referrerUserId: string | undefined;
    let welcomePoints = 0;
    if (referredBy) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referredBy },
      });
      if (referrer) {
        referrerUserId = referrer.id;
        welcomePoints = referralPoints;
        // 추천인에게 포인트 지급
        await prisma.user.update({
          where: { id: referrer.id },
          data: { points: { increment: referralPoints } },
        });
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        referralCode,
        referredBy: referrerUserId,
        points: welcomePoints,
        ...(role === 'GUARDIAN' && {
          guardian: {
            create: {},
          },
        }),
        ...(role === 'CAREGIVER' && {
          caregiver: {
            create: {},
          },
        }),
        ...(role === 'HOSPITAL' && {
          // 병원도 간병 요청을 생성할 수 있도록 guardian 레코드 함께 생성
          guardian: {
            create: {},
          },
          hospital: {
            create: {
              name: req.body.hospitalName || name,
              address: req.body.address || '',
            },
          },
        }),
      },
      include: {
        guardian: role === 'GUARDIAN',
        caregiver: role === 'CAREGIVER',
        hospital: role === 'HOSPITAL',
      },
    });

    const tokens = tokenPair(user);

    // 간병인 가입 시 관리자 전원에게 알림
    if (role === 'CAREGIVER') {
      await sendToAdmins({
        key: 'CAREGIVER_SIGNUP_PENDING_ADMIN',
        vars: { caregiverName: user.name },
        data: { caregiverId: (user as any).caregiver?.id, userId: user.id },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: { user: { ...user, password: undefined }, ...tokens },
    });
  } catch (error) {
    next(error);
  }
};

// 로그인
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { guardian: true, caregiver: true, hospital: true },
    });

    if (!user || !user.password) {
      throw new AppError('이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    if (user.deletedAt) {
      throw new AppError('탈퇴한 계정입니다. 새로 가입해주세요.', 403);
    }

    if (!user.isActive) {
      throw new AppError('비활성화된 계정입니다.', 403);
    }

    // 간병인 승인 상태 확인
    if (user.role === 'CAREGIVER' && user.caregiver?.status !== 'APPROVED') {
      throw new AppError('관리자 승인 대기 중입니다.', 403);
    }

    const tokens = tokenPair(user);

    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, ...tokens },
    });
  } catch (error) {
    next(error);
  }
};

// 카카오 간편 로그인
export const kakaoAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { accessToken: bodyToken, code, redirectUri, role } = req.body;
    let accessToken = bodyToken;

    // code 플로우: 카카오 /oauth/token 교환
    if (!accessToken && code) {
      const clientId = process.env.KAKAO_CLIENT_ID;
      const clientSecret = process.env.KAKAO_CLIENT_SECRET;
      if (!clientId) {
        throw new AppError('KAKAO_CLIENT_ID 환경변수가 설정되지 않았습니다.', 500);
      }
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', clientId);
      if (clientSecret) params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri || '');
      params.append('code', code);

      const tokenRes = await axios.post(
        'https://kauth.kakao.com/oauth/token',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      accessToken = tokenRes.data.access_token;
    }

    if (!accessToken) {
      throw new AppError('accessToken 또는 code가 필요합니다.', 400);
    }

    // 카카오 사용자 정보 조회
    const kakaoUser = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id, kakao_account } = kakaoUser.data;
    const email = kakao_account?.email;
    const name = kakao_account?.profile?.nickname;
    const phone = kakao_account?.phone_number?.replace('+82 ', '0').replace(/-/g, '');

    let user = await prisma.user.findFirst({
      where: { socialId: String(id), authProvider: 'KAKAO' },
      include: { guardian: true, caregiver: true },
    });

    if (!user) {
      if (!role) {
        return res.json({
          success: true,
          data: { isNew: true, socialId: String(id), email, name, phone },
        });
      }

      const referralCode = generateReferralCode();
      user = await prisma.user.create({
        data: {
          email: email || `kakao_${id}@carematch.kr`,
          name: name || '카카오 사용자',
          phone: phone || `kakao_${id}`,
          role,
          authProvider: 'KAKAO',
          socialId: String(id),
          referralCode,
          ...(role === 'GUARDIAN' && { guardian: { create: {} } }),
          ...(role === 'CAREGIVER' && { caregiver: { create: {} } }),
        },
        include: { guardian: true, caregiver: true },
      });
    }

    const tokens = tokenPair(user);

    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, ...tokens, isNew: false },
    });
  } catch (error) {
    next(error);
  }
};

// 네이버 간편 로그인
export const naverAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { accessToken: bodyToken, code, state, role } = req.body;
    let accessToken = bodyToken;

    // code 플로우: 네이버 /oauth2.0/token 교환
    if (!accessToken && code) {
      const clientId = process.env.NAVER_CLIENT_ID;
      const clientSecret = process.env.NAVER_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new AppError('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.', 500);
      }
      const tokenRes = await axios.get('https://nid.naver.com/oauth2.0/token', {
        params: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          state: state || '',
        },
      });
      accessToken = tokenRes.data.access_token;
    }

    if (!accessToken) {
      throw new AppError('accessToken 또는 code가 필요합니다.', 400);
    }

    const naverUser = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id, email, name, mobile } = naverUser.data.response;

    let user = await prisma.user.findFirst({
      where: { socialId: String(id), authProvider: 'NAVER' },
      include: { guardian: true, caregiver: true },
    });

    if (!user) {
      if (!role) {
        return res.json({
          success: true,
          data: { isNew: true, socialId: String(id), email, name, phone: mobile },
        });
      }

      const referralCode = generateReferralCode();
      user = await prisma.user.create({
        data: {
          email: email || `naver_${id}@carematch.kr`,
          name: name || '네이버 사용자',
          phone: mobile || `naver_${id}`,
          role,
          authProvider: 'NAVER',
          socialId: String(id),
          referralCode,
          ...(role === 'GUARDIAN' && { guardian: { create: {} } }),
          ...(role === 'CAREGIVER' && { caregiver: { create: {} } }),
        },
        include: { guardian: true, caregiver: true },
      });
    }

    const tokens = tokenPair(user);

    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, ...tokens, isNew: false },
    });
  } catch (error) {
    next(error);
  }
};

// 내 정보
export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { guardian: true, caregiver: true, hospital: true },
    });

    if (!user) {
      throw new AppError('사용자 정보를 찾을 수 없습니다.', 404);
    }

    res.json({
      success: true,
      data: { user: { ...user, password: undefined } },
    });
  } catch (error) {
    next(error);
  }
};

// 토큰 갱신
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refresh = req.body?.refresh_token || req.body?.refreshToken;
    if (!refresh) {
      throw new AppError('리프레시 토큰이 필요합니다.', 400);
    }

    let payload: any;
    try {
      payload = jwt.verify(refresh, config.jwt.secret);
    } catch {
      throw new AppError('유효하지 않거나 만료된 리프레시 토큰입니다.', 401);
    }

    if (payload?.type !== 'refresh') {
      throw new AppError('리프레시 토큰이 아닙니다.', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive) {
      throw new AppError('유효하지 않은 사용자입니다.', 401);
    }

    const tokens = tokenPair(user);
    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
};

// 비밀번호 재설정 (임시 비밀번호 발급)
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError('해당 이메일로 가입된 계정을 찾을 수 없습니다.', 404);
    }

    if (!user.password) {
      throw new AppError('소셜 로그인 계정은 비밀번호 재설정이 불가합니다. 소셜 로그인을 이용해주세요.', 400);
    }

    // 8자리 임시 비밀번호 생성 (영문+숫자 조합)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      data: { tempPassword },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /me - 회원 탈퇴 (soft delete)
export const deleteAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password, reason } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { guardian: true, caregiver: true },
    });

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404);
    }

    // 비밀번호 확인 (소셜 로그인은 스킵)
    if (user.authProvider === 'LOCAL') {
      if (!password) {
        throw new AppError('비밀번호를 입력해주세요.', 400);
      }
      if (!user.password) {
        throw new AppError('비밀번호가 설정되지 않은 계정입니다.', 400);
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new AppError('비밀번호가 일치하지 않습니다.', 401);
      }
    }

    // 진행 중인 계약 확인
    if (user.guardian) {
      const activeContracts = await prisma.contract.count({
        where: {
          guardianId: user.guardian.id,
          status: { in: ['ACTIVE', 'EXTENDED'] },
        },
      });
      if (activeContracts > 0) {
        throw new AppError(`진행 중인 간병 계약이 ${activeContracts}건 있어 탈퇴할 수 없습니다. 계약 완료 또는 취소 후 다시 시도해주세요.`, 400);
      }
    }
    if (user.caregiver) {
      const activeContracts = await prisma.contract.count({
        where: {
          caregiverId: user.caregiver.id,
          status: { in: ['ACTIVE', 'EXTENDED'] },
        },
      });
      if (activeContracts > 0) {
        throw new AppError(`진행 중인 간병 계약이 ${activeContracts}건 있어 탈퇴할 수 없습니다. 계약 완료 후 다시 시도해주세요.`, 400);
      }
    }

    // 미정산 금액 확인 (간병인)
    if (user.caregiver) {
      const unpaidEarnings = await prisma.earning.count({
        where: {
          caregiverId: user.caregiver.id,
          isPaid: false,
        },
      });
      if (unpaidEarnings > 0) {
        throw new AppError(`미정산 수익이 ${unpaidEarnings}건 있습니다. 정산 완료 후 탈퇴 가능합니다.`, 400);
      }
    }

    // Soft delete + 개인정보 익명화
    const timestamp = Date.now();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          // 개인정보 익명화 (GDPR/개인정보보호법 준수)
          email: `deleted_${timestamp}_${user.id.slice(0, 8)}@deleted.local`,
          phone: `DELETED_${timestamp}`,
          name: '(탈퇴회원)',
          password: null,
          profileImage: null,
          fcmToken: null,
          socialId: null,
        },
      });

      // 기기 토큰 해제
      await tx.deviceToken.updateMany({
        where: { userId: user.id },
        data: { userId: null },
      });

      // 탈퇴 이력 로그 (선택, notification으로 대체)
      if (reason) {
        console.log(`[탈퇴] userId=${user.id}, reason="${reason}"`);
      }
    });

    res.json({
      success: true,
      message: '회원 탈퇴가 완료되었습니다. 그동안 케어매치를 이용해주셔서 감사합니다.',
    });
  } catch (error) {
    next(error);
  }
};
