import { Response, NextFunction, Request } from 'express';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// GET /notices — 공개 목록 (게시된 것만, 고정→최신 순)
export const getPublicNotices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const category = req.query.category as string | undefined;
    const skip = (page - 1) * limit;

    const where: any = { isPublished: true };
    if (category) where.category = category;

    const [items, total] = await Promise.all([
      prisma.notice.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true, title: true, category: true, isPinned: true,
          viewCount: true, createdAt: true,
        },
      }),
      prisma.notice.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};

// GET /notices/:id — 공개 상세 (조회수 +1)
export const getPublicNoticeDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice || !notice.isPublished) {
      throw new AppError('공지사항을 찾을 수 없습니다.', 404);
    }
    // viewCount 증가 (실패해도 상세는 응답)
    prisma.notice.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    res.json({ success: true, data: notice });
  } catch (e) { next(e); }
};

// ============================================
// Admin
// ============================================

// GET /admin/notices — 전체 (비공개 포함)
export const adminListNotices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.notice.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
};

// POST /admin/notices — 등록
export const adminCreateNotice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, content, category, isPinned, isPublished } = req.body;
    if (!title || !content) {
      throw new AppError('제목과 내용은 필수입니다.', 400);
    }
    const validCategories = ['GENERAL', 'UPDATE', 'EVENT', 'MAINTENANCE'];
    const cat = category && validCategories.includes(category) ? category : 'GENERAL';
    const created = await prisma.notice.create({
      data: {
        title: String(title).slice(0, 200),
        content: String(content).slice(0, 50000),
        category: cat as any,
        isPinned: !!isPinned,
        isPublished: isPublished !== false,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (e) { next(e); }
};

// PUT /admin/notices/:id — 수정
export const adminUpdateNotice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, content, category, isPinned, isPublished } = req.body;
    const exist = await prisma.notice.findUnique({ where: { id } });
    if (!exist) throw new AppError('공지사항을 찾을 수 없습니다.', 404);
    const updated = await prisma.notice.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).slice(0, 200) }),
        ...(content !== undefined && { content: String(content).slice(0, 50000) }),
        ...(category !== undefined && { category }),
        ...(isPinned !== undefined && { isPinned: !!isPinned }),
        ...(isPublished !== undefined && { isPublished: !!isPublished }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
};

// DELETE /admin/notices/:id
export const adminDeleteNotice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.notice.delete({ where: { id } }).catch(() => {});
    res.json({ success: true });
  } catch (e) { next(e); }
};
