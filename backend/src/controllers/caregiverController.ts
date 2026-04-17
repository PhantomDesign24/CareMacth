import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// GET /profile - 프로필 조회
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({
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
        certificates: true,
      },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    res.json({
      success: true,
      data: caregiver,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /profile - 프로필 수정
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const {
      gender,
      nationality,
      birthDate,
      address,
      latitude,
      longitude,
      preferredRegions,
      experienceYears,
      specialties,
      idCardImage,
      bankName,
      accountNumber,
      accountHolder,
    } = req.body;

    // Normalize gender: frontend may send "male"/"female", Prisma expects "M"/"F"
    const genderMap: Record<string, string> = { male: 'M', female: 'F', m: 'M', f: 'F', '남성': 'M', '여성': 'F' };
    const resolvedGender = gender !== undefined ? (genderMap[gender?.toLowerCase()] || gender?.toUpperCase()?.charAt(0) || gender) : undefined;

    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: {
        ...(resolvedGender !== undefined && { gender: resolvedGender }),
        ...(nationality !== undefined && { nationality }),
        ...(birthDate !== undefined && { birthDate: new Date(birthDate) }),
        ...(address !== undefined && { address }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(preferredRegions !== undefined && { preferredRegions }),
        ...(experienceYears !== undefined && { experienceYears: parseInt(experienceYears) }),
        ...(specialties !== undefined && { specialties }),
        ...(idCardImage !== undefined && { idCardImage }),
        ...(bankName !== undefined && { bankName }),
        ...(accountNumber !== undefined && { accountNumber }),
        ...(accountHolder !== undefined && { accountHolder }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            profileImage: true,
          },
        },
        certificates: true,
      },
    });

    // 프로필 이미지나 이름 변경이 있으면 User 테이블도 업데이트
    if (req.body.name || req.body.profileImage) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          ...(req.body.name && { name: req.body.name }),
          ...(req.body.profileImage && { profileImage: req.body.profileImage }),
        },
      });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// POST /certificates - 자격증 등록
export const addCertificate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const { name, issuer, issueDate } = req.body;

    // Handle file upload: prefer req.file, fall back to req.body.imageUrl
    const imageUrl = (req as any).file
      ? '/uploads/' + (req as any).file.filename
      : req.body.imageUrl;

    if (!name || !issuer || !issueDate || !imageUrl) {
      throw new AppError('자격증 정보를 모두 입력해주세요. (이름, 발급기관, 발급일, 이미지)', 400);
    }

    const certificate = await prisma.certificate.create({
      data: {
        caregiverId: caregiver.id,
        name,
        issuer,
        issueDate: new Date(issueDate),
        imageUrl,
      },
    });

    res.status(201).json({
      success: true,
      data: certificate,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /work-status - 근무 상태 변경
export const updateWorkStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    let { workStatus } = req.body;

    // Normalize workStatus: frontend may send lowercase or alternate names
    const workStatusMap: Record<string, string> = {
      working: 'WORKING', available: 'AVAILABLE', immediate: 'IMMEDIATE', immediately: 'IMMEDIATE',
    };
    workStatus = workStatusMap[workStatus?.toLowerCase()] || workStatus?.toUpperCase() || workStatus;

    if (!workStatus || !['WORKING', 'AVAILABLE', 'IMMEDIATE'].includes(workStatus)) {
      throw new AppError('유효한 근무 상태를 입력해주세요. (WORKING, AVAILABLE, IMMEDIATE)', 400);
    }

    if (caregiver.status !== 'APPROVED') {
      throw new AppError('승인된 간병인만 근무 상태를 변경할 수 있습니다.', 403);
    }

    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: { workStatus },
    });

    res.json({
      success: true,
      data: { workStatus: updated.workStatus },
    });
  } catch (error) {
    next(error);
  }
};

// GET /earnings - 수익 조회
export const getEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [earnings, total, summary] = await Promise.all([
      prisma.earning.findMany({
        where: { caregiverId: caregiver.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.earning.count({
        where: { caregiverId: caregiver.id },
      }),
      prisma.earning.aggregate({
        where: { caregiverId: caregiver.id },
        _sum: {
          amount: true,
          platformFee: true,
          taxAmount: true,
          netAmount: true,
        },
      }),
    ]);

    const unpaidTotal = await prisma.earning.aggregate({
      where: { caregiverId: caregiver.id, isPaid: false },
      _sum: {
        netAmount: true,
      },
    });

    res.json({
      success: true,
      data: {
        earnings,
        summary: {
          totalAmount: summary._sum.amount || 0,
          totalPlatformFee: summary._sum.platformFee || 0,
          totalTax: summary._sum.taxAmount || 0,
          totalNetAmount: summary._sum.netAmount || 0,
          unpaidAmount: unpaidTotal._sum.netAmount || 0,
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

// GET /penalties - 패널티 조회
export const getPenalties = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const penalties = await prisma.penalty.findMany({
      where: { caregiverId: caregiver.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        penalties,
        totalCount: caregiver.penaltyCount,
        noShowCount: caregiver.noShowCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /activity - 활동 이력
export const getActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [contracts, totalContracts] = await Promise.all([
      prisma.contract.findMany({
        where: { caregiverId: caregiver.id },
        include: {
          careRequest: {
            include: {
              patient: {
                select: { name: true, diagnosis: true, mobilityStatus: true },
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
      prisma.contract.count({
        where: { caregiverId: caregiver.id },
      }),
    ]);

    // 통계 정보
    const stats = {
      totalMatches: caregiver.totalMatches,
      avgRating: caregiver.avgRating,
      rehireRate: caregiver.rehireRate,
      cancellationRate: caregiver.cancellationRate,
      hasBadge: caregiver.hasBadge,
    };

    res.json({
      success: true,
      data: {
        stats,
        contracts,
        pagination: {
          page,
          limit,
          total: totalContracts,
          totalPages: Math.ceil(totalContracts / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


// GET /applications - 내가 지원한 요청 목록
export const getMyApplications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const applications = await prisma.careApplication.findMany({
      where: { caregiverId: caregiver.id },
      include: {
        careRequest: {
          include: {
            patient: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    next(error);
  }
};

// POST /criminal-check - 범죄이력 확인서 업로드
export const uploadCriminalCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('파일을 업로드해주세요.', 400);
    }
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });
    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }
    const url = `/uploads/${req.file.filename}`;
    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: {
        criminalCheckDoc: url,
        criminalCheckDone: true,
        criminalCheckDate: new Date(),
      },
    });
    res.json({ success: true, data: { url, caregiver: updated } });
  } catch (error) {
    next(error);
  }
};

// POST /id-card - 신분증 업로드
export const uploadIdCard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('파일을 업로드해주세요.', 400);
    }
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });
    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }
    const url = `/uploads/${req.file.filename}`;
    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: {
        idCardImage: url,
        identityVerified: true,
      },
    });
    res.json({ success: true, data: { url, caregiver: updated } });
  } catch (error) {
    next(error);
  }
};
