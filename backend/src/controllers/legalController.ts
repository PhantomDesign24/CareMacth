import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// 지원 문서 타입 → 기본 제목
const LEGAL_TYPES: Record<string, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
  location_terms: '위치기반서비스 이용약관',
};

// GET /api/legal/:type  (공개) — 웹 페이지 렌더용. 미등록이면 data:null (프론트가 정적 폴백)
export const getLegalDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    if (!LEGAL_TYPES[type]) throw new AppError('유효하지 않은 문서 유형입니다.', 400);
    const doc = await prisma.legalDocument.findUnique({ where: { type } });
    res.json({
      success: true,
      data: doc
        ? {
            type: doc.type,
            title: doc.title,
            content: doc.content,
            effectiveDate: doc.effectiveDate ? doc.effectiveDate.toISOString().slice(0, 10) : null,
            updatedAt: doc.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/admin/legal  (관리자) — 전체 문서 목록 (없는 타입은 빈 값으로 채워 반환)
export const getLegalDocumentsAdmin = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.legalDocument.findMany();
    const byType = new Map(rows.map((r) => [r.type, r]));
    const items = Object.entries(LEGAL_TYPES).map(([type, defTitle]) => {
      const d = byType.get(type);
      return {
        type,
        title: d?.title || defTitle,
        content: d?.content || '',
        effectiveDate: d?.effectiveDate ? d.effectiveDate.toISOString().slice(0, 10) : null,
        updatedAt: d?.updatedAt ? d.updatedAt.toISOString() : null,
      };
    });
    res.json({ success: true, data: { items } });
  } catch (e) {
    next(e);
  }
};

// PUT /api/admin/legal/:type  (관리자) — 문서 저장(upsert)
export const upsertLegalDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    if (!LEGAL_TYPES[type]) throw new AppError('유효하지 않은 문서 유형입니다.', 400);
    const { title, content, effectiveDate } = (req.body || {}) as Record<string, string>;
    if (!content || !String(content).trim()) throw new AppError('본문을 입력해주세요.', 400);
    const data = {
      title: (title && String(title).trim()) || LEGAL_TYPES[type],
      content: String(content),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
    };
    const doc = await prisma.legalDocument.upsert({
      where: { type },
      create: { type, ...data },
      update: data,
    });
    res.json({ success: true, data: { type: doc.type, updatedAt: doc.updatedAt.toISOString() } });
  } catch (e) {
    next(e);
  }
};
