import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

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
    const recentDisputes = await prisma.contract.findMany({
      where: { status: 'CANCELLED' },
      include: {
        guardian: { include: { user: true } },
        caregiver: { include: { user: true } },
        careRequest: { include: { patient: true } },
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
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
        activeDisputes: 0,
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
        recentDisputes: recentDisputes.map(c => {
          let priority = '일반';
          if (c.cancellationReason && c.cancellationReason.includes('긴급')) {
            priority = '긴급';
          } else if (c.cancelledAt && c.careRequest?.startDate) {
            const cancelTime = new Date(c.cancelledAt).getTime();
            const startTime = new Date(c.careRequest.startDate).getTime();
            const hoursDiff = (startTime - cancelTime) / (1000 * 60 * 60);
            if (hoursDiff >= 0 && hoursDiff <= 24) {
              priority = '높음';
            }
          }
          return {
            id: c.id,
            patientName: c.careRequest?.patient?.name || '-',
            caregiverName: c.caregiver?.user?.name || '-',
            type: c.cancellationReason || '기타',
            createdAt: c.updatedAt,
            status: c.status,
            priority,
          };
        }),
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

    const [caregivers, total] = await Promise.all([
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
    ]);

    // 간병인 목록에 추가 정보 포함
    const enrichedCaregivers = caregivers.map((cg) => ({
      id: cg.id,
      name: cg.user.name,
      status: cg.status,
      workStatus: cg.workStatus,
      phone: cg.user.phone,
      email: cg.user.email,
      profileImage: cg.user.profileImage,
      // 협회비
      associationFee: cg.associationFee,
      associationPaidAt: cg.associationPaidAt,
      associationFeePaid: cg.associationFee > 0 || cg.associationPaidAt !== null,
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

    const whereClause: any = { year };
    if (month) {
      whereClause.month = month;
    }

    const stats = await prisma.monthlyStats.findMany({
      where: whereClause,
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    // 실시간 통계도 함께 제공
    const now = new Date();
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

    const stats = await prisma.monthlyStats.findMany({
      where: { year },
      orderBy: { month: 'asc' },
    });

    // CSV 형식으로 출력 (엑셀 호환)
    const headers = [
      '연도', '월', '총 요청', '총 매칭', '총 매출(원)',
      '플랫폼 수수료(원)', '활성 간병인', '활성 보호자', '평균 평점',
    ];

    const rows = stats.map((s) => [
      s.year,
      s.month,
      s.totalRequests,
      s.totalMatches,
      s.totalRevenue,
      s.totalPlatformFee,
      s.activeCaregivers,
      s.activeGuardians,
      s.avgRating.toFixed(1),
    ]);

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

    const enrichedPayments = payments.map((p) => ({
      id: p.id,
      contractId: p.contractId,
      patientName: p.contract?.careRequest?.patient?.name || '-',
      caregiverName: p.contract?.caregiver?.user?.name || '-',
      guardianName: p.guardian?.user?.name || '-',
      amount: p.totalAmount,
      fee: p.contract ? Math.round(p.amount * (p.contract.platformFee / 100)) : 0,
      netAmount: p.contract ? p.amount - Math.round(p.amount * (p.contract.platformFee / 100)) : p.amount,
      status: p.status,
      method: p.method,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      refundAmount: p.refundAmount,
      refundedAt: p.refundedAt ? p.refundedAt.toISOString() : null,
    }));

    res.json({
      success: true,
      data: {
        payments: enrichedPayments,
        summary: {
          monthlyTotal: monthlyTotal._sum.totalAmount || 0,
          monthlyFees: monthlyFees._sum.platformFee || 0,
          pendingSettlements: pendingCount,
          monthlyRefunds: monthlyRefunds._count,
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

    const { target, userId, title, body, type } = req.body;

    if (!title || !body) {
      throw new AppError('제목과 내용을 입력해주세요.', 400);
    }

    const notificationType = type || 'SYSTEM';

    if (target === 'individual') {
      if (!userId) {
        throw new AppError('개별 발송 시 사용자 ID를 입력해주세요.', 400);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('사용자를 찾을 수 없습니다.', 404);
      }

      await prisma.notification.create({
        data: {
          userId,
          type: notificationType,
          title,
          body,
        },
      });

      res.status(201).json({
        success: true,
        message: `${user.name}님에게 알림이 발송되었습니다.`,
      });
    } else {
      // 전체 발송
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
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
        })),
      });

      res.status(201).json({
        success: true,
        message: `${users.length}명에게 알림이 발송되었습니다.`,
      });
    }
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
