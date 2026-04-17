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
          contract: {
            include: {
              caregiver: {
                include: { user: { select: { name: true, phone: true } } },
              },
              payments: {
                select: { id: true, status: true, totalAmount: true },
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
      if (cr.contract) {
        // 계약 있는 경우 — 기존 contract 형식 + careRequest 정보
        return {
          ...cr.contract,
          careRequest: {
            ...cr,
            contract: undefined,
            applications: undefined,
            _count: cr._count,
          },
        };
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
        review: null,
        careRequest: {
          ...cr,
          contract: undefined,
          applications: undefined,
          _count: cr._count,
        },
        caregiver: null,
      };
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

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { guardianId: guardian.id },
        include: {
          contract: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
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
    ]);

    res.json({
      success: true,
      data: {
        payments,
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
