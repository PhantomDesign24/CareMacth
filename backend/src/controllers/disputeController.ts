import { Response, NextFunction } from 'express';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { sendFromTemplate } from '../services/notificationService';

const VALID_CATEGORIES = ['CARE_QUALITY', 'CANCELLATION', 'PAYMENT', 'ABUSE', 'NO_SHOW', 'OTHER'] as const;
const VALID_STATUSES = ['PENDING', 'PROCESSING', 'RESOLVED', 'ESCALATED', 'REJECTED'] as const;

// POST /disputes - 분쟁 접수 (보호자/간병인)
export const createDispute = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId, category, title, description, evidence } = req.body;
    if (!category || !VALID_CATEGORIES.includes(category)) {
      throw new AppError('유효한 분류를 선택해주세요.', 400);
    }
    if (!title || !description) {
      throw new AppError('제목과 내용은 필수입니다.', 400);
    }

    // 계약 ID가 있으면 상대방 userId 추출
    let targetId: string | null = null;
    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          guardian: { select: { userId: true } },
          caregiver: { select: { userId: true } },
        },
      });
      if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);

      // 신고자가 보호자면 target은 간병인, 반대도 동일
      if (contract.guardian.userId === req.user!.id) {
        targetId = contract.caregiver.userId;
      } else if (contract.caregiver.userId === req.user!.id) {
        targetId = contract.guardian.userId;
      } else {
        throw new AppError('해당 계약에 접근 권한이 없습니다.', 403);
      }
    }

    const dispute = await prisma.dispute.create({
      data: {
        contractId: contractId || null,
        reporterId: req.user!.id,
        targetId,
        category,
        title: String(title).slice(0, 200),
        description: String(description).slice(0, 2000),
        evidence: Array.isArray(evidence) ? evidence.slice(0, 10) : [],
      },
    });

    // 관리자 전원에게 알림
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    const reporter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    await Promise.all(admins.map((admin) =>
      sendFromTemplate({
        userId: admin.id,
        key: 'DISPUTE_CREATED_ADMIN',
        vars: { category, reporterName: reporter?.name || '신고자' },
        data: { disputeId: dispute.id, category },
      }).catch(() => {}),
    ));

    res.status(201).json({ success: true, data: dispute });
  } catch (error) {
    next(error);
  }
};

// GET /disputes - 내 분쟁 목록 (신고자/피신고자)
export const getMyDisputes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { reporterId: req.user!.id },
          { targetId: req.user!.id },
        ],
      },
      include: {
        contract: {
          include: {
            careRequest: { include: { patient: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: disputes });
  } catch (error) {
    next(error);
  }
};

// GET /admin/disputes - 관리자 전체 분쟁 목록
export const adminGetDisputes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, category } = req.query;
    const where: any = {};
    if (status && VALID_STATUSES.includes(status as any)) where.status = status;
    if (category && VALID_CATEGORIES.includes(category as any)) where.category = category;

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true, email: true, role: true } },
        target: { select: { id: true, name: true, email: true, role: true } },
        contract: {
          include: {
            careRequest: { include: { patient: { select: { name: true } } } },
            caregiver: { include: { user: { select: { name: true, phone: true } } } },
            guardian: { include: { user: { select: { name: true, phone: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 각 분쟁에 대해 현재 진행 중인 긴급재매칭(=새 활성 계약) 여부 확인
    const withRematchInfo = await Promise.all(disputes.map(async (d) => {
      if (!d.contract) return { ...d, rematchActiveContractId: null };
      // 동일 CareRequest의 현재 ACTIVE/EXTENDED 계약 (원 계약 제외)
      const rematch = await prisma.contract.findFirst({
        where: {
          careRequestId: d.contract.careRequestId,
          status: { in: ['ACTIVE', 'EXTENDED'] },
          id: { not: d.contractId || undefined },
        },
        select: { id: true, status: true, caregiver: { include: { user: { select: { name: true } } } } },
      });
      return { ...d, rematchActiveContractId: rematch?.id || null, rematchCaregiverName: rematch?.caregiver?.user?.name || null };
    }));

    res.json({ success: true, data: withRematchInfo });
  } catch (error) {
    next(error);
  }
};

// PATCH /admin/disputes/:id - 관리자 상태 변경
export const adminUpdateDispute = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      throw new AppError('유효한 상태가 아닙니다.', 400);
    }

    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new AppError('분쟁을 찾을 수 없습니다.', 404);

    const updated = await prisma.dispute.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(resolution !== undefined && { resolution }),
        ...((['RESOLVED', 'REJECTED', 'ESCALATED'] as const).includes(status) && {
          handledBy: req.user!.id,
          handledAt: new Date(),
        }),
      },
    });

    // 신고자에게 알림
    if (status && status !== dispute.status) {
      const msg =
        status === 'PROCESSING' ? '처리 중' :
        status === 'RESOLVED' ? '해결 완료' :
        status === 'REJECTED' ? '기각' :
        status === 'ESCALATED' ? '에스컬레이션' :
        '변경';
      await sendFromTemplate({
        userId: dispute.reporterId,
        key: 'DISPUTE_STATUS_UPDATED',
        vars: { statusLabel: msg, resolution: (updated as any).resolution || '' },
        data: { disputeId: id, status },
      }).catch(() => {});
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
