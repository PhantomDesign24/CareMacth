import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { sendFromTemplate, renderTemplate } from '../services/notificationService';

// GET /dashboard - 대시보드 통계
export const getDashboard = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이번 달 1일
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayRequests,
      todayMatches,
      pendingCaregivers,
      activeCaregivers,
      totalGuardians,
      activeContracts,
      todayPayments,
      monthlyPayments,
    ] = await Promise.all([
      prisma.careRequest.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.contract.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.caregiver.count({ where: { status: 'PENDING' } }),
      prisma.caregiver.count({ where: { status: 'APPROVED' } }),
      prisma.guardian.count(),
      prisma.contract.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: today, lt: tomorrow }, status: { in: ['ESCROW', 'COMPLETED'] } },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: monthStart }, status: { in: ['ESCROW', 'COMPLETED'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    // 승인 대기 간병인 목록
    const pendingList = await prisma.caregiver.findMany({
      where: { status: 'PENDING' },
      include: { user: true, certificates: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // 최근 분쟁
    const recentDisputes = await prisma.dispute.findMany({
      include: {
        reporter: { select: { name: true, role: true } },
        target: { select: { name: true, role: true } },
        contract: {
          include: {
            careRequest: { include: { patient: { select: { name: true } } } },
            caregiver: { include: { user: { select: { name: true } } } },
            guardian: { include: { user: { select: { name: true } } } },
          },
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    const activeDisputesCount = await prisma.dispute.count({
      where: { status: { in: ['PENDING', 'PROCESSING', 'ESCALATED'] } },
    });

    res.json({
      success: true,
      data: {
        // 프론트엔드 호환 필드명
        newRequests: todayRequests,
        todayRequests,
        matchesCompleted: todayMatches,
        todayMatches,
        pendingApprovals: pendingCaregivers,
        pendingCaregivers,
        activeCaregivers,
        totalGuardians,
        activeContracts,
        activeDisputes: activeDisputesCount,
        revenue: todayPayments._sum.totalAmount || 0,
        todayRevenue: todayPayments._sum.totalAmount || 0,
        monthlyRevenue: monthlyPayments._sum.totalAmount || 0,
        pendingList: pendingList.map(cg => ({
          id: cg.id,
          name: cg.user.name,
          phone: cg.user.phone,
          appliedAt: cg.createdAt,
          certificates: cg.certificates.length,
          status: cg.status,
        })),
        recentDisputes: recentDisputes.map((d: any) => ({
          id: d.id,
          patientName: d.contract?.careRequest?.patient?.name || '-',
          caregiverName: d.contract?.caregiver?.user?.name || d.target?.name || '-',
          category: d.category,
          title: d.title,
          status: d.status,
          createdAt: d.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /caregivers - 간병인 목록
export const getCaregivers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const workStatus = req.query.workStatus as string | undefined;
    const region = req.query.region as string | undefined;
    const minExp = req.query.minExp as string | undefined;
    const maxExp = req.query.maxExp as string | undefined;

    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (workStatus) {
      whereClause.workStatus = workStatus;
    }

    if (region) {
      whereClause.preferredRegions = { has: region };
    }

    if (minExp !== undefined || maxExp !== undefined) {
      whereClause.experienceYears = {};
      if (minExp !== undefined) {
        whereClause.experienceYears.gte = parseInt(minExp);
      }
      if (maxExp !== undefined) {
        whereClause.experienceYears.lt = parseInt(maxExp);
      }
    }

    if (search) {
      whereClause.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // 이번 달 기준 협회비 납부 여부 판단 (AssociationFeePayment가 source of truth)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [caregivers, total, currentMonthPayments] = await Promise.all([
      prisma.caregiver.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              profileImage: true,
              createdAt: true,
            },
          },
          certificates: true,
          penalties: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          consultMemos: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
          _count: {
            select: {
              contracts: true,
              penalties: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.caregiver.count({ where: whereClause }),
      prisma.associationFeePayment.findMany({
        where: { year: currentYear, month: currentMonth },
        select: { caregiverId: true, paid: true, paidAt: true },
      }),
    ]);

    // caregiverId → 이번달 납부 레코드 맵
    const currentMonthPaidMap = new Map<string, { paid: boolean; paidAt: Date | null }>();
    currentMonthPayments.forEach((p) => {
      currentMonthPaidMap.set(p.caregiverId, { paid: p.paid, paidAt: p.paidAt });
    });

    // 간병인 목록에 추가 정보 포함
    const enrichedCaregivers = caregivers.map((cg) => ({
      id: cg.id,
      name: cg.user.name,
      status: cg.status,
      workStatus: cg.workStatus,
      phone: cg.user.phone,
      email: cg.user.email,
      profileImage: cg.user.profileImage,
      // 서류 인증 현황
      identityVerified: cg.identityVerified,
      hasIdCard: !!cg.idCardImage,
      criminalCheckDone: cg.criminalCheckDone,
      hasCriminalCheckDoc: !!cg.criminalCheckDoc,
      certificateCount: cg.certificates.length,
      verifiedCertificateCount: cg.certificates.filter((c: any) => c.verified).length,
      // 협회비 — 이번 달 AssociationFeePayment로 판정 (월별 납부가 source of truth)
      associationFee: cg.associationFee,
      associationPaidAt: currentMonthPaidMap.get(cg.id)?.paidAt || cg.associationPaidAt,
      associationFeePaid: currentMonthPaidMap.get(cg.id)?.paid === true,
      currentMonthPeriod: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
      // 기간(횟수)
      totalMatches: cg.totalMatches,
      totalMatchings: cg.totalMatches,
      experienceYears: cg.experienceYears,
      contractCount: cg._count.contracts,
      // 패널티(누계)
      penaltyCount: cg.penaltyCount,
      penaltyTotal: cg.penaltyCount,
      noShowCount: cg.noShowCount,
      recentPenalties: cg.penalties,
      // 뱃지
      hasBadge: cg.hasBadge,
      badgeGrantedAt: cg.badgeGrantedAt,
      // 평점
      avgRating: cg.avgRating,
      rehireRate: cg.rehireRate,
      cancellationRate: cg.cancellationRate,
      // 상담 메모
      recentMemos: cg.consultMemos,
      lastMemo: cg.consultMemos.length > 0 ? cg.consultMemos[0].content : null,
      // 자격증
      certificates: cg.certificates,
      // 가입일
      createdAt: cg.user.createdAt,
    }));

    res.json({
      success: true,
      data: {
        caregivers: enrichedCaregivers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /caregivers/:id - 간병인 상세
export const getCaregiverDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
            createdAt: true,
          },
        },
        certificates: {
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          include: {
            guardian: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        penalties: {
          orderBy: { createdAt: 'desc' },
        },
        consultMemos: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            contracts: true,
            penalties: true,
          },
        },
      },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    // 추가 데이터 — 계약, 수익, 분쟁, 추가비, 지원 이력
    const [contracts, earnings, disputes, additionalFees, applications] = await Promise.all([
      prisma.contract.findMany({
        where: { caregiverId: id },
        include: {
          careRequest: { include: { patient: { select: { name: true } } } },
          guardian: { include: { user: { select: { name: true } } } },
          payments: { select: { id: true, status: true, totalAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.earning.findMany({
        where: { caregiverId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.dispute.findMany({
        where: { targetId: caregiver.userId },
        include: {
          reporter: { select: { name: true } },
          contract: {
            include: {
              careRequest: { include: { patient: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.additionalFee.findMany({
        where: { requestedBy: id },
        include: {
          contract: {
            include: {
              guardian: { include: { user: { select: { name: true } } } },
              careRequest: { include: { patient: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.careApplication.count({
        where: { caregiverId: id },
      }),
    ]);

    // 수익 요약
    const earningsSummary = {
      total: earnings.reduce((s, e) => s + e.amount, 0),
      totalNet: earnings.reduce((s, e) => s + e.netAmount, 0),
      unpaidCount: earnings.filter((e) => !e.isPaid).length,
      unpaidAmount: earnings.filter((e) => !e.isPaid).reduce((s, e) => s + e.netAmount, 0),
    };

    res.json({
      success: true,
      data: {
        id: caregiver.id,
        status: caregiver.status,
        workStatus: caregiver.workStatus,
        gender: caregiver.gender,
        nationality: caregiver.nationality,
        birthDate: caregiver.birthDate,
        address: caregiver.address,
        specialties: caregiver.specialties,
        experienceYears: caregiver.experienceYears,
        avgRating: caregiver.avgRating,
        totalMatches: caregiver.totalMatches,
        rehireRate: caregiver.rehireRate,
        cancellationRate: caregiver.cancellationRate,
        penaltyCount: caregiver.penaltyCount,
        noShowCount: caregiver.noShowCount,
        hasBadge: caregiver.hasBadge,
        badgeGrantedAt: caregiver.badgeGrantedAt,
        associationFee: caregiver.associationFee,
        associationPaidAt: caregiver.associationPaidAt,
        criminalCheckDone: caregiver.criminalCheckDone,
        criminalCheckDate: caregiver.criminalCheckDate,
        criminalCheckDoc: caregiver.criminalCheckDoc,
        idCardImage: caregiver.idCardImage,
        identityVerified: caregiver.identityVerified,
        createdAt: caregiver.createdAt,
        user: caregiver.user,
        certificates: caregiver.certificates,
        reviews: caregiver.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          guardianName: r.guardian?.user?.name || '익명',
          createdAt: r.createdAt,
        })),
        penalties: caregiver.penalties,
        consultMemos: caregiver.consultMemos.map((m) => ({
          ...m,
          createdBy: m.adminId,
        })),
        // 신규 연동
        contracts: contracts.map((c: any) => ({
          id: c.id,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
          dailyRate: c.dailyRate,
          totalAmount: c.totalAmount,
          patientName: c.careRequest?.patient?.name || '-',
          guardianName: c.guardian?.user?.name || '-',
          paymentStatus: c.payments?.[0]?.status || null,
        })),
        earnings: earnings.map((e) => ({
          id: e.id,
          contractId: e.contractId,
          amount: e.amount,
          platformFee: e.platformFee,
          taxAmount: e.taxAmount,
          netAmount: e.netAmount,
          isPaid: e.isPaid,
          paidAt: e.paidAt,
          createdAt: e.createdAt,
        })),
        earningsSummary,
        disputes: disputes.map((d: any) => ({
          id: d.id,
          status: d.status,
          category: d.category,
          reason: d.reason,
          reporterName: d.reporter?.name || '-',
          patientName: d.contract?.careRequest?.patient?.name || '-',
          createdAt: d.createdAt,
        })),
        additionalFees: additionalFees.map((f: any) => ({
          id: f.id,
          amount: f.amount,
          reason: f.reason,
          approvedByGuardian: f.approvedByGuardian,
          paid: f.paid,
          patientName: f.contract?.careRequest?.patient?.name || '-',
          guardianName: f.contract?.guardian?.user?.name || '-',
          createdAt: f.createdAt,
        })),
        applicationCount: applications,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /caregivers/:id/approve - 간병인 승인
export const approveCaregiver = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    if (caregiver.status === 'APPROVED') {
      throw new AppError('이미 승인된 간병인입니다.', 400);
    }

    await prisma.caregiver.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    // 알림 발송
    await prisma.notification.create({
      data: {
        userId: caregiver.userId,
        type: 'SYSTEM',
        title: '간병인 승인 완료',
        body: '간병인 승인이 완료되었습니다. 이제 간병 매칭을 받을 수 있습니다.',
      },
    });

    res.json({
      success: true,
      message: `${caregiver.user.name} 간병인이 승인되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /caregivers/:id/reject - 간병인 거절
export const rejectCaregiver = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    await prisma.caregiver.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await prisma.notification.create({
      data: {
        userId: caregiver.userId,
        type: 'SYSTEM',
        title: '간병인 승인 거절',
        body: reason || '간병인 승인이 거절되었습니다. 자세한 사유는 고객센터에 문의해주세요.',
      },
    });

    res.json({
      success: true,
      message: `${caregiver.user.name} 간병인이 거절되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /caregivers/:id/blacklist - 블랙리스트 등록
export const blacklistCaregiver = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    // 관리자 계정은 블랙 처리 불가 (self-lockout 방지)
    if (caregiver.user.role === 'ADMIN') {
      throw new AppError('관리자 계정은 블랙리스트 처리할 수 없습니다.', 400);
    }

    const isBlacklisted = caregiver.status === 'BLACKLISTED';

    if (isBlacklisted) {
      // 블랙리스트 해제
      await prisma.$transaction([
        prisma.caregiver.update({
          where: { id },
          data: { status: 'APPROVED', workStatus: 'AVAILABLE' },
        }),
        prisma.user.update({
          where: { id: caregiver.userId },
          data: { isActive: true },
        }),
        prisma.notification.create({
          data: {
            userId: caregiver.userId,
            type: 'SYSTEM',
            title: '블랙리스트 해제 안내',
            body: '블랙리스트가 해제되었습니다. 다시 활동이 가능합니다.',
          },
        }),
        prisma.consultMemo.create({
          data: {
            caregiverId: id,
            adminId: req.user!.id,
            content: `[블랙리스트 해제] ${reason || '관리자 판단'}`,
          },
        }),
      ]);

      res.json({
        success: true,
        message: `${caregiver.user.name} 간병인의 블랙리스트가 해제되었습니다.`,
      });
    } else {
      // 블랙리스트 등록
      await prisma.$transaction([
        prisma.caregiver.update({
          where: { id },
          data: { status: 'BLACKLISTED', workStatus: 'AVAILABLE', hasBadge: false },
        }),
        prisma.user.update({
          where: { id: caregiver.userId },
          data: { isActive: false },
        }),
        prisma.notification.create({
          data: {
            userId: caregiver.userId,
            type: 'SYSTEM',
            title: '계정 정지 안내',
            body: reason || '서비스 이용 규정 위반으로 계정이 정지되었습니다.',
          },
        }),
        prisma.consultMemo.create({
          data: {
            caregiverId: id,
            adminId: req.user!.id,
            content: `[블랙리스트 등록] ${reason || '사유 미기재'}`,
          },
        }),
      ]);

      res.json({
        success: true,
        message: `${caregiver.user.name} 간병인이 블랙리스트에 등록되었습니다.`,
      });
    }
  } catch (error) {
    next(error);
  }
};

// PUT /caregivers/:id/badge - 우수 간병사 뱃지 부여
export const grantBadge = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    if (caregiver.status !== 'APPROVED') {
      throw new AppError('승인된 간병인에게만 뱃지를 부여/회수할 수 있습니다.', 400);
    }

    // 토글: 있으면 회수, 없으면 부여
    const newBadgeStatus = !caregiver.hasBadge;

    await prisma.caregiver.update({
      where: { id },
      data: {
        hasBadge: newBadgeStatus,
        badgeGrantedAt: newBadgeStatus ? new Date() : null,
      },
    });

    await prisma.notification.create({
      data: {
        userId: caregiver.userId,
        type: 'SYSTEM',
        title: newBadgeStatus ? '우수 간병사 뱃지 부여' : '우수 간병사 뱃지 회수',
        body: newBadgeStatus
          ? '축하합니다! 우수 간병사 뱃지가 부여되었습니다. 매칭 시 우선 순위를 받으실 수 있습니다.'
          : '우수 간병사 뱃지가 회수되었습니다.',
      },
    });

    res.json({
      success: true,
      message: newBadgeStatus
        ? `${caregiver.user.name} 간병인에게 우수 간병사 뱃지가 부여되었습니다.`
        : `${caregiver.user.name} 간병인의 우수 간병사 뱃지가 회수되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};

// POST /caregivers/:id/penalty - 패널티 부여
export const addPenalty = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { type, reason } = req.body;

    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    if (!type || !reason) {
      throw new AppError('패널티 유형과 사유를 입력해주세요.', 400);
    }

    const validTypes = ['NO_SHOW', 'CANCELLATION', 'COMPLAINT', 'MANUAL'];
    if (!validTypes.includes(type)) {
      throw new AppError(`유효한 패널티 유형을 선택해주세요. (${validTypes.join(', ')})`, 400);
    }

    // 플랫폼 설정 조회
    const platformConfig = await prisma.platformConfig.findUnique({
      where: { id: 'default' },
    });

    const noShowThreshold = platformConfig?.noShowPenaltyThreshold ?? 3;

    await prisma.$transaction(async (tx) => {
      // 패널티 생성
      await tx.penalty.create({
        data: {
          caregiverId: id,
          type,
          reason,
          isAutomatic: false,
          grantedBy: req.user!.id,
        },
      });

      // 간병인 패널티 카운트 증가
      const updateData: any = {
        penaltyCount: { increment: 1 },
      };

      if (type === 'NO_SHOW') {
        updateData.noShowCount = { increment: 1 };
      }

      await tx.caregiver.update({
        where: { id },
        data: updateData,
      });

      // 노쇼 임계값 초과 시 자동 정지
      const updatedCaregiver = await tx.caregiver.findUnique({
        where: { id },
      });

      if (updatedCaregiver && updatedCaregiver.noShowCount >= noShowThreshold) {
        await tx.caregiver.update({
          where: { id },
          data: { status: 'SUSPENDED' },
        });

        await tx.notification.create({
          data: {
            userId: caregiver.userId,
            type: 'PENALTY',
            title: '활동 정지 안내',
            body: `노쇼 ${noShowThreshold}회 이상으로 활동이 정지되었습니다.`,
          },
        });
      }

      // 알림
      await tx.notification.create({
        data: {
          userId: caregiver.userId,
          type: 'PENALTY',
          title: '패널티 부여 안내',
          body: `패널티가 부여되었습니다. 유형: ${type}, 사유: ${reason}`,
          data: { penaltyType: type },
        },
      });
    });

    res.json({
      success: true,
      message: `${caregiver.user.name} 간병인에게 패널티가 부여되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};

// POST /caregivers/:id/memo - 상담 메모 작성
export const addConsultMemo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      throw new AppError('메모 내용을 입력해주세요.', 400);
    }

    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
    });

    if (!caregiver) {
      throw new AppError('간병인을 찾을 수 없습니다.', 404);
    }

    const memo = await prisma.consultMemo.create({
      data: {
        caregiverId: id,
        adminId: req.user!.id,
        content,
      },
    });

    res.status(201).json({
      success: true,
      data: memo,
    });
  } catch (error) {
    next(error);
  }
};

// GET /patients - 환자 등록 이력
export const getPatients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const gender = req.query.gender as string | undefined;
    const mobilityStatus = req.query.mobilityStatus as string | undefined;

    const whereClause: any = {};

    if (gender) {
      whereClause.gender = gender;
    }

    if (mobilityStatus) {
      whereClause.mobilityStatus = mobilityStatus;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { diagnosis: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where: whereClause,
        include: {
          guardian: {
            include: {
              user: {
                select: { name: true, phone: true, email: true },
              },
            },
          },
          careRequests: {
            select: {
              id: true,
              status: true,
              careType: true,
              startDate: true,
              endDate: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.patient.count({ where: whereClause }),
    ]);

    // Aggregate payment data for each patient via their care requests -> contracts -> payments
    const patientIds = patients.map((p) => p.id);
    const paymentAggregates = patientIds.length > 0
      ? await prisma.payment.groupBy({
          by: ['guardianId'],
          where: {
            status: { in: ['ESCROW', 'COMPLETED'] },
            contract: {
              careRequest: {
                patientId: { in: patientIds },
              },
            },
          },
          _sum: {
            totalAmount: true,
          },
        })
      : [];

    // Build a map: patientId -> { totalSpent, totalFees }
    // We need to go through contracts to link payments to patients
    const patientPaymentData: Record<string, { totalSpent: number; totalFees: number }> = {};
    if (patientIds.length > 0) {
      const contractsWithPayments = await prisma.contract.findMany({
        where: {
          careRequest: {
            patientId: { in: patientIds },
          },
        },
        select: {
          careRequest: { select: { patientId: true } },
          platformFee: true,
          totalAmount: true,
          payments: {
            where: { status: { in: ['ESCROW', 'COMPLETED'] } },
            select: { totalAmount: true },
          },
        },
      });

      for (const contract of contractsWithPayments) {
        const pid = contract.careRequest.patientId;
        if (!patientPaymentData[pid]) {
          patientPaymentData[pid] = { totalSpent: 0, totalFees: 0 };
        }
        const paymentSum = contract.payments.reduce((s, p) => s + p.totalAmount, 0);
        patientPaymentData[pid].totalSpent += paymentSum;
        // platformFee is a percentage, calculate fee from payment amounts
        patientPaymentData[pid].totalFees += Math.round(paymentSum * (contract.platformFee / 100));
      }
    }

    // Compute age from birthDate
    const now = new Date();
    const careTypeMap: Record<string, string> = {
      INDIVIDUAL: '1:1 간병',
      FAMILY: '가족 간병',
    };

    const enrichedPatients = patients.map((p) => {
      const latestRequest = p.careRequests[0] || null;
      const age = p.birthDate
        ? Math.floor((now.getTime() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null;
      const payData = patientPaymentData[p.id] || { totalSpent: 0, totalFees: 0 };

      return {
        id: p.id,
        name: p.name,
        age,
        gender: p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : p.gender,
        condition: p.diagnosis || p.medicalNotes || null,
        careType: latestRequest ? (careTypeMap[latestRequest.careType] || latestRequest.careType) : null,
        totalMatchings: p.careRequests.length,
        totalSpent: payData.totalSpent,
        totalFees: payData.totalFees,
        registeredAt: p.createdAt,
        status: latestRequest
          ? (latestRequest.status === 'IN_PROGRESS' || latestRequest.status === 'MATCHED'
            ? '활성'
            : latestRequest.status === 'COMPLETED'
            ? '완료'
            : latestRequest.status === 'CANCELLED'
            ? '취소'
            : '대기중')
          : '대기중',
        guardianName: p.guardian?.user?.name || null,
        guardianPhone: p.guardian?.user?.phone || null,
      };
    });

    res.json({
      success: true,
      data: {
        patients: enrichedPatients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /stats - 월별 통계
export const getStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;

    // 월별 통계를 실시간 집계 (MonthlyStats 테이블 대신 실 DB 기반)
    const stats: any[] = [];
    const now = new Date();
    const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const months = month ? [month] : Array.from({ length: lastMonth }, (_, i) => i + 1);

    for (const m of months) {
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59, 999);
      const [
        totalRequests,
        totalMatches,
        revenueAgg,
        feeAgg,
        activeCaregiversCount,
        activeGuardiansCount,
        ratingAgg,
      ] = await Promise.all([
        prisma.careRequest.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.contract.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.payment.aggregate({
          where: {
            status: { in: ['COMPLETED', 'ESCROW'] },
            paidAt: { gte: start, lte: end },
          },
          _sum: { totalAmount: true },
        }),
        prisma.earning.aggregate({
          where: { createdAt: { gte: start, lte: end } },
          _sum: { platformFee: true },
        }),
        prisma.caregiver.count({
          where: { status: 'APPROVED', createdAt: { lte: end } },
        }),
        prisma.guardian.count({ where: { createdAt: { lte: end } } }),
        prisma.review.aggregate({
          where: { createdAt: { gte: start, lte: end } },
          _avg: { rating: true },
        }),
      ]);

      stats.push({
        year,
        month: m,
        totalRequests,
        totalMatches,
        totalRevenue: revenueAgg._sum.totalAmount || 0,
        totalPlatformFee: feeAgg._sum.platformFee || 0,
        activeCaregivers: activeCaregiversCount,
        activeGuardians: activeGuardiansCount,
        avgRating: ratingAgg._avg.rating || 0,
      });
    }

    // 실시간 통계도 함께 제공
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      currentMonthRequests,
      currentMonthMatches,
      currentMonthRevenue,
      activeCaregivers,
      activeGuardians,
      pendingCaregivers,
    ] = await Promise.all([
      prisma.careRequest.count({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.contract.count({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: { in: ['COMPLETED', 'ESCROW'] },
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.caregiver.count({
        where: { status: 'APPROVED' },
      }),
      prisma.guardian.count(),
      prisma.caregiver.count({
        where: { status: 'PENDING' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        historicalStats: stats,
        currentMonth: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          totalRequests: currentMonthRequests,
          totalMatches: currentMonthMatches,
          totalRevenue: currentMonthRevenue._sum.totalAmount || 0,
          activeCaregivers,
          activeGuardians,
          pendingCaregivers,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /stats/export - 엑셀 다운로드
export const exportStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const now = new Date();
    const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const rows: (string | number)[][] = [];

    for (let m = 1; m <= lastMonth; m++) {
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59, 999);
      const [totalRequests, totalMatches, revAgg, feeAgg, acgs, ags, ratingAgg] = await Promise.all([
        prisma.careRequest.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.contract.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.payment.aggregate({
          where: { status: { in: ['COMPLETED', 'ESCROW'] }, paidAt: { gte: start, lte: end } },
          _sum: { totalAmount: true },
        }),
        prisma.earning.aggregate({
          where: { createdAt: { gte: start, lte: end } },
          _sum: { platformFee: true },
        }),
        prisma.caregiver.count({ where: { status: 'APPROVED', createdAt: { lte: end } } }),
        prisma.guardian.count({ where: { createdAt: { lte: end } } }),
        prisma.review.aggregate({
          where: { createdAt: { gte: start, lte: end } },
          _avg: { rating: true },
        }),
      ]);
      rows.push([
        year,
        m,
        totalRequests,
        totalMatches,
        revAgg._sum.totalAmount || 0,
        feeAgg._sum.platformFee || 0,
        acgs,
        ags,
        (ratingAgg._avg.rating || 0).toFixed(1),
      ]);
    }

    const headers = [
      '연도', '월', '총 요청', '총 매칭', '총 매출(원)',
      '플랫폼 수수료(원)', '활성 간병인', '활성 보호자', '평균 평점',
    ];

    // BOM for Korean Excel compatibility
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="carematch-stats-${year}.csv"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};

// GET /disputes - 분쟁 목록
export const getDisputes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // 분쟁 = 취소된 계약 중 환불 관련 이슈가 있는 건
    const [disputes, total] = await Promise.all([
      prisma.contract.findMany({
        where: {
          status: 'CANCELLED',
        },
        include: {
          careRequest: {
            include: {
              patient: {
                select: { name: true },
              },
            },
          },
          guardian: {
            include: {
              user: {
                select: { name: true, phone: true },
              },
            },
          },
          caregiver: {
            include: {
              user: {
                select: { name: true, phone: true },
              },
            },
          },
          payments: {
            where: { status: { in: ['PARTIAL_REFUND', 'REFUNDED'] } },
          },
        },
        orderBy: { cancelledAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contract.count({
        where: { status: 'CANCELLED' },
      }),
    ]);

    // Add priority field based on cancellation details
    const enrichedDisputes = disputes.map((d) => {
      let priority = '일반';
      if (d.cancellationReason && d.cancellationReason.includes('긴급')) {
        priority = '긴급';
      } else if (d.cancelledAt && d.careRequest?.startDate) {
        const cancelTime = new Date(d.cancelledAt).getTime();
        const startTime = new Date(d.careRequest.startDate).getTime();
        const hoursDiff = (startTime - cancelTime) / (1000 * 60 * 60);
        if (hoursDiff >= 0 && hoursDiff <= 24) {
          priority = '높음';
        }
      }
      return {
        ...d,
        priority,
      };
    });

    res.json({
      success: true,
      data: {
        disputes: enrichedDisputes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /emergency-rematch/:contractId - 긴급 재매칭
export const emergencyRematch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { contractId } = req.params;
    const { reason } = req.body;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        careRequest: {
          include: { patient: true },
        },
        caregiver: {
          include: { user: true },
        },
        guardian: {
          include: { user: true },
        },
      },
    });

    if (!contract) {
      throw new AppError('계약을 찾을 수 없습니다.', 404);
    }

    if (!['ACTIVE', 'EXTENDED'].includes(contract.status)) {
      throw new AppError('활성 상태의 계약만 긴급 재매칭이 가능합니다.', 400);
    }

    await prisma.$transaction(async (tx) => {
      // 기존 계약 취소
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: req.user!.id,
          cancellationReason: `긴급 재매칭: ${reason || '관리자 요청'}`,
        },
      });

      // 기존 간병인에게 노쇼/취소 패널티 부여 (사유에 따라)
      if (reason?.includes('노쇼') || reason?.includes('무단')) {
        await tx.penalty.create({
          data: {
            caregiverId: contract.caregiverId,
            type: 'NO_SHOW',
            reason: `긴급 재매칭 사유: ${reason}`,
            isAutomatic: false,
            grantedBy: req.user!.id,
          },
        });

        await tx.caregiver.update({
          where: { id: contract.caregiverId },
          data: {
            penaltyCount: { increment: 1 },
            noShowCount: { increment: 1 },
          },
        });
      }

      // 간병인 상태 변경
      await tx.caregiver.update({
        where: { id: contract.caregiverId },
        data: { workStatus: 'AVAILABLE' },
      });

      // 간병 요청 상태를 다시 OPEN으로
      await tx.careRequest.update({
        where: { id: contract.careRequestId },
        data: { status: 'OPEN' },
      });

      // 기존 간병인의 지원 취소 + 다른 지원자들은 PENDING으로 리셋
      // (긴급 재매칭은 새 간병인이 필요한 상황이므로 모든 기존 지원 초기화)
      await tx.careApplication.updateMany({
        where: { careRequestId: contract.careRequestId, caregiverId: contract.caregiverId },
        data: { status: 'CANCELLED' },
      });
      // 다른 간병인들 중 ACCEPTED였던 건은 아직 대기(PENDING)로 되돌림
      await tx.careApplication.updateMany({
        where: {
          careRequestId: contract.careRequestId,
          caregiverId: { not: contract.caregiverId },
          status: 'ACCEPTED',
        },
        data: { status: 'PENDING' },
      });

      // 해당 계약 관련 분쟁 자동 해결 처리
      await tx.dispute.updateMany({
        where: { contractId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'RESOLVED', resolution: `긴급 재매칭으로 처리됨: ${reason || '관리자 요청'}`, handledBy: req.user!.id, handledAt: new Date() },
      });

      // 기존 간병인에게 알림
      await tx.notification.create({
        data: {
          userId: contract.caregiver.userId,
          type: 'CONTRACT',
          title: '계약 해제 안내',
          body: `긴급 재매칭으로 인해 계약이 해제되었습니다. 사유: ${reason || '관리자 요청'}`,
          data: { contractId },
        },
      });

      // 보호자에게 알림
      await tx.notification.create({
        data: {
          userId: contract.guardian.userId,
          type: 'CONTRACT',
          title: '긴급 재매칭 진행 중',
          body: '긴급 재매칭이 진행됩니다. 새로운 간병인이 배정될 예정입니다.',
          data: { careRequestId: contract.careRequestId },
        },
      });
    });

    res.json({
      success: true,
      message: '긴급 재매칭이 진행됩니다. 간병 요청이 다시 OPEN 상태로 변경되었습니다.',
      data: {
        careRequestId: contract.careRequestId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /platform-config - 수수료 설정 변경
export const updatePlatformConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      individualFeePercent,
      individualFeeFixed,
      familyFeePercent,
      familyFeeFixed,
      taxRate,
      referralPoints,
      noShowPenaltyThreshold,
      badgeThreshold,
      associationFeeDefault,
      cancellationFee,
      companyPhone,
    } = req.body;

    // 수수료 범위 검증 (0~100%)
    if (individualFeePercent !== undefined) {
      const val = parseFloat(individualFeePercent);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new AppError('개인 수수료는 0~100% 사이여야 합니다.', 400);
      }
    }
    if (familyFeePercent !== undefined) {
      const val = parseFloat(familyFeePercent);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new AppError('가족 수수료는 0~100% 사이여야 합니다.', 400);
      }
    }
    if (taxRate !== undefined) {
      const val = parseFloat(taxRate);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new AppError('세율은 0~100% 사이여야 합니다.', 400);
      }
    }
    // 금액 >= 0 검증
    if (individualFeeFixed !== undefined && parseInt(individualFeeFixed) < 0) {
      throw new AppError('개인 고정 수수료는 0 이상이어야 합니다.', 400);
    }
    if (familyFeeFixed !== undefined && parseInt(familyFeeFixed) < 0) {
      throw new AppError('가족 고정 수수료는 0 이상이어야 합니다.', 400);
    }
    if (referralPoints !== undefined && parseInt(referralPoints) < 0) {
      throw new AppError('추천 포인트는 0 이상이어야 합니다.', 400);
    }

    const config = await prisma.platformConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(individualFeePercent !== undefined && { individualFeePercent: parseFloat(individualFeePercent) }),
        ...(individualFeeFixed !== undefined && { individualFeeFixed: parseInt(individualFeeFixed) }),
        ...(familyFeePercent !== undefined && { familyFeePercent: parseFloat(familyFeePercent) }),
        ...(familyFeeFixed !== undefined && { familyFeeFixed: parseInt(familyFeeFixed) }),
        ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
        ...(referralPoints !== undefined && { referralPoints: parseInt(referralPoints) }),
        ...(noShowPenaltyThreshold !== undefined && { noShowPenaltyThreshold: parseInt(noShowPenaltyThreshold) }),
        ...(badgeThreshold !== undefined && { badgeThreshold: parseInt(badgeThreshold) }),
        ...(associationFeeDefault !== undefined && { associationFeeDefault: parseInt(associationFeeDefault) }),
        ...(cancellationFee !== undefined && { cancellationFee: parseInt(cancellationFee) }),
        ...(companyPhone !== undefined && { companyPhone: companyPhone === '' ? null : String(companyPhone) }),
      },
      create: {
        id: 'default',
        individualFeePercent: individualFeePercent ?? 10,
        individualFeeFixed: individualFeeFixed ?? 0,
        familyFeePercent: familyFeePercent ?? 15,
        familyFeeFixed: familyFeeFixed ?? 0,
        taxRate: taxRate ?? 3.3,
        referralPoints: referralPoints ?? 10000,
        noShowPenaltyThreshold: noShowPenaltyThreshold ?? 3,
        badgeThreshold: badgeThreshold ?? 10,
        associationFeeDefault: associationFeeDefault ?? 120000,
        cancellationFee: cancellationFee ?? 0,
        companyPhone: companyPhone || null,
      },
    });

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

// GET /payments - 결제 목록 (관리자용)
export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = req.query.search as string | undefined;

    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    if (search) {
      whereClause.OR = [
        { contract: { caregiver: { user: { name: { contains: search, mode: 'insensitive' } } } } },
        { contract: { careRequest: { patient: { name: { contains: search, mode: 'insensitive' } } } } },
        { guardian: { user: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        include: {
          contract: {
            select: {
              id: true,
              platformFee: true,
              status: true,
              cancelledAt: true,
              careRequest: {
                select: {
                  patient: {
                    select: { name: true },
                  },
                },
              },
              caregiver: {
                include: {
                  user: {
                    select: { name: true },
                  },
                },
              },
              _count: {
                select: {
                  additionalFees: true,
                  disputes: true,
                },
              },
              additionalFees: {
                select: {
                  id: true,
                  amount: true,
                  approvedByGuardian: true,
                  paid: true,
                },
              },
            },
          },
          guardian: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: whereClause }),
    ]);

    // Summary stats for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [monthlyTotal, monthlyRefunds, pendingCount] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          status: { in: ['COMPLETED', 'ESCROW'] },
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: { in: ['REFUNDED', 'PARTIAL_REFUND'] },
          refundedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _count: true,
      }),
      prisma.earning.count({
        where: { isPaid: false },
      }),
    ]);

    // Calculate monthly fees
    const monthlyFees = await prisma.earning.aggregate({
      where: {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { platformFee: true },
    });

    // 추가 간병비 월별 집계 (옵션 B: 별도 트랙)
    const approvedMonthlyFees = await prisma.additionalFee.findMany({
      where: {
        approvedByGuardian: true,
        rejected: false,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { contract: { select: { platformFee: true, taxRate: true } } },
    });
    const additionalFeesSummary = approvedMonthlyFees.reduce(
      (acc, f) => {
        const feePercent = f.contract?.platformFee ?? 10;
        const tax = f.contract?.taxRate ?? 3.3;
        const platformFeeAmount = Math.round(f.amount * (feePercent / 100));
        const taxAmount = Math.round((f.amount - platformFeeAmount) * (tax / 100));
        acc.totalAmount += f.amount;
        acc.totalPlatformFee += platformFeeAmount;
        acc.totalTax += taxAmount;
        acc.totalNet += f.amount - platformFeeAmount - taxAmount;
        acc.count += 1;
        if (!f.paid) acc.unpaidCount += 1;
        return acc;
      },
      { totalAmount: 0, totalPlatformFee: 0, totalTax: 0, totalNet: 0, count: 0, unpaidCount: 0 },
    );
    const pendingAdditionalFeesCount = await prisma.additionalFee.count({
      where: { approvedByGuardian: false, rejected: false },
    });

    const enrichedPayments = payments.map((p: any) => {
      const additionalFeesCount = p.contract?._count?.additionalFees || 0;
      const disputesCount = p.contract?._count?.disputes || 0;
      const additionalFeesPending = (p.contract?.additionalFees || []).filter((f: any) => !f.approvedByGuardian && !f.rejected).length;
      const additionalFeesTotal = (p.contract?.additionalFees || [])
        .filter((f: any) => !f.rejected)
        .reduce((s: number, f: any) => s + (f.approvedByGuardian ? f.amount : 0), 0);
      // 간병인 실수령 계산 (Payment 결제 금액 기준, 계약 수수료·세율 반영)
      const platformFeePercent = p.contract?.platformFee ?? 10;
      const taxRate = p.contract?.taxRate ?? 3.3;
      const platformFeeAmt = p.contract ? Math.round(p.totalAmount * (platformFeePercent / 100)) : 0;
      const taxAmt = p.contract ? Math.round((p.totalAmount - platformFeeAmt) * (taxRate / 100)) : 0;
      return {
        id: p.id,
        contractId: p.contractId,
        patientName: p.contract?.careRequest?.patient?.name || '-',
        caregiverName: p.contract?.caregiver?.user?.name || '-',
        guardianName: p.guardian?.user?.name || '-',
        amount: p.totalAmount,
        fee: platformFeeAmt,
        taxAmount: taxAmt,
        netAmount: p.totalAmount - platformFeeAmt - taxAmt, // 간병인 실수령 (수수료+세금 차감)
        status: p.status,
        contractStatus: p.contract?.status || null,
        contractCancelledAt: p.contract?.cancelledAt ? p.contract.cancelledAt.toISOString() : null,
        method: p.method,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        refundAmount: p.refundAmount,
        refundedAt: p.refundedAt ? p.refundedAt.toISOString() : null,
        additionalFeesCount,
        additionalFeesPending,
        additionalFeesTotal,
        disputesCount,
      };
    });

    res.json({
      success: true,
      data: {
        payments: enrichedPayments,
        summary: {
          monthlyTotal: monthlyTotal._sum.totalAmount || 0,
          monthlyFees: monthlyFees._sum.platformFee || 0,
          pendingSettlements: pendingCount,
          monthlyRefunds: monthlyRefunds._count,
          // 추가 간병비 별도 집계 (옵션 B)
          additionalFeesMonthly: additionalFeesSummary,
          additionalFeesPending: pendingAdditionalFeesCount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /settlements - 정산 목록 (관리자용)
export const getSettlements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const period = req.query.period as string | undefined;

    const whereClause: any = {};

    if (status === 'completed') {
      whereClause.isPaid = true;
    } else if (status === 'pending') {
      whereClause.isPaid = false;
    }

    if (period) {
      // period format: "2026-03"
      const [yearStr, monthStr] = period.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      if (!isNaN(year) && !isNaN(month)) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        whereClause.createdAt = { gte: start, lte: end };
      }
    }

    const [settlements, total] = await Promise.all([
      prisma.earning.findMany({
        where: whereClause,
        include: {
          caregiver: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.earning.count({ where: whereClause }),
    ]);

    const enrichedSettlements = settlements.map((s) => ({
      id: s.id,
      caregiverName: s.caregiver?.user?.name || '-',
      caregiverId: s.caregiverId,
      contractId: s.contractId,
      amount: s.amount,
      platformFee: s.platformFee,
      taxAmount: s.taxAmount,
      netAmount: s.netAmount,
      isPaid: s.isPaid,
      paidAt: s.paidAt ? s.paidAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
    }));

    res.json({
      success: true,
      data: {
        settlements: enrichedSettlements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /contracts/:contractId/mid-settlement - 관리자 수동 중간정산 (시작일~오늘 경과분)
// body: { days?: number } - 정산할 일수를 명시 (없으면 전체 미정산 경과분)
export const createMidSettlement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.params;
    const { days } = req.body as { days?: number };

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        earnings: true,
        caregiver: { select: { userId: true } },
      },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);
    if (contract.status === 'CANCELLED') throw new AppError('취소된 계약은 중간정산 불가', 400);

    const now = new Date();
    const startMs = new Date(contract.startDate).getTime();
    const endMs = new Date(contract.endDate).getTime();
    const totalDays = Math.max(1, Math.ceil((endMs - startMs) / 86400000));
    const elapsed = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - startMs) / 86400000)));

    // 이미 정산된 일수 = 기존 Earning.amount 합 / dailyRate
    const settledAmount = contract.earnings.reduce((s, e) => s + e.amount, 0);
    const settledDays = Math.floor(settledAmount / contract.dailyRate);

    const availableDays = Math.max(0, elapsed - settledDays);
    if (availableDays <= 0) {
      throw new AppError('정산 가능한 경과 일수가 없습니다.', 400);
    }
    const billDays = days && days > 0 ? Math.min(days, availableDays) : availableDays;

    const amount = contract.dailyRate * billDays;
    const platformFee = Math.round(amount * (contract.platformFee / 100));
    const taxAmount = Math.round(amount * (contract.taxRate / 100));
    const netAmount = amount - platformFee - taxAmount;

    const earning = await prisma.earning.create({
      data: {
        caregiverId: contract.caregiverId,
        contractId: contract.id,
        amount,
        platformFee,
        taxAmount,
        netAmount,
      },
    });

    // 간병인에게 알림
    if (contract.caregiver?.userId) {
      await prisma.notification.create({
        data: {
          userId: contract.caregiver.userId,
          type: 'PAYMENT',
          title: '중간정산 생성',
          body: `${billDays}일분 중간정산이 생성되었습니다. 실지급: ${netAmount.toLocaleString()}원`,
          data: { contractId, earningId: earning.id } as any,
        },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: {
        earning,
        billDays,
        elapsed,
        totalDays,
        settledDays,
        remainingDays: totalDays - settledDays - billDays,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /contracts/:contractId/detail - 계약 통합 상세 (매칭 관리용)
export const getAdminContractDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.params;
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        careRequest: {
          include: {
            patient: true,
            applications: {
              include: { caregiver: { include: { user: { select: { name: true, phone: true } } } } },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        caregiver: { include: { user: { select: { id: true, name: true, phone: true, email: true } } } },
        guardian: { include: { user: { select: { id: true, name: true, phone: true, email: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
        earnings: { orderBy: { createdAt: 'desc' } },
        extensions: { orderBy: { createdAt: 'desc' } },
        additionalFees: { orderBy: { createdAt: 'desc' } },
        disputes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);

    const [careRecordCount, latestCareRecord, review] = await Promise.all([
      prisma.careRecord.count({ where: { contractId } }),
      prisma.careRecord.findFirst({
        where: { contractId },
        orderBy: { date: 'desc' },
        select: { date: true, checkInTime: true, checkOutTime: true },
      }),
      prisma.review.findFirst({ where: { contractId } }),
    ]);

    // 경과/정산 집계
    const now = new Date();
    const totalDays = Math.max(1, Math.ceil((contract.endDate.getTime() - contract.startDate.getTime()) / 86400000));
    const elapsed = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - contract.startDate.getTime()) / 86400000)));
    const settledAmount = contract.earnings.reduce((s, e) => s + e.amount, 0);
    const settledDays = Math.floor(settledAmount / contract.dailyRate);

    res.json({
      success: true,
      data: {
        ...contract,
        patient: contract.careRequest?.patient,
        careRecordCount,
        latestCareRecord,
        review,
        stats: {
          totalDays,
          elapsed,
          settledDays,
          availableDays: Math.max(0, elapsed - settledDays),
          pendingAmount: Math.max(0, elapsed - settledDays) * contract.dailyRate,
          totalPaid: contract.payments
            .filter((p) => ['COMPLETED', 'ESCROW', 'PARTIAL_REFUND'].includes(p.status))
            .reduce((s, p) => s + (p.totalAmount - (p.refundAmount || 0)), 0),
          totalRefunded: contract.payments.reduce((s, p) => s + (p.refundAmount || 0), 0),
          totalEarnings: settledAmount,
          earningsNetTotal: contract.earnings.reduce((s, e) => s + e.netAmount, 0),
          unpaidEarnings: contract.earnings.filter((e) => !e.isPaid).length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /contracts/:contractId/force-cancel - 관리자 강제 취소
export const forceCancelContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.params;
    const { reason } = req.body;
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        caregiver: { select: { userId: true } },
        guardian: { select: { userId: true } },
      },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);
    if (contract.status === 'CANCELLED') throw new AppError('이미 취소된 계약입니다.', 400);

    await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: req.user!.id,
          cancellationReason: reason || '관리자 강제 취소',
        },
      });
      await tx.careApplication.updateMany({
        where: { careRequestId: contract.careRequestId, status: { in: ['PENDING', 'ACCEPTED'] } },
        data: { status: 'CANCELLED' },
      });
      await tx.caregiver.update({
        where: { id: contract.caregiverId },
        data: { workStatus: 'AVAILABLE' },
      });
      // 양쪽 알림 (템플릿)
      const tpl = await renderTemplate('CONTRACT_FORCE_CANCELLED', {
        reasonText: reason ? '사유: ' + reason : '',
      });
      if (tpl && tpl.enabled) {
        await tx.notification.createMany({
          data: [
            { userId: contract.guardian.userId, type: tpl.type, title: tpl.title, body: tpl.body, data: { contractId } as any },
            { userId: contract.caregiver.userId, type: tpl.type, title: tpl.title, body: tpl.body, data: { contractId } as any },
          ],
        });
      }
    });

    res.json({ success: true, message: '계약이 강제 취소되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// POST /contracts/:contractId/force-complete - 관리자 강제 완료 처리
export const forceCompleteContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.params;
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);
    if (contract.status === 'CANCELLED' || contract.status === 'COMPLETED') {
      throw new AppError(`이미 ${contract.status === 'CANCELLED' ? '취소' : '완료'}된 계약입니다.`, 400);
    }
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'COMPLETED' },
    });
    await prisma.caregiver.update({
      where: { id: contract.caregiverId },
      data: { workStatus: 'AVAILABLE' },
    });
    res.json({ success: true, message: '계약이 완료 처리되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// GET /contracts/active - 활성/연장 계약 목록 (중간정산 후보)
export const getActiveContractsForSettlement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contracts = await prisma.contract.findMany({
      where: { status: { in: ['ACTIVE', 'EXTENDED'] } },
      include: {
        caregiver: { include: { user: { select: { name: true } } } },
        careRequest: { include: { patient: { select: { name: true } } } },
        earnings: { select: { amount: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    const now = new Date();
    const enriched = contracts.map((c) => {
      const totalDays = Math.max(1, Math.ceil((new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86400000));
      const elapsed = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - new Date(c.startDate).getTime()) / 86400000)));
      const settledAmount = c.earnings.reduce((s, e) => s + e.amount, 0);
      const settledDays = Math.floor(settledAmount / c.dailyRate);
      return {
        id: c.id,
        patientName: c.careRequest?.patient?.name || '-',
        caregiverName: c.caregiver?.user?.name || '-',
        startDate: c.startDate.toISOString(),
        endDate: c.endDate.toISOString(),
        dailyRate: c.dailyRate,
        status: c.status,
        totalDays,
        elapsed,
        settledDays,
        availableDays: Math.max(0, elapsed - settledDays),
        pendingAmount: Math.max(0, (elapsed - settledDays)) * c.dailyRate,
      };
    });
    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

// GET /additional-fees - 관리자: 전체 추가 간병비 요청 조회
export const adminListAdditionalFees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = (req.query.status as string) || 'all';
    const where: any = {};
    if (status === 'pending') { where.approvedByGuardian = false; where.rejected = false; }
    else if (status === 'approved') { where.approvedByGuardian = true; where.rejected = false; }
    else if (status === 'rejected') { where.rejected = true; }
    else if (status === 'paid') { where.paid = true; }

    const fees = await prisma.additionalFee.findMany({
      where,
      include: {
        contract: {
          include: {
            caregiver: { include: { user: { select: { name: true, phone: true } } } },
            guardian: { include: { user: { select: { name: true, phone: true } } } },
            careRequest: { include: { patient: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: fees.map((f) => {
        // 계약의 platformFee %와 taxRate %로 계산
        const platformFeePercent = f.contract?.platformFee ?? 10;
        const taxRate = f.contract?.taxRate ?? 3.3;
        const platformFeeAmount = Math.round(f.amount * (platformFeePercent / 100));
        const taxAmount = Math.round((f.amount - platformFeeAmount) * (taxRate / 100));
        const netAmount = f.amount - platformFeeAmount - taxAmount;
        const statusLabel = f.rejected
          ? 'rejected'
          : f.paid
          ? 'paid'
          : f.approvedByGuardian
          ? 'approved'
          : 'pending';
        return {
          id: f.id,
          contractId: f.contractId,
          amount: f.amount,
          platformFeeAmount,
          taxAmount,
          netAmount,
          platformFeePercent,
          taxRate,
          reason: f.reason,
          approvedByGuardian: f.approvedByGuardian,
          rejected: f.rejected,
          rejectReason: f.rejectReason,
          paid: f.paid,
          statusLabel,
          createdAt: f.createdAt,
          caregiverName: f.contract?.caregiver?.user?.name,
          caregiverPhone: f.contract?.caregiver?.user?.phone,
          guardianName: f.contract?.guardian?.user?.name,
          guardianPhone: f.contract?.guardian?.user?.phone,
          patientName: f.contract?.careRequest?.patient?.name,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// GET /sidebar-badges - 사이드바 알림 카운트 (각 섹션별 처리 대기 건수)
export const getSidebarBadges = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      pendingCaregivers,
      pendingReports,
      pendingDisputes,
      pendingInsurance,
      pendingRefunds,
      pendingPayments,
      pendingAdditionalFees,
    ] = await Promise.all([
      prisma.caregiver.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: { in: ['PENDING', 'REVIEWING'] } } }),
      prisma.dispute.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      prisma.insuranceDocRequest.count({ where: { status: { in: ['REQUESTED', 'PROCESSING'] } } }),
      prisma.payment.count({ where: { refundRequestStatus: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.additionalFee.count({ where: { approvedByGuardian: false } }),
    ]);

    res.json({
      success: true,
      data: {
        caregivers: pendingCaregivers,
        reports: pendingReports,
        disputes: pendingDisputes,
        insurance: pendingInsurance,
        refunds: pendingRefunds,
        payments: pendingPayments,
        additionalFees: pendingAdditionalFees,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /settlements/:id/pay - 단일 정산 처리
export const paySettlement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const earning = await prisma.earning.findUnique({
      where: { id },
      include: { caregiver: { include: { user: true } } },
    });
    if (!earning) throw new AppError('정산 내역을 찾을 수 없습니다.', 404);
    if (earning.isPaid) throw new AppError('이미 정산 처리된 건입니다.', 400);

    await prisma.$transaction(async (tx) => {
      await tx.earning.update({
        where: { id },
        data: { isPaid: true, paidAt: new Date() },
      });
      // 간병인에게 알림 (템플릿)
      if (earning.caregiver?.userId) {
        const tpl = await renderTemplate('SETTLEMENT_PAID', { netAmount: earning.netAmount.toLocaleString() });
        if (tpl && tpl.enabled) {
          await tx.notification.create({
            data: {
              userId: earning.caregiver.userId,
              type: tpl.type,
              title: tpl.title,
              body: tpl.body,
              data: { earningId: id } as any,
            },
          });
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// POST /settlements/bulk-pay - 여러 정산 일괄 처리 (body: { ids: string[] })
export const bulkPaySettlements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('정산 ID 목록이 비어있습니다.', 400);
    }
    const targets = await prisma.earning.findMany({
      where: { id: { in: ids }, isPaid: false },
      include: { caregiver: true },
    });
    if (targets.length === 0) throw new AppError('처리 가능한 정산이 없습니다.', 400);

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.earning.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data: { isPaid: true, paidAt: now },
      });
      // 간병인별 알림 집계
      const byCaregiver = new Map<string, { userId: string; total: number; count: number }>();
      for (const t of targets) {
        const userId = t.caregiver?.userId;
        if (!userId) continue;
        const cur = byCaregiver.get(t.caregiverId) || { userId, total: 0, count: 0 };
        cur.total += t.netAmount;
        cur.count += 1;
        byCaregiver.set(t.caregiverId, cur);
      }
      // 간병인별 일괄 정산 알림 (템플릿)
      const values = Array.from(byCaregiver.values());
      const notifData: any[] = [];
      for (const v of values) {
        const tpl = await renderTemplate('SETTLEMENT_BULK_PAID', {
          count: String(v.count),
          total: v.total.toLocaleString(),
        });
        if (tpl && tpl.enabled) {
          notifData.push({
            userId: v.userId,
            type: tpl.type,
            title: tpl.title,
            body: tpl.body,
            data: { bulk: true } as any,
          });
        }
      }
      if (notifData.length > 0) {
        await tx.notification.createMany({ data: notifData });
      }
    });

    res.json({ success: true, data: { processed: targets.length } });
  } catch (error) {
    next(error);
  }
};

// GET /platform-config - 수수료 설정 조회
export const getPlatformConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let config = await prisma.platformConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      // 기본값으로 생성
      config = await prisma.platformConfig.create({
        data: { id: 'default' },
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

// GET /promotions - 프로모션 설정 조회
export const getPromotions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.platformConfig.findUnique({
      where: { id: 'default' },
    });

    // 프로모션 관련 정보 (PlatformConfig 기반)
    res.json({
      success: true,
      data: {
        referralPoints: config?.referralPoints ?? 10000,
        badgeThreshold: config?.badgeThreshold ?? 10,
        currentPromotions: {
          referralProgram: {
            active: true,
            pointsPerReferral: config?.referralPoints ?? 10000,
            description: '추천인 코드를 통해 가입하면 양쪽 모두에게 포인트가 지급됩니다.',
          },
          badgeProgram: {
            active: true,
            threshold: config?.badgeThreshold ?? 10,
            description: `매칭 ${config?.badgeThreshold ?? 10}회 이상, 평점 4.0 이상인 간병인에게 우수 간병사 뱃지를 부여합니다.`,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /promotions - 프로모션 수정
export const updatePromotions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { referralPoints, badgeThreshold } = req.body;

    const config = await prisma.platformConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(referralPoints !== undefined && { referralPoints: parseInt(referralPoints) }),
        ...(badgeThreshold !== undefined && { badgeThreshold: parseInt(badgeThreshold) }),
      },
      create: {
        id: 'default',
        referralPoints: referralPoints ?? 10000,
        badgeThreshold: badgeThreshold ?? 10,
      },
    });

    res.json({
      success: true,
      data: {
        referralPoints: config.referralPoints,
        badgeThreshold: config.badgeThreshold,
      },
      message: '프로모션 설정이 변경되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// PUT /caregivers/:caregiverId/certificates/:certId/verify - 자격증 검증
export const verifyCertificate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { caregiverId, certId } = req.params;

    const certificate = await prisma.certificate.findFirst({
      where: {
        id: certId,
        caregiverId,
      },
    });

    if (!certificate) {
      throw new AppError('자격증을 찾을 수 없습니다.', 404);
    }

    if (certificate.verified) {
      throw new AppError('이미 검증된 자격증입니다.', 400);
    }

    await prisma.certificate.update({
      where: { id: certId },
      data: { verified: true },
    });

    res.json({
      success: true,
      message: '자격증이 검증되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// PUT /caregivers/:id/verify-id-card - 신분증 본인 확인
export const verifyIdCard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const caregiver = await prisma.caregiver.findUnique({ where: { id } });
    if (!caregiver) throw new AppError('간병인을 찾을 수 없습니다.', 404);
    if (!caregiver.idCardImage) throw new AppError('신분증이 업로드되지 않았습니다.', 400);
    if (caregiver.identityVerified) throw new AppError('이미 본인 확인 완료된 간병인입니다.', 400);

    await prisma.caregiver.update({
      where: { id },
      data: { identityVerified: true },
    });

    res.json({ success: true, message: '신분증 본인 확인이 완료되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// PUT /caregivers/:id/verify-criminal-check - 범죄이력 조회서 확인
export const verifyCriminalCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const caregiver = await prisma.caregiver.findUnique({ where: { id } });
    if (!caregiver) throw new AppError('간병인을 찾을 수 없습니다.', 404);
    if (!caregiver.criminalCheckDoc) throw new AppError('범죄이력 조회서가 업로드되지 않았습니다.', 400);
    if (caregiver.criminalCheckDone) throw new AppError('이미 검증된 범죄이력 조회서입니다.', 400);

    await prisma.caregiver.update({
      where: { id },
      data: { criminalCheckDone: true, criminalCheckDate: new Date() },
    });

    res.json({ success: true, message: '범죄이력 조회서 검증이 완료되었습니다.' });
  } catch (error) {
    next(error);
  }
};

// GET /notifications - 알림 목록 (관리자용)
export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type as string | undefined;

    const whereClause: any = {};

    if (type) {
      whereClause.type = type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          userId: n.userId,
          userName: n.user?.name || '-',
          userEmail: n.user?.email || '-',
          type: n.type,
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          readAt: n.readAt,
          pushSent: n.pushSent,
          pushSuccess: n.pushSuccess,
          pushError: n.pushError,
          pushSentAt: n.pushSentAt,
          createdAt: n.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /notifications/send - 알림 발송 (관리자용)
export const sendNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { target, userId, title, body, type, linkUrl, imageUrl } = req.body;

    if (!title || !body) {
      throw new AppError('제목과 내용을 입력해주세요.', 400);
    }

    const notificationType = type || 'SYSTEM';
    const notificationData: Record<string, any> = {};
    if (linkUrl) notificationData.url = linkUrl;
    if (imageUrl) notificationData.imageUrl = imageUrl;

    if (target === 'individual') {
      if (!userId) {
        throw new AppError('개별 발송 시 사용자 ID를 입력해주세요.', 400);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('사용자를 찾을 수 없습니다.', 404);
      }

      const notification = await prisma.notification.create({
        data: {
          userId,
          type: notificationType,
          title,
          body,
          data: Object.keys(notificationData).length ? notificationData : undefined,
        },
      });

      // FCM 푸시 발송
      if (user.fcmToken) {
        const adminFb = await import('../config/firebase');
        const firebase = adminFb.default;
        if (firebase.apps.length) {
          try {
            await firebase.messaging().send({
              token: user.fcmToken,
              notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
              data: { ...Object.fromEntries(Object.entries(notificationData).map(([k, v]) => [k, String(v)])), notificationId: notification.id },
              android: { priority: 'high', notification: { sound: 'default', channelId: 'carematch-default', ...(imageUrl ? { imageUrl } : {}) } },
            });
            await prisma.notification.update({ where: { id: notification.id }, data: { pushSent: true, pushSuccess: true, pushSentAt: new Date() } });
          } catch {
            await prisma.notification.update({ where: { id: notification.id }, data: { pushSent: true, pushSuccess: false, pushError: '발송 실패', pushSentAt: new Date() } });
          }
        }
      }

      res.status(201).json({
        success: true,
        message: `${user.name}님에게 알림이 발송되었습니다.`,
      });
    } else if (target === 'guardians' || target === 'caregivers') {
      // 보호자/간병인 필터 발송
      const role = target === 'guardians' ? 'GUARDIAN' : 'CAREGIVER';
      const users = await prisma.user.findMany({
        where: { isActive: true, role },
        select: { id: true, fcmToken: true, pushEnabled: true },
      });

      if (users.length === 0) {
        throw new AppError('발송 대상 사용자가 없습니다.', 400);
      }

      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: notificationType,
          title,
          body,
          data: Object.keys(notificationData).length ? notificationData : undefined,
        })),
      });

      // FCM 푸시 발송
      const adminFb = await import('../config/firebase');
      const firebase = adminFb.default;
      let pushCount = 0;
      if (firebase.apps.length) {
        const tokens = users.filter(u => u.fcmToken && u.pushEnabled !== false).map(u => u.fcmToken!);
        if (tokens.length > 0) {
          try {
            const result = await firebase.messaging().sendEachForMulticast({
              tokens,
              notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
              data: Object.fromEntries(Object.entries(notificationData).map(([k, v]) => [k, String(v)])),
              android: { priority: 'high', notification: { sound: 'default', channelId: 'carematch-default' } },
            });
            pushCount = result.successCount;
          } catch {}
        }
      }

      const roleLabel = target === 'guardians' ? '보호자' : '간병인';
      res.status(201).json({
        success: true,
        message: `${roleLabel} ${users.length}명 알림 저장, ${pushCount}명 푸시 발송`,
      });
    } else if (target === 'all_devices') {
      // 전체 디바이스 발송 (비회원 포함)
      const admin = await import('../config/firebase');
      const firebase = admin.default;

      // pushEnabled=false인 유저의 토큰은 제외
      const disabledUsers = await prisma.user.findMany({
        where: { pushEnabled: false },
        select: { fcmToken: true },
      });
      const disabledTokens = new Set(disabledUsers.map(u => u.fcmToken).filter(Boolean));

      const allDeviceTokens = await prisma.deviceToken.findMany({
        select: { token: true },
      });
      const deviceTokens = allDeviceTokens.filter(d => !disabledTokens.has(d.token));

      if (deviceTokens.length === 0) {
        throw new AppError('등록된 디바이스가 없습니다.', 400);
      }

      // 회원에게는 DB 알림도 저장
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (users.length > 0) {
        await prisma.notification.createMany({
          data: users.map((u) => ({
            userId: u.id,
            type: notificationType,
            title,
            body,
            data: Object.keys(notificationData).length ? notificationData : undefined,
          })),
        });
      }

      // 모든 디바이스에 FCM 푸시 발송
      let successCount = 0;
      if (firebase.apps.length) {
        const tokens = deviceTokens.map(d => d.token);
        try {
          const result = await firebase.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
            data: Object.fromEntries(Object.entries(notificationData).map(([k, v]) => [k, String(v)])),
            android: { priority: 'high', notification: { sound: 'default', channelId: 'carematch-default', ...(imageUrl ? { imageUrl } : {}) } },
          });
          successCount = result.successCount;
        } catch (e) {
          console.error('[FCM] 전체 발송 오류:', e);
        }
      }

      res.status(201).json({
        success: true,
        message: `디바이스 ${deviceTokens.length}대 중 ${successCount}대 푸시 발송, 회원 ${users.length}명 알림 저장`,
      });
    } else {
      // 전체 회원 발송
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, fcmToken: true, pushEnabled: true },
      });

      if (users.length === 0) {
        throw new AppError('발송 대상 사용자가 없습니다.', 400);
      }

      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: notificationType,
          title,
          body,
          data: Object.keys(notificationData).length ? notificationData : undefined,
        })),
      });

      // FCM 푸시 발송
      const adminFb = await import('../config/firebase');
      const firebase = adminFb.default;
      let pushCount = 0;
      if (firebase.apps.length) {
        const tokens = users.filter(u => u.fcmToken && u.pushEnabled !== false).map(u => u.fcmToken!);
        if (tokens.length > 0) {
          try {
            const result = await firebase.messaging().sendEachForMulticast({
              tokens,
              notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
              data: Object.fromEntries(Object.entries(notificationData).map(([k, v]) => [k, String(v)])),
              android: { priority: 'high', notification: { sound: 'default', channelId: 'carematch-default' } },
            });
            pushCount = result.successCount;
          } catch {}
        }
      }

      res.status(201).json({
        success: true,
        message: `${users.length}명 알림 저장, ${pushCount}명 푸시 발송`,
      });
    }
  } catch (error) {
    next(error);
  }
};

// DELETE /notifications/unsent - 미발송 알림 일괄 삭제
export const deleteUnsentNotifications = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: { pushSent: false },
    });

    res.json({
      success: true,
      message: `미발송 알림 ${result.count}건이 삭제되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Education (Admin) ──────────────────────────────────

// GET /education - 교육 과정 목록 (관리자용, 수강 통계 포함)
export const getAdminEducations = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const educations = await prisma.education.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { records: true },
        },
        records: {
          where: { completed: true },
          select: { id: true },
        },
      },
    });

    const totalRecords = await prisma.educationRecord.count();
    const completedRecords = await prisma.educationRecord.count({ where: { completed: true } });

    const courses = educations.map((edu) => {
      const enrolledCount = edu._count.records;
      const completedCount = edu.records.length;
      const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;
      return {
        id: edu.id,
        title: edu.title,
        description: edu.description,
        videoUrl: edu.videoUrl,
        duration: edu.duration,
        order: edu.order,
        isActive: edu.isActive,
        enrolledCount,
        completedCount,
        completionRate,
        createdAt: edu.createdAt,
        updatedAt: edu.updatedAt,
      };
    });

    const totalCourses = educations.length;
    const overallCompletionRate = totalRecords > 0 ? Math.round((completedRecords / totalRecords) * 100) : 0;

    res.json({
      success: true,
      data: {
        courses,
        summary: {
          totalCourses,
          totalCompleted: completedRecords,
          averageCompletionRate: overallCompletionRate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /education - 교육 과정 생성
export const createEducation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, videoUrl, duration, order } = req.body;

    const education = await prisma.education.create({
      data: {
        title,
        description: description || null,
        videoUrl: videoUrl || null,
        duration: parseInt(duration),
        order: order !== undefined ? parseInt(order) : 0,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      data: education,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /education/:id - 교육 과정 수정
export const updateEducation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { title, description, videoUrl, duration, order, isActive } = req.body;

    const existing = await prisma.education.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('교육 과정을 찾을 수 없습니다.', 404);
    }

    const education = await prisma.education.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(order !== undefined && { order: parseInt(order) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      data: education,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /education/:id - 교육 과정 삭제
export const deleteEducation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.education.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('교육 과정을 찾을 수 없습니다.', 404);
    }

    // Delete related records first, then the education
    await prisma.$transaction([
      prisma.educationRecord.deleteMany({ where: { educationId: id } }),
      prisma.education.delete({ where: { id } }),
    ]);

    res.json({
      success: true,
      message: '교육 과정이 삭제되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /admin/association-fees - 간병인 협회비 월별 현황
export const getAssociationFees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

    const caregivers = await prisma.caregiver.findMany({
      where: { status: { in: ['APPROVED', 'SUSPENDED'] } },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        feePayments: {
          where: { year, month },
        },
        penalties: {
          select: { id: true },
        },
        _count: {
          select: { contracts: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const rows = caregivers.map((cg) => {
      const fee = cg.feePayments[0];
      return {
        caregiverId: cg.id,
        name: cg.user.name,
        status: cg.status,
        workStatus: cg.workStatus,
        phone: cg.user.phone,
        email: cg.user.email,
        feePaid: !!fee?.paid,
        feeAmount: fee?.amount || 0,
        feePaidAt: fee?.paidAt,
        feeNote: fee?.note || '',
        careCount: cg._count.contracts,
        penaltyCount: cg.penaltyCount,
      };
    });

    res.json({ success: true, data: { year, month, rows } });
  } catch (error) {
    next(error);
  }
};

// PUT /admin/association-fees/:caregiverId
export const updateAssociationFee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { caregiverId } = req.params;
    const { year, month, paid, amount, note } = req.body;

    const cg = await prisma.caregiver.findUnique({ where: { id: caregiverId } });
    if (!cg) throw new AppError('간병인을 찾을 수 없습니다.', 404);

    const record = await prisma.associationFeePayment.upsert({
      where: {
        caregiverId_year_month: { caregiverId, year, month },
      },
      create: {
        caregiverId,
        year,
        month,
        amount: amount || 0,
        paid,
        paidAt: paid ? new Date() : null,
        note: note || null,
      },
      update: {
        amount: amount !== undefined ? amount : undefined,
        paid,
        paidAt: paid ? new Date() : null,
        note: note !== undefined ? note : undefined,
      },
    });

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

// GET /admin/association-fees/export - 엑셀(CSV) 다운로드
export const exportAssociationFees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // 월 파라미터 처리
    // ?months=1,2,3 (다중월) / ?month=4 (단일월) / 없으면 연간 전체
    let months: number[] = [];
    if (req.query.months) {
      months = (req.query.months as string)
        .split(',')
        .map((m) => parseInt(m.trim()))
        .filter((m) => m >= 1 && m <= 12);
    } else if (req.query.month) {
      const m = parseInt(req.query.month as string);
      if (m >= 1 && m <= 12) months = [m];
    } else {
      months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }

    if (months.length === 0) {
      throw new AppError('유효한 월을 선택해주세요.', 400);
    }
    months.sort((a, b) => a - b);

    const caregivers = await prisma.caregiver.findMany({
      where: { status: { in: ['APPROVED', 'SUSPENDED'] } },
      include: {
        user: { select: { name: true, phone: true } },
        feePayments: { where: { year, month: { in: months } } },
        consultMemos: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { contracts: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const isMultiMonth = months.length > 1;
    const monthHeaders = months.map((m) => `${m}월`);
    const header = isMultiMonth
      ? ['이름', '상태', ...monthHeaders, '총 납부액', '간병기간(횟수)', '패널티(누계)', '연락처', '최근 상담 메모']
      : ['이름', '상태', '협회비(O/X)', '납부액', '간병기간(횟수)', '패널티(누계)', '연락처', '최근 상담 메모'];

    const rows = caregivers.map((cg) => {
      const status = cg.status === 'APPROVED' ? '활동' : cg.status === 'SUSPENDED' ? '정지' : cg.status;
      const memo = cg.consultMemos[0]?.content.replace(/\n/g, ' ').replace(/"/g, '""') || '';
      const payByMonth = new Map(cg.feePayments.map((p) => [p.month, p]));

      if (isMultiMonth) {
        const monthCells = months.map((m) => {
          const p = payByMonth.get(m);
          return p?.paid ? `${p.amount.toLocaleString()}원` : 'X';
        });
        const total = cg.feePayments.filter((p) => p.paid).reduce((a, b) => a + b.amount, 0);
        return [
          cg.user.name, status, ...monthCells,
          `${total.toLocaleString()}원`,
          `${cg._count.contracts}회`, `${cg.penaltyCount}회`,
          cg.user.phone, memo,
        ];
      } else {
        const p = payByMonth.get(months[0]);
        return [
          cg.user.name, status,
          p?.paid ? 'O' : 'X',
          p?.paid ? `${p.amount.toLocaleString()}원` : '-',
          `${cg._count.contracts}회`, `${cg.penaltyCount}회`,
          cg.user.phone, memo,
        ];
      }
    });

    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    let filename: string;
    if (months.length === 12) {
      filename = `협회비-${year}년전체.csv`;
    } else if (months.length === 1) {
      filename = `협회비-${year}-${String(months[0]).padStart(2, '0')}.csv`;
    } else {
      filename = `협회비-${year}-${months.map((m) => String(m).padStart(2, '0')).join('_')}.csv`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(bom + csv);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// 알림 템플릿 관리
// ──────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  { key: 'MATCHING_NEW', type: 'MATCHING', name: '신규 매칭 알림', title: '새로운 간병 요청', body: '{region} 지역에 새 간병 요청이 있습니다. 일당 {dailyRate}원', description: '변수: {region}, {dailyRate}' },
  { key: 'APPLICATION_ACCEPTED', type: 'APPLICATION', name: '지원 수락', title: '지원 수락됨', body: '{patientName} 환자 간병 지원이 수락되었습니다.', description: '변수: {patientName}' },
  { key: 'APPLICATION_REJECTED', type: 'APPLICATION', name: '지원 미선택', title: '지원 미선택', body: '이번 공고는 다른 간병사가 선정되었습니다.', description: '' },
  { key: 'CONTRACT_CREATED', type: 'CONTRACT', name: '계약 성사', title: '매칭 완료', body: '{caregiverName}님과 매칭되었습니다. 기간: {startDate} ~ {endDate}', description: '변수: {caregiverName}, {startDate}, {endDate}' },
  { key: 'EXTENSION_REMINDER_3D', type: 'EXTENSION', name: '연장 3일 전 알림', title: '간병 종료 3일 전', body: '{patientName} 환자 간병이 3일 뒤 종료됩니다. 연장을 원하시면 마이페이지에서 요청해주세요.', description: '변수: {patientName}' },
  { key: 'EXTENSION_REMINDER_1D', type: 'EXTENSION', name: '연장 1일 전 알림', title: '간병 종료 1일 전', body: '{patientName} 환자 간병이 내일 종료됩니다.', description: '변수: {patientName}' },
  { key: 'PAYMENT_COMPLETED', type: 'PAYMENT', name: '결제 완료', title: '결제 완료', body: '{amount}원 결제가 완료되었습니다.', description: '변수: {amount}' },
  { key: 'PENALTY_ISSUED', type: 'PENALTY', name: '패널티 부여', title: '패널티가 부여되었습니다', body: '{reason}', description: '변수: {reason}' },
];

// GET /admin/notification-templates
export const getNotificationTemplates = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // 템플릿 없으면 기본 시드
    const count = await prisma.notificationTemplate.count();
    if (count === 0) {
      await prisma.notificationTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({ ...t, isSystem: true })),
      });
    }

    const templates = await prisma.notificationTemplate.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

// PUT /admin/notification-templates/:id
export const updateNotificationTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, body, enabled, description } = req.body;

    const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!existing) throw new AppError('템플릿을 찾을 수 없습니다.', 404);

    const updated = await prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        ...(enabled !== undefined && { enabled }),
        ...(description !== undefined && { description }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// POST /admin/notification-templates  (커스텀 템플릿 추가)
export const createNotificationTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key, name, type, title, body, description } = req.body;
    if (!key || !name || !type || !title || !body) {
      throw new AppError('key, name, type, title, body는 필수입니다.', 400);
    }
    const existing = await prisma.notificationTemplate.findUnique({ where: { key } });
    if (existing) throw new AppError('이미 존재하는 키입니다.', 400);

    const created = await prisma.notificationTemplate.create({
      data: { key, name, type, title, body, description, enabled: true, isSystem: false },
    });
    res.json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

// DELETE /admin/notification-templates/:id
export const deleteNotificationTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!existing) throw new AppError('템플릿을 찾을 수 없습니다.', 404);
    if (existing.isSystem) throw new AppError('시스템 기본 템플릿은 삭제할 수 없습니다.', 400);

    await prisma.notificationTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// GET /patients/:id - 환자 상세 (관리자)
export const getPatientDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        guardian: {
          include: { user: { select: { name: true, email: true, phone: true } } },
        },
        careRequests: {
          include: {
            contracts: {
              orderBy: { createdAt: 'desc' },
              include: {
                caregiver: { include: { user: { select: { name: true } } } },
                payments: { select: { id: true, status: true, totalAmount: true, paidAt: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!patient) throw new AppError('환자를 찾을 수 없습니다.', 404);
    // 프론트 호환: contract 단수 = 비취소 최신 계약
    (patient as any).careRequests?.forEach((cr: any) => {
      cr.contract = (cr.contracts || []).find((c: any) => c.status !== 'CANCELLED') || (cr.contracts || [])[0] || null;
    });
    res.json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
};

// PUT /patients/:id - 환자 정보 수정 (관리자)
export const updatePatientByAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, birthDate, gender, weight, height, consciousness, hasDementia, dementiaLevel, hasInfection, infectionDetail, medicalNotes, diagnosis } = req.body;
    const exists = await prisma.patient.findUnique({ where: { id } });
    if (!exists) throw new AppError('환자를 찾을 수 없습니다.', 404);

    const updated = await prisma.patient.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(birthDate !== undefined && { birthDate: new Date(birthDate) }),
        ...(gender !== undefined && { gender }),
        ...(weight !== undefined && { weight: weight ? parseFloat(weight) : null }),
        ...(height !== undefined && { height: height ? parseFloat(height) : null }),
        ...(consciousness !== undefined && { consciousness }),
        ...(hasDementia !== undefined && { hasDementia: !!hasDementia }),
        ...(dementiaLevel !== undefined && { dementiaLevel }),
        ...(hasInfection !== undefined && { hasInfection: !!hasInfection }),
        ...(infectionDetail !== undefined && { infectionDetail }),
        ...(medicalNotes !== undefined && { medicalNotes }),
        ...(diagnosis !== undefined && { diagnosis }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// DELETE /patients/:id - 환자 삭제 (관리자, 진행 중 간병 없을 때만)
export const deletePatientByAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const activeRequests = await prisma.careRequest.count({
      where: { patientId: id, status: { in: ['OPEN', 'MATCHED', 'IN_PROGRESS', 'MATCHING'] } },
    });
    if (activeRequests > 0) {
      throw new AppError('진행 중인 간병 요청이 있는 환자는 삭제할 수 없습니다.', 400);
    }
    await prisma.patient.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// POST /admin/emergency-rematch/:contractId/revert - 긴급 재매칭 되돌리기
// 조건: 해당 CareRequest에 아직 새 활성 계약이 없는 경우에만 원 계약 복구 가능
export const revertEmergencyRematch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        careRequest: true,
        caregiver: { include: { user: true } },
        guardian: { include: { user: true } },
      },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);
    if (contract.status !== 'CANCELLED') {
      throw new AppError('취소된 계약만 되돌릴 수 있습니다.', 400);
    }
    if (!contract.cancellationReason?.includes('긴급 재매칭')) {
      throw new AppError('긴급 재매칭으로 취소된 계약만 복구 가능합니다.', 400);
    }

    // 새 활성 계약이 이미 있으면 복구 불가
    const newActiveContract = await prisma.contract.findFirst({
      where: {
        careRequestId: contract.careRequestId,
        status: { in: ['ACTIVE', 'EXTENDED'] },
        id: { not: contractId },
      },
    });
    if (newActiveContract) {
      throw new AppError('이미 새 계약이 매칭되어 있어 되돌릴 수 없습니다.', 400);
    }

    await prisma.$transaction(async (tx) => {
      // 계약 복구
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'ACTIVE',
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          cancellationPolicy: null,
        },
      });

      // 간병 요청 상태 복구
      await tx.careRequest.update({
        where: { id: contract.careRequestId },
        data: { status: 'IN_PROGRESS' },
      });

      // 간병인 근무 상태 복구
      await tx.caregiver.update({
        where: { id: contract.caregiverId },
        data: { workStatus: 'WORKING' },
      });

      // 원 간병인의 CareApplication ACCEPTED로 복구
      await tx.careApplication.updateMany({
        where: {
          careRequestId: contract.careRequestId,
          caregiverId: contract.caregiverId,
          status: 'CANCELLED',
        },
        data: { status: 'ACCEPTED' },
      });

      // 관련 분쟁 PROCESSING로 복귀
      await tx.dispute.updateMany({
        where: {
          contractId,
          status: 'RESOLVED',
          resolution: { contains: '긴급 재매칭' },
        },
        data: { status: 'PROCESSING', resolution: '긴급 재매칭 취소로 되돌림', handledAt: new Date() },
      });

      // 간병인에게 알림
      await tx.notification.create({
        data: {
          userId: contract.caregiver.userId,
          type: 'CONTRACT',
          title: '계약이 복구되었습니다',
          body: '관리자에 의해 긴급 재매칭이 취소되어 기존 계약이 다시 활성화되었습니다.',
          data: { contractId },
        },
      }).catch(() => {});

      // 보호자에게 알림
      await tx.notification.create({
        data: {
          userId: contract.guardian.userId,
          type: 'CONTRACT',
          title: '계약이 복구되었습니다',
          body: '긴급 재매칭이 취소되어 기존 간병인과의 계약이 다시 활성화되었습니다.',
          data: { contractId },
        },
      }).catch(() => {});
    });

    res.json({ success: true, message: '긴급 재매칭이 되돌려졌습니다.' });
  } catch (error) {
    next(error);
  }
};

// GET /care-requests - 간병 일감(요청) 목록
export const getCareRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const careType = req.query.careType as string | undefined;
    const scheduleType = req.query.scheduleType as string | undefined;
    const location = req.query.location as string | undefined;
    const region = req.query.region as string | undefined;
    const hasApplicants = req.query.hasApplicants as string | undefined; // 'yes' | 'no'
    const startFrom = req.query.startFrom as string | undefined;
    const startTo = req.query.startTo as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (status) where.status = status;
    if (careType) where.careType = careType;
    if (scheduleType) where.scheduleType = scheduleType;
    if (location) where.location = location;
    if (region) where.regions = { has: region };
    if (hasApplicants === 'yes') where.applications = { some: {} };
    if (hasApplicants === 'no') where.applications = { none: {} };
    if (startFrom || startTo) {
      where.startDate = {};
      if (startFrom) where.startDate.gte = new Date(startFrom);
      if (startTo) where.startDate.lte = new Date(`${startTo}T23:59:59.999Z`);
    }
    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { hospitalName: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { guardian: { user: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // 상태별 프로세스 흐름 정렬: OPEN → MATCHING → MATCHED → IN_PROGRESS → COMPLETED → CANCELLED
    const statusOrder: Record<string, number> = {
      OPEN: 1,
      MATCHING: 2,
      MATCHED: 3,
      IN_PROGRESS: 4,
      COMPLETED: 5,
      CANCELLED: 6,
    };

    const [allMatching, total] = await Promise.all([
      prisma.careRequest.findMany({
        where,
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.careRequest.count({ where }),
    ]);

    const orderedIds = allMatching
      .sort((a, b) => {
        const so = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        if (so !== 0) return so;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(skip, skip + limit)
      .map((r) => r.id);

    const fetched = orderedIds.length > 0
      ? await prisma.careRequest.findMany({
          where: { id: { in: orderedIds } },
          include: {
            patient: { select: { id: true, name: true, birthDate: true, gender: true } },
            guardian: {
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
            _count: { select: { applications: true, contracts: true } },
          },
        })
      : [];

    const byId = new Map(fetched.map((r) => [r.id, r]));
    const requests = orderedIds.map((id) => byId.get(id)!).filter(Boolean);

    const rows = requests.map((r) => ({
      id: r.id,
      status: r.status,
      careType: r.careType,
      scheduleType: r.scheduleType,
      location: r.location,
      address: r.address,
      hospitalName: r.hospitalName,
      regions: r.regions,
      startDate: r.startDate,
      endDate: r.endDate,
      durationDays: r.durationDays,
      dailyRate: r.dailyRate,
      hourlyRate: r.hourlyRate,
      patientId: r.patient?.id,
      patientName: r.patient?.name || '-',
      patientBirthDate: r.patient?.birthDate,
      patientGender: r.patient?.gender,
      guardianId: r.guardian?.id,
      guardianName: r.guardian?.user?.name || '-',
      guardianPhone: r.guardian?.user?.phone || '-',
      applicationCount: r._count.applications,
      contractCount: r._count.contracts,
      createdAt: r.createdAt,
    }));

    res.json({
      success: true,
      data: {
        requests: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /care-requests/:id - 간병 일감 상세 (지원자 포함)
export const getCareRequestDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const request = await prisma.careRequest.findUnique({
      where: { id },
      include: {
        patient: true,
        guardian: { include: { user: { select: { id: true, name: true, phone: true, email: true } } } },
        applications: {
          include: {
            caregiver: {
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        contracts: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            totalAmount: true,
            caregiver: {
              include: { user: { select: { name: true, phone: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// ==================== 공휴일 override 관리 ====================
import krHolidaysData from '../data/kr-holidays.json';
const KR_HOLIDAY_MAP = krHolidaysData as Record<string, string[]>;

function parseDateYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo, d));
  if (isNaN(dt.getTime())) return null;
  return dt;
}

// GET /holidays - override 목록 + 라이브러리 기본 공휴일 (year 쿼리 지원)
export const getHolidays = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));

    const overrides = await prisma.holiday.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    // 라이브러리 기본 공휴일 (해당 연도)
    const library: { date: string; names: string[] }[] = [];
    const yearPrefix = `${year}-`;
    for (const dateStr of Object.keys(KR_HOLIDAY_MAP)) {
      if (dateStr.startsWith(yearPrefix)) {
        library.push({ date: dateStr, names: [...KR_HOLIDAY_MAP[dateStr]] });
      }
    }
    library.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        year,
        overrides: overrides.map((o) => ({
          ...o,
          date: o.date.toISOString().slice(0, 10),
        })),
        library,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /holidays - 새 override 생성
export const createHoliday = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, name, type, description } = req.body;
    const dt = parseDateYMD(date);
    if (!dt) throw new AppError('유효한 날짜(YYYY-MM-DD)를 입력해주세요.', 400);
    if (!name || typeof name !== 'string') throw new AppError('이름을 입력해주세요.', 400);
    if (type && !['CUSTOM', 'EXCLUDE'].includes(type)) {
      throw new AppError('유효한 type(CUSTOM/EXCLUDE)을 선택해주세요.', 400);
    }

    const existing = await prisma.holiday.findUnique({ where: { date: dt } });
    if (existing) throw new AppError('이미 등록된 날짜입니다.', 400);

    const holiday = await prisma.holiday.create({
      data: {
        date: dt,
        name: name.trim(),
        type: (type as any) || 'CUSTOM',
        description: description ? String(description).trim() : null,
      },
    });

    res.status(201).json({
      success: true,
      data: { ...holiday, date: holiday.date.toISOString().slice(0, 10) },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /holidays/:id - override 수정
export const updateHoliday = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, type, description } = req.body;
    if (type && !['CUSTOM', 'EXCLUDE'].includes(type)) {
      throw new AppError('유효한 type(CUSTOM/EXCLUDE)을 선택해주세요.', 400);
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(type !== undefined && { type: type as any }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
      },
    });

    res.json({
      success: true,
      data: { ...holiday, date: holiday.date.toISOString().slice(0, 10) },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /holidays/:id - override 삭제
export const deleteHoliday = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.holiday.delete({ where: { id } });
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error) {
    next(error);
  }
};
