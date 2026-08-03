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

const parseBody = (body: any) => ({
  title: String(body?.title || '').trim(),
  subtitle: body?.subtitle ? String(body.subtitle).trim() : null,
  imageUrl: body?.imageUrl ? String(body.imageUrl).trim() : null,
  linkUrl: body?.linkUrl ? String(body.linkUrl).trim() : null,
  ctaLabel: body?.ctaLabel ? String(body.ctaLabel).trim() : null,
  bgColor: body?.bgColor ? String(body.bgColor).trim() : null,
  sortOrder: Number.isFinite(parseInt(body?.sortOrder)) ? parseInt(body.sortOrder) : 0,
  isActive: body?.isActive !== false && body?.isActive !== 'false',
  startAt: body?.startAt ? new Date(body.startAt) : null,
  endAt: body?.endAt ? new Date(body.endAt) : null,
});

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
