import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// GET / - 내 정보 조회
export const getMyInfo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            profileImage: true,
            referralCode: true,
            points: true,
            createdAt: true,
          },
        },
        patients: true,
        contracts: {
          where: { status: 'ACTIVE' },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    res.json({
      success: true,
      data: guardian,
    });
  } catch (error) {
    next(error);
  }
};

// POST /patients - 환자 등록
export const registerPatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const {
      name,
      birthDate,
      gender,
      consciousness,
      mobilityStatus,
      hasDementia,
      dementiaLevel,
      hasInfection,
      infectionDetail,
      medicalNotes,
      weight,
      height,
      diagnosis,
    } = req.body;

    if (!name || !birthDate || !gender || !mobilityStatus) {
      throw new AppError('필수 항목을 입력해주세요. (이름, 생년월일, 성별, 거동 상태)', 400);
    }

    // Normalize enum values: gender (M/F), mobilityStatus (INDEPENDENT/PARTIAL/DEPENDENT)
    const genderMap: Record<string, string> = { male: 'M', female: 'F', m: 'M', f: 'F', '남성': 'M', '여성': 'F' };
    const resolvedGender = genderMap[gender?.toLowerCase()] || gender?.toUpperCase()?.charAt(0) || 'M';

    const mobilityMap: Record<string, string> = {
      independent: 'INDEPENDENT', partial: 'PARTIAL', assisted: 'PARTIAL',
      wheelchair: 'DEPENDENT', bedridden: 'DEPENDENT', dependent: 'DEPENDENT',
    };
    const resolvedMobility = mobilityMap[mobilityStatus?.toLowerCase()] || mobilityStatus?.toUpperCase() || 'INDEPENDENT';

    // 중복 방지: 같은 보호자 아래 동일한 이름+생년월일 환자가 이미 있으면 기존 환자 반환
    // (같은 환자를 실수로 두 번 등록하는 것을 막기 위함)
    const existingPatient = await prisma.patient.findFirst({
      where: {
        guardianId: guardian.id,
        name,
        birthDate: new Date(birthDate),
      },
    });
    if (existingPatient) {
      return res.status(200).json({
        success: true,
        data: existingPatient,
        duplicate: true,
      });
    }

    const patient = await prisma.patient.create({
      data: {
        guardianId: guardian.id,
        name,
        birthDate: new Date(birthDate),
        gender: resolvedGender,
        consciousness: consciousness || null,
        mobilityStatus: resolvedMobility as any,
        hasDementia: hasDementia ?? false,
        dementiaLevel: hasDementia ? (dementiaLevel || null) : null,
        hasInfection: hasInfection ?? false,
        infectionDetail: hasInfection ? (infectionDetail || null) : null,
        medicalNotes: medicalNotes || null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        diagnosis: diagnosis || null,
      },
    });

    res.status(201).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

// GET /patients - 환자 목록
export const getPatients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const patients = await prisma.patient.findMany({
      where: { guardianId: guardian.id },
      include: {
        careRequests: {
          select: {
            id: true,
            status: true,
            careType: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /patients/:id - 환자 정보 수정
export const updatePatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;

    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const patient = await prisma.patient.findFirst({
      where: { id, guardianId: guardian.id },
    });

    if (!patient) {
      throw new AppError('환자 정보를 찾을 수 없습니다.', 404);
    }

    const {
      name,
      birthDate,
      gender,
      consciousness,
      mobilityStatus,
      hasDementia,
      dementiaLevel,
      hasInfection,
      infectionDetail,
      medicalNotes,
      weight,
      height,
      diagnosis,
    } = req.body;

    // Normalize enum values for updates
    const genderMap: Record<string, string> = { male: 'M', female: 'F', m: 'M', f: 'F', '남성': 'M', '여성': 'F' };
    const mobilityMap: Record<string, string> = {
      independent: 'INDEPENDENT', partial: 'PARTIAL', assisted: 'PARTIAL',
      wheelchair: 'DEPENDENT', bedridden: 'DEPENDENT', dependent: 'DEPENDENT',
    };
    const resolvedGender = gender !== undefined ? (genderMap[gender?.toLowerCase()] || gender?.toUpperCase()?.charAt(0) || gender) : undefined;
    const resolvedMobility = mobilityStatus !== undefined ? (mobilityMap[mobilityStatus?.toLowerCase()] || mobilityStatus?.toUpperCase() || mobilityStatus) : undefined;

    const updated = await prisma.patient.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(birthDate !== undefined && { birthDate: new Date(birthDate) }),
        ...(resolvedGender !== undefined && { gender: resolvedGender }),
        ...(consciousness !== undefined && { consciousness: consciousness || null }),
        ...(resolvedMobility !== undefined && { mobilityStatus: resolvedMobility as any }),
        ...(hasDementia !== undefined && { hasDementia }),
        ...(dementiaLevel !== undefined && { dementiaLevel: hasDementia ? (dementiaLevel || null) : null }),
        ...(hasInfection !== undefined && { hasInfection }),
        ...(infectionDetail !== undefined && { infectionDetail: hasInfection ? (infectionDetail || null) : null }),
        ...(medicalNotes !== undefined && { medicalNotes: medicalNotes || null }),
        ...(weight !== undefined && { weight: weight ? parseFloat(weight) : null }),
        ...(height !== undefined && { height: height ? parseFloat(height) : null }),
        ...(diagnosis !== undefined && { diagnosis: diagnosis || null }),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// GET /care-history - 간병 이력
export const getCareHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;

    // CareRequest 기반 조회 (매칭 전/진행중/완료/취소 모두 포함)
    const whereClause: any = { guardianId: guardian.id };
    if (statusFilter) {
      whereClause.status = statusFilter.toUpperCase();
    }

    const [careRequests, total] = await Promise.all([
      prisma.careRequest.findMany({
        where: whereClause,
        include: {
          patient: { select: { name: true, diagnosis: true } },
          applications: {
            where: { status: { in: ['PENDING', 'ACCEPTED'] } },
            select: { id: true, status: true },
          },
          contracts: {
            orderBy: { createdAt: 'desc' },
            include: {
              caregiver: {
                include: { user: { select: { name: true, phone: true } } },
              },
              payments: {
                select: { id: true, status: true, totalAmount: true },
              },
              reviews: {
                select: { id: true, rating: true, comment: true, wouldRehire: true, createdAt: true },
                take: 1,
              },
            },
          },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.careRequest.count({ where: whereClause }),
    ]);

    // 기존 contract 기반 응답 형식에 맞춰 매핑 (프론트 호환)
    const contracts = careRequests.map((cr: any) => {
      // 활성 계약 = CANCELLED 이외의 가장 최근 계약
      const activeContract = (cr.contracts || []).find((c: any) => c.status !== 'CANCELLED');
      const latestContract = activeContract || (cr.contracts || [])[0];
      // 계약이 취소됐는데 CareRequest는 OPEN/MATCHING이면 → 재매칭 중 (공고 중)
      const contractCancelledButReopened =
        latestContract?.status === 'CANCELLED' &&
        ['OPEN', 'MATCHING'].includes(cr.status);

      if (activeContract && !contractCancelledButReopened) {
        // 활성 계약 있는 경우 — 기존 contract 형식 + careRequest 정보
        // 프론트 호환: review 단수 필드 합성 (reviews[0])
        return {
          ...activeContract,
          review: activeContract.reviews?.[0] || null,
          reviews: undefined,
          careRequest: {
            ...cr,
            contracts: undefined,
            applications: undefined,
            _count: cr._count,
          },
        };
      }
      // 계약이 취소 후 재공고 중이거나 과거 취소 건 — latestContract의 리뷰도 노출
      if (latestContract) {
        // fallback: 과거 취소 계약의 review도 있으면 프론트에서 재리뷰 불가 처리
        (cr as any)._latestReview = latestContract.reviews?.[0] || null;
      }
      // 계약 없는 경우 (매칭 전) — 가상 contract 형식
      return {
        id: cr.id, // careRequest id를 contract id 자리에 (프론트가 careHistory의 id로 contract 조회할 수 있음)
        virtualContract: true, // 플래그: 실제 contract 없음
        careRequestId: cr.id,
        startDate: cr.startDate,
        endDate: cr.endDate
          || (cr.durationDays ? new Date(new Date(cr.startDate).getTime() + cr.durationDays * 24 * 60 * 60 * 1000) : null),
        dailyRate: cr.dailyRate || 0,
        totalAmount: (cr.dailyRate || 0) * (cr.durationDays || 1),
        status: cr.status, // CareRequest 상태 그대로 (OPEN/MATCHING/MATCHED/CANCELLED)
        review: (cr as any)._latestReview || null,
        careRequest: {
          ...cr,
          contract: undefined,
          applications: undefined,
          _count: cr._count,
        },
        caregiver: null,
      };
    });

    // careRequest.contracts 잔재 제거
    contracts.forEach((c: any) => {
      if (c?.careRequest?.contracts !== undefined) delete c.careRequest.contracts;
    });

    res.json({
      success: true,
      data: {
        contracts,
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

// GET /payments - 결제 내역
export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [payments, total, aggregate] = await Promise.all([
      prisma.payment.findMany({
        where: { guardianId: guardian.id },
        include: {
          contract: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              dailyRate: true,
              totalAmount: true,
              careRequest: {
                select: {
                  patient: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({
        where: { guardianId: guardian.id },
      }),
      prisma.payment.findMany({
        where: { guardianId: guardian.id },
        select: {
          totalAmount: true,
          refundAmount: true,
          status: true,
          pointsUsed: true,
          refundRequestStatus: true,
        },
      }),
    ]);

    // 정산 요약 집계
    const summary = aggregate.reduce(
      (acc, p) => {
        if (['COMPLETED', 'ESCROW', 'PARTIAL_REFUND'].includes(p.status)) {
          acc.totalPaid += p.totalAmount - (p.refundAmount || 0);
        }
        if (p.status === 'REFUNDED' || p.status === 'PARTIAL_REFUND') {
          acc.totalRefunded += p.refundAmount || 0;
        }
        if (p.status === 'PENDING') {
          acc.totalPending += p.totalAmount;
        }
        if (p.refundRequestStatus === 'PENDING') {
          acc.pendingRefundRequests += 1;
        }
        acc.totalPointsUsed += p.pointsUsed || 0;
        return acc;
      },
      {
        totalPaid: 0,
        totalRefunded: 0,
        totalPending: 0,
        totalPointsUsed: 0,
        pendingRefundRequests: 0,
        count: aggregate.length,
      },
    );

    // 추가 간병비 (옵션 B: 별도 트랙으로 집계만)
    const additionalFees = await prisma.additionalFee.findMany({
      where: { contract: { guardianId: guardian.id } },
      select: { amount: true, approvedByGuardian: true, rejected: true, paid: true },
    });
    const additionalFeesSummary = additionalFees.reduce(
      (acc, f) => {
        if (f.rejected) {
          acc.rejectedCount += 1;
          return acc;
        }
        if (f.approvedByGuardian) {
          acc.approvedTotal += f.amount;
          acc.approvedCount += 1;
          if (!f.paid) acc.approvedUnpaid += f.amount;
        } else {
          acc.pendingCount += 1;
          acc.pendingTotal += f.amount;
        }
        return acc;
      },
      { approvedTotal: 0, approvedUnpaid: 0, approvedCount: 0, pendingCount: 0, pendingTotal: 0, rejectedCount: 0 },
    );
    (summary as any).additionalFees = additionalFeesSummary;

    res.json({
      success: true,
      data: {
        payments,
        summary,
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
