import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../app';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

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
    });

    if (!user || !user.isActive) {
      throw new AppError('유효하지 않은 사용자입니다.', 401);
    }
    // tokenVersion 일치 — 탈취·로그아웃·탈퇴 후 무효화된 토큰 거부
    if (typeof decoded.v === 'number' && decoded.v !== user.tokenVersion) {
      throw new AppError('세션이 만료되었습니다. 다시 로그인해주세요.', 401);
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('인증에 실패했습니다.', 401));
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('접근 권한이 없습니다.', 403));
    }
    // ADMIN은 모든 권한 보유
    if (req.user.role === 'ADMIN' || roles.includes(req.user.role)) {
      return next();
    }
    return next(new AppError('접근 권한이 없습니다.', 403));
  };
};
