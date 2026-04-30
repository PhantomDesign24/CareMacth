import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

// 쿼리스트링 토큰 허용 (이미지 src 등 헤더 못 보내는 케이스)
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

router.use(authenticate);

// GET /api/files/private/:filename — 인증 + 소유권 검증 후 비공개 업로드 파일 스트리밍
// — 본인이 등록한 파일이거나 ADMIN 만 접근 가능
router.get('/private/:filename', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filename = String(req.params.filename || '');
    // 경로 traversal 방지 — basename 만 허용
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new AppError('잘못된 파일 경로입니다.', 400);
    }

    const fullPath = path.join(process.cwd(), 'uploads', 'private', filename);
    if (!fs.existsSync(fullPath)) {
      throw new AppError('파일을 찾을 수 없습니다.', 404);
    }

    const role = req.user!.role;
    const userId = req.user!.id;
    const publicUrl = `/api/files/private/${filename}`;
    const legacyUrl = `/uploads/private/${filename}`;

    // ADMIN 은 통과
    if (role !== 'ADMIN') {
      // 어느 엔티티가 이 파일을 참조하는지 검색하여 소유권 검증
      const [caregiverByIdCard, caregiverByCriminal, certificateMatch, insuranceMatch] = await Promise.all([
        prisma.caregiver.findFirst({
          where: { OR: [{ idCardImage: publicUrl }, { idCardImage: legacyUrl }] },
          select: { userId: true },
        }),
        prisma.caregiver.findFirst({
          where: { OR: [{ criminalCheckDoc: publicUrl }, { criminalCheckDoc: legacyUrl }] },
          select: { userId: true },
        }),
        prisma.certificate.findFirst({
          where: { OR: [{ imageUrl: publicUrl }, { imageUrl: legacyUrl }] },
          select: { caregiverId: true },
        }),
        prisma.insuranceDocRequest.findFirst({
          where: { OR: [{ documentUrl: publicUrl }, { documentUrl: legacyUrl }] },
          select: { requestedBy: true },
        }),
      ]);

      const allowedUserIds = new Set<string>();
      if (caregiverByIdCard?.userId) allowedUserIds.add(caregiverByIdCard.userId);
      if (caregiverByCriminal?.userId) allowedUserIds.add(caregiverByCriminal.userId);
      if (certificateMatch?.caregiverId) {
        const cg = await prisma.caregiver.findUnique({ where: { id: certificateMatch.caregiverId }, select: { userId: true } });
        if (cg?.userId) allowedUserIds.add(cg.userId);
      }
      if (insuranceMatch?.requestedBy) allowedUserIds.add(insuranceMatch.requestedBy);

      if (!allowedUserIds.has(userId)) {
        throw new AppError('이 파일에 접근할 권한이 없습니다.', 403);
      }
    }

    // 캐시 차단 (민감 파일이므로 중간 캐시·CDN 저장 막음)
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
});

export default router;
