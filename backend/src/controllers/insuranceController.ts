import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

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
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'SYSTEM' as const,
          title: '간병보험 서류 신청',
          body: `${patientName} 환자의 ${documentType} 신청이 접수되었습니다. (보험사: ${insuranceCompany})`,
          data: { insuranceDocRequestId: docRequest.id } as any,
        })),
      });
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

    // 파일 업로드로 서류 등록된 경우 documentUrl 자동 세팅
    if (req.file) {
      documentUrl = `/uploads/${req.file.filename}`;
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

    // 상태 변경 시 신청자에게 알림 (REQUESTED 되돌리기는 알림 없음)
    const docLabel = `보험청구용 ${req_.documentType}`;
    const reasonText = rejectReason || adminNote || '';
    const notifMap: Record<string, { title: string; body: string } | null> = {
      PROCESSING: {
        title: '보험서류 처리 시작',
        body: `${req_.patientName} 환자분 ${docLabel} 신청이 접수되어 관리자가 처리 중입니다.`,
      },
      COMPLETED: {
        title: '보험서류 발급 완료',
        body: `${req_.patientName} 환자분 ${docLabel} 발급이 완료되었습니다. 마이페이지 → 보험서류 탭에서 다운로드하실 수 있습니다.`,
      },
      REJECTED: {
        title: '보험서류 신청 거절',
        body: `${req_.patientName} 환자분 ${docLabel} 신청이 거절되었습니다. 사유: ${reasonText}`,
      },
      REQUESTED: {
        title: '보험서류 재심사 접수',
        body: `${req_.patientName} 환자분 ${docLabel} 신청이 관리자에 의해 재심사 대기 상태로 전환되었습니다.`,
      },
    };
    const notif = status ? notifMap[status] : null;
    if (notif && status !== req_.status) {
      await prisma.notification.create({
        data: {
          userId: req_.requestedBy,
          type: 'SYSTEM',
          title: notif.title,
          body: notif.body,
          data: { insuranceId: id, documentUrl: updated.documentUrl, rejectReason: reasonText },
        },
      }).catch(() => {});
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
