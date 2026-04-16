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

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where: { guardianId: guardian.id },
        include: {
          careRequest: {
            include: {
              patient: {
                select: { name: true, diagnosis: true },
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contract.count({
        where: { guardianId: guardian.id },
      }),
    ]);

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
