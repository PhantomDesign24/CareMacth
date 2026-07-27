import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { sendToAdmins } from '../services/notificationService';

// POST /api/business-inquiries  (공개) — 병원·기업 제휴 문의 접수
export const createBusinessInquiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName, contactName, phone, email, type, message } = (req.body || {}) as Record<string, string>;
    if (!companyName || !contactName || !phone) {
      throw new AppError('업체명, 담당자명, 연락처는 필수입니다.', 400);
    }
    const inquiry = await prisma.businessInquiry.create({
      data: {
        companyName: String(companyName).slice(0, 200),
        contactName: String(contactName).slice(0, 100),
        phone: String(phone).slice(0, 40),
        email: email ? String(email).slice(0, 200) : null,
        type: ['hospital', 'company', 'etc'].includes(type) ? type : 'hospital',
        message: message ? String(message).slice(0, 2000) : null,
      },
    });
    // 관리자 알림 (best-effort)
    sendToAdmins({
      key: 'BUSINESS_INQUIRY_ADMIN',
      vars: { companyName: inquiry.companyName, contactName: inquiry.contactName, phone: inquiry.phone },
      fallbackTitle: '새 제휴 문의 접수',
      fallbackBody: `${inquiry.companyName}(${inquiry.contactName}, ${inquiry.phone})에서 제휴 문의가 접수되었습니다.`,
      data: { inquiryId: inquiry.id, businessInquiry: true },
    }).catch(() => {});
    res.status(201).json({ success: true, data: { id: inquiry.id } });
  } catch (e) {
    next(e);
  }
};

// GET /api/admin/business-inquiries  (관리자) — 목록
export const getBusinessInquiries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const where: any = {};
    if (status === 'PENDING' || status === 'DONE') where.status = status;
    const limit = Math.min(parseInt(String(req.query.limit || '200')) || 200, 500);
    const rows = await prisma.businessInquiry.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    res.json({
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          companyName: r.companyName,
          contactName: r.contactName,
          phone: r.phone,
          email: r.email,
          type: r.type,
          message: r.message,
          status: r.status,
          adminNote: r.adminNote,
          createdAt: r.createdAt.toISOString(),
          processedAt: r.processedAt ? r.processedAt.toISOString() : null,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/admin/business-inquiries/:id/status  (관리자) — 처리완료/메모
export const updateBusinessInquiry = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = (req.body || {}) as Record<string, string>;
    const inquiry = await prisma.businessInquiry.findUnique({ where: { id } });
    if (!inquiry) throw new AppError('문의를 찾을 수 없습니다.', 404);
    const updated = await prisma.businessInquiry.update({
      where: { id },
      data: {
        ...(status === 'PENDING' || status === 'DONE' ? { status } : {}),
        ...(status === 'DONE' && !inquiry.processedAt ? { processedAt: new Date() } : {}),
        ...(adminNote !== undefined ? { adminNote: String(adminNote).slice(0, 2000) } : {}),
      },
    });
    res.json({ success: true, data: { id: updated.id, status: updated.status } });
  } catch (e) {
    next(e);
  }
};
