import { Response, NextFunction, Request } from 'express';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { logAdminAction } from '../services/auditLog';

// GET /api/banners — 공개: 현재 노출 가능한 배너 목록 (웹 메인)
export const listPublicBanners = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, title: true, subtitle: true, imageUrl: true,
        linkUrl: true, ctaLabel: true, bgColor: true,
      },
    });
    res.json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};

// GET /admin/banners — 관리자: 전체 목록
export const adminListBanners = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};

// 링크는 내부 경로(/...) 또는 http(s) 절대주소만 허용 — javascript:/data: 등 스킴 차단
const safeLink = (v: any): string | null => {
  const raw = v ? String(v).trim() : '';
  if (!raw) return null;
  if (/^\/(?!\/)/.test(raw)) return raw;            // 내부 경로
  if (/^https?:\/\/[^\s]+$/i.test(raw)) return raw;  // 외부 http(s)
  throw new AppError('링크는 / 로 시작하는 내부 경로이거나 http(s) 주소여야 합니다.', 400);
};
// 이미지 URL 은 업로드 경로만 허용 (외부 추적 리소스 차단)
const safeImage = (v: any): string | null => {
  const raw = v ? String(v).trim() : '';
  if (!raw) return null;
  if (/^\/uploads\//.test(raw)) return raw;
  throw new AppError('배너 이미지는 업로드한 파일만 사용할 수 있습니다.', 400);
};
// 날짜 입력(YYYY-MM-DD)은 KST 기준으로 해석 — 시작일 00:00, 종료일 23:59:59
const kstDate = (v: any, endOfDay = false): Date | null => {
  if (!v) return null;
  const raw = String(v).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`)
    : new Date(raw);
  if (isNaN(d.getTime())) throw new AppError('날짜 형식이 올바르지 않습니다.', 400);
  return d;
};

const parseBody = (body: any) => {
  const sortOrderRaw = parseInt(body?.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.max(-9999, Math.min(9999, sortOrderRaw)) : 0;
  const startAt = kstDate(body?.startAt);
  const endAt = kstDate(body?.endAt, true);
  if (startAt && endAt && endAt < startAt) {
    throw new AppError('노출 종료일은 시작일 이후여야 합니다.', 400);
  }
  return {
    title: String(body?.title || '').trim().slice(0, 100),
    subtitle: body?.subtitle ? String(body.subtitle).trim().slice(0, 200) : null,
    imageUrl: safeImage(body?.imageUrl),
    linkUrl: safeLink(body?.linkUrl),
    ctaLabel: body?.ctaLabel ? String(body.ctaLabel).trim().slice(0, 30) : null,
    bgColor: body?.bgColor && /^#[0-9a-fA-F]{3,8}$/.test(String(body.bgColor).trim())
      ? String(body.bgColor).trim() : null,
    sortOrder,
    isActive: body?.isActive !== false && body?.isActive !== 'false',
    startAt,
    endAt,
  };
};

// POST /admin/banners
export const adminCreateBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(req.body);
    if (!data.title) throw new AppError('배너 제목을 입력해주세요.', 400);
    if (!data.imageUrl && !data.bgColor) {
      throw new AppError('배너 이미지 또는 배경색 중 하나는 지정해주세요.', 400);
    }
    const banner = await prisma.banner.create({ data });
    await logAdminAction(req, 'ADMIN_CREATE_BANNER', {
      targetType: 'banner', targetId: banner.id, payload: { title: banner.title },
    });
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

// PUT /admin/banners/:id
export const adminUpdateBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exists = await prisma.banner.findUnique({ where: { id } });
    if (!exists) throw new AppError('배너를 찾을 수 없습니다.', 404);
    const data = parseBody(req.body);
    if (!data.title) throw new AppError('배너 제목을 입력해주세요.', 400);
    if (!data.imageUrl && !data.bgColor) {
      throw new AppError('배너 이미지 또는 배경색 중 하나는 지정해주세요.', 400);
    }
    const banner = await prisma.banner.update({ where: { id }, data });
    await logAdminAction(req, 'ADMIN_UPDATE_BANNER', {
      targetType: 'banner', targetId: id, payload: { title: banner.title },
    });
    res.json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

// DELETE /admin/banners/:id
export const adminDeleteBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exists = await prisma.banner.findUnique({ where: { id } });
    if (!exists) throw new AppError('배너를 찾을 수 없습니다.', 404);
    await prisma.banner.delete({ where: { id } });
    await logAdminAction(req, 'ADMIN_DELETE_BANNER', {
      targetType: 'banner', targetId: id, payload: { title: exists.title },
    });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (error) {
    next(error);
  }
};

// POST /admin/banners/upload — 배너 이미지 업로드
export const adminUploadBannerImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) throw new AppError('이미지 파일이 필요합니다.', 400);
    res.json({ success: true, data: { url: `/uploads/${file.filename}` } });
  } catch (error) {
    next(error);
  }
};
