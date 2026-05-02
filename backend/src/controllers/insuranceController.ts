import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { sendFromTemplate } from '../services/notificationService';
import { config } from '../config';

// POST / - 간병보험 서류 신청
export const createInsuranceDocRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      patientName,
      birthDate,
      carePeriod,
      insuranceCompany,
      documentType,
    } = req.body;

    if (!patientName || !birthDate || !carePeriod || !insuranceCompany || !documentType) {
      throw new AppError(
        '모든 필수 항목을 입력해주세요. (환자명, 생년월일, 간병기간, 보험사, 서류종류)',
        400
      );
    }

    const validDocTypes = ['간병확인서', '영수증', '간병일지', '진단서'];
    if (!validDocTypes.includes(documentType)) {
      throw new AppError(
        `유효한 서류 종류를 선택해주세요. (${validDocTypes.join(', ')})`,
        400
      );
    }

    const docRequest = await prisma.insuranceDocRequest.create({
      data: {
        patientName,
        birthDate,
        carePeriod,
        insuranceCompany,
        documentType,
        requestedBy: req.user!.id,
      },
    });

    // 관리자에게 알림
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
    });

    if (admins.length > 0) {
      await Promise.all(admins.map((admin) =>
        sendFromTemplate({
          userId: admin.id,
          key: 'INSURANCE_REQUESTED_ADMIN',
          vars: { patientName, documentType, insuranceCompany },
          data: { insuranceDocRequestId: docRequest.id } as any,
        }).catch(() => {}),
      ));
    }

    res.status(201).json({
      success: true,
      data: docRequest,
    });
  } catch (error) {
    next(error);
  }
};

// GET /:id/status - 진행 상황 확인
export const getInsuranceDocStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const docRequest = await prisma.insuranceDocRequest.findUnique({
      where: { id },
    });

    if (!docRequest) {
      throw new AppError('서류 신청을 찾을 수 없습니다.', 404);
    }

    // 본인이 신청한 건만 조회 가능 (관리자 제외)
    if (req.user!.role !== 'ADMIN' && docRequest.requestedBy !== req.user!.id) {
      throw new AppError('접근 권한이 없습니다.', 403);
    }

    const statusLabels: Record<string, string> = {
      REQUESTED: '신청 접수',
      PROCESSING: '처리 중',
      COMPLETED: '발급 완료',
      REJECTED: '거절',
    };

    res.json({
      success: true,
      data: {
        ...docRequest,
        statusLabel: statusLabels[docRequest.status] || docRequest.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET / - 내 보험서류 신청 목록
export const getMyInsuranceRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requests = await prisma.insuranceDocRequest.findMany({
      where: { requestedBy: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    // 거절 사유는 최근 알림에서 추출해 합성
    const enriched = await Promise.all(requests.map(async (r) => {
      let rejectReason: string | null = null;
      if (r.status === 'REJECTED') {
        const notif = await prisma.notification.findFirst({
          where: {
            userId: r.requestedBy,
            type: 'SYSTEM',
            data: { path: ['insuranceId'], equals: r.id },
          } as any,
          orderBy: { createdAt: 'desc' },
        });
        const d = notif?.data as any;
        rejectReason = d?.rejectReason || null;
      }
      return { ...r, rejectReason };
    }));
    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// GET /admin - 관리자 전체 보험서류 신청 목록
export const adminListInsurance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status;
    const requests = await prisma.insuranceDocRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    // 신청자 정보 연결
    const enriched = await Promise.all(requests.map(async (r) => {
      const user = await prisma.user.findUnique({
        where: { id: r.requestedBy },
        select: { id: true, name: true, email: true, phone: true },
      }).catch(() => null);
      return { ...r, requester: user };
    }));
    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// PATCH /admin/:id - 관리자 상태 업데이트 (multipart 지원 — 파일 업로드 또는 JSON)
export const adminUpdateInsurance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let { status, documentUrl, adminNote, rejectReason } = req.body;

    // 프론트 레거시 호환: IN_PROGRESS → PROCESSING
    if (status === 'IN_PROGRESS') status = 'PROCESSING';

    const validStatuses = ['REQUESTED', 'PROCESSING', 'COMPLETED', 'REJECTED'];
    if (status && !validStatuses.includes(status)) {
      throw new AppError(`유효하지 않은 상태: ${status}`, 400);
    }

    const req_ = await prisma.insuranceDocRequest.findUnique({ where: { id } });
    if (!req_) throw new AppError('신청을 찾을 수 없습니다.', 404);

    // 보험서류 — 민감 파일이므로 비공개 저장(uploadPrivate) + 인증 라우트로만 접근
    if (req.file) {
      documentUrl = `/api/files/private/${req.file.filename}`;
    }

    if (status === 'REJECTED' && !(rejectReason || adminNote)) {
      throw new AppError('거절 사유를 입력해주세요.', 400);
    }

    const updated = await prisma.insuranceDocRequest.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(documentUrl !== undefined && { documentUrl: documentUrl || null }),
        processedBy: req.user!.id,
      },
    });

    // 상태 변경 시 신청자에게 알림 (템플릿 기반)
    const docLabel = `보험청구용 ${req_.documentType}`;
    const reasonText = rejectReason || adminNote || '';
    const keyMap: Record<string, string> = {
      PROCESSING: 'INSURANCE_PROCESSING',
      COMPLETED: 'INSURANCE_COMPLETED',
      REJECTED: 'INSURANCE_REJECTED',
      REQUESTED: 'INSURANCE_REREVIEW',
    };
    const templateKey = status ? keyMap[status] : null;
    if (templateKey && status !== req_.status) {
      // COMPLETED 인 경우, 카톡 알림톡에서 직접 다운로드 받을 수 있도록 1회용 단기 토큰 + 버튼 동봉
      let overrideAlimtalkButtons: any[] | undefined;
      let downloadUrl: string | undefined;
      if (status === 'COMPLETED' && updated.documentUrl) {
        const dlToken = jwt.sign(
          { type: 'insurance_dl', requestId: id },
          config.jwt.secret,
          { expiresIn: '7d' },
        );
        const base = process.env.WEB_BASE_URL || 'https://cm.phantomdesign.kr';
        downloadUrl = `${base}/api/files/insurance/${id}?t=${encodeURIComponent(dlToken)}`;
        overrideAlimtalkButtons = [
          { name: '서류 받기', linkType: 'WL', linkMo: downloadUrl, linkPc: downloadUrl },
        ];
      }

      await sendFromTemplate({
        userId: req_.requestedBy,
        key: templateKey,
        vars: {
          patientName: req_.patientName,
          docLabel,
          reasonText,
          downloadUrl: downloadUrl || '',
        },
        data: { insuranceId: id, documentUrl: updated.documentUrl, rejectReason: reasonText },
        overrideAlimtalkButtons,
      }).catch(() => {});
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
