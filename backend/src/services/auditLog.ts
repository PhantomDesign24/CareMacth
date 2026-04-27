import { Request } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middlewares/auth';

/**
 * 관리자 고권한 액션을 감사 로그로 기록.
 * 실패해도 본 동작은 영향받지 않음 (best-effort).
 */
export async function logAdminAction(
  req: AuthRequest,
  action: string,
  opts?: {
    targetType?: string;
    targetId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'ADMIN') return;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      (req as any).socket?.remoteAddress ||
      null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    await prisma.adminActionLog.create({
      data: {
        adminId: req.user.id,
        action,
        targetType: opts?.targetType,
        targetId: opts?.targetId,
        payload: (opts?.payload ?? null) as any,
        ip,
        userAgent,
      },
    });
  } catch (e) {
    // 로그 실패는 본 액션을 막지 않음
    console.error('[auditLog] 기록 실패:', (e as Error)?.message || e);
  }
}
