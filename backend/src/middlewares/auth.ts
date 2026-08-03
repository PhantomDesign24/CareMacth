import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../app';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;      // 주 역할 (가입 시 선택, 대시보드 기본값)
    roles?: string[];  // 실제 보유 역할 — 관리자가 역할을 추가하면 여기에 반영된다
  };
}

// 보유 프로필 기준으로 실제 사용 가능한 역할 목록을 만든다.
//  (관리자가 기존 계정에 간병인/보호자 프로필을 추가한 경우 그 역할도 쓸 수 있어야 함)
const resolveRoles = (user: any): string[] => {
  const roles = new Set<string>([user.role]);
  if (user.guardian) roles.add('GUARDIAN');
  // 간병인 권한은 승인(APPROVED) 된 프로필에만 부여 — 미승인 프로필로 권한이 새지 않도록
  if (user.caregiver && user.caregiver.status === 'APPROVED') roles.add('CAREGIVER');
  if (user.hospital) roles.add('HOSPITAL');
  return [...roles];
};

const PROFILE_INCLUDE = {
  guardian: { select: { id: true } },
  caregiver: { select: { id: true, status: true } },
  hospital: { select: { id: true } },
} as const;

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('인증 토큰이 필요합니다.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      role: string;
      v?: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: PROFILE_INCLUDE,
    });

    if (!user || !user.isActive) {
      throw new AppError('유효하지 않은 사용자입니다.', 401);
    }
    // tokenVersion 일치 — 탈취·로그아웃·탈퇴 후 무효화된 토큰 거부.
    // v 가 없는 옛 토큰은 신뢰할 수 없으므로 즉시 401.
    if (typeof decoded.v !== 'number' || decoded.v !== user.tokenVersion) {
      throw new AppError('세션이 만료되었습니다. 다시 로그인해주세요.', 401);
    }

    req.user = { id: user.id, email: user.email, role: user.role, roles: resolveRoles(user) };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('인증에 실패했습니다.', 401));
    }
  }
};

// 선택적 인증 — 토큰이 있으면 검증해서 req.user 세팅, 없으면 그대로 통과 (비회원 허용 라우트용)
export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; email: string; role: string; v?: number };
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, include: PROFILE_INCLUDE });
    if (!user || !user.isActive) return next(); // 잘못된 토큰은 비회원으로 처리
    if (typeof decoded.v !== 'number' || decoded.v !== user.tokenVersion) return next();
    req.user = { id: user.id, email: user.email, role: user.role, roles: resolveRoles(user) };
    next();
  } catch {
    next();
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('접근 권한이 없습니다.', 403));
    }
    // ADMIN은 모든 권한 보유. 그 외에는 "보유한 역할" 중 하나라도 맞으면 통과
    //  (관리자가 추가해 준 역할도 실제로 사용할 수 있게 — 중복가입 대신 역할 추가 방식)
    const owned = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
    if (req.user.role === 'ADMIN' || owned.some((r) => roles.includes(r))) {
      return next();
    }
    return next(new AppError('접근 권한이 없습니다.', 403));
  };
};
