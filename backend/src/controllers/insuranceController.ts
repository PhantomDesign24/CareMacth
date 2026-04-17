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
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};
