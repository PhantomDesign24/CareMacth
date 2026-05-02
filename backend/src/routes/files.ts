import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { config } from '../config';

const router = Router();

// ─────────────────────────────────────────────────────────────
// 1) 보험 서류 1회용 토큰 다운로드 (인증 미들웨어 앞에 정의 — 카톡 알림톡 버튼 클릭용)
//    JWT type='insurance_dl' 검증, requestId 일치 시 파일 스트리밍
//    토큰 자체가 인증이므로 user 세션 없어도 동작
// ─────────────────────────────────────────────────────────────
router.get('/insurance/:requestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = String(req.params.requestId || '');
    const tokenStr = String(req.query.t || req.query.token || '');
    if (!requestId || !tokenStr) {
      throw new AppError('잘못된 다운로드 링크입니다.', 400);
    }

    let payload: any;
    try {
      payload = jwt.verify(tokenStr, config.jwt.secret);
    } catch {
      throw new AppError('만료되었거나 유효하지 않은 다운로드 링크입니다.', 401);
    }
    if (payload?.type !== 'insurance_dl' || payload.requestId !== requestId) {
      throw new AppError('유효하지 않은 다운로드 토큰입니다.', 401);
    }

    const record = await prisma.insuranceDocRequest.findUnique({ where: { id: requestId } });
    if (!record || !record.documentUrl) {
      throw new AppError('서류를 찾을 수 없습니다.', 404);
    }

    // documentUrl 형식: /api/files/private/{filename} 또는 legacy /uploads/{filename}
    const filename = record.documentUrl.split('/').pop() || '';
    if (!filename || filename.includes('..')) {
      throw new AppError('잘못된 파일 경로입니다.', 400);
    }
    // 우선 private 디렉토리, 없으면 legacy uploads 평면 경로
    const privatePath = path.join(process.cwd(), 'uploads', 'private', filename);
    const legacyPath = path.join(process.cwd(), 'uploads', filename);
    const targetPath = fs.existsSync(privatePath) ? privatePath : (fs.existsSync(legacyPath) ? legacyPath : null);
    if (!targetPath) {
      throw new AppError('파일을 찾을 수 없습니다.', 404);
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.sendFile(targetPath);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// 2) 일반 비공개 파일 (신분증/범죄이력/자격증/보험서류) — 인증 + 소유권 검증
// ─────────────────────────────────────────────────────────────
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
