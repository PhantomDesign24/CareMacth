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

const generateToken = (user: { id: string; email: string; role: string }) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: '7d' }
  );
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

    // 추천인 처리
    let referrerUserId: string | undefined;
    if (referredBy) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referredBy },
      });
      if (referrer) {
        referrerUserId = referrer.id;
        // 추천인에게 포인트 지급
        await prisma.user.update({
          where: { id: referrer.id },
          data: { points: { increment: 10000 } },
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

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: { user: { ...user, password: undefined }, token },
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

    if (!user.isActive) {
      throw new AppError('비활성화된 계정입니다.', 403);
    }

    // 간병인 승인 상태 확인
    if (user.role === 'CAREGIVER' && user.caregiver?.status !== 'APPROVED') {
      throw new AppError('관리자 승인 대기 중입니다.', 403);
    }

    const token = generateToken(user);

    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, token },
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

    const { accessToken, role } = req.body;

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

    const token = generateToken(user);

    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, token, isNew: false },
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

    const { accessToken, role } = req.body;

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

    const token = generateToken(user);

    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, token, isNew: false },
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
export const refreshToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = generateToken(req.user!);
    res.json({ success: true, data: { token } });
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
