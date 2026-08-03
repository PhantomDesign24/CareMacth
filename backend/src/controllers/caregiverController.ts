import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { sendToAdmins } from '../services/notificationService';
import { calculateEarning } from '../utils/earning';

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
      name,
      phone,
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
      corporateName,
      hasCriminalRecord,
    } = req.body;

    // 이름·연락처(User) 수정 — 마이페이지 개인정보 관리. 이메일은 로그인 식별자라 변경 불가.
    if (name !== undefined || phone !== undefined) {
      const userData: any = {};
      if (name !== undefined && String(name).trim()) userData.name = String(name).trim().slice(0, 50);
      if (phone !== undefined && String(phone).trim()) {
        const normalizedPhone = String(phone).replace(/\s/g, '');
        // 다른 사용자가 이미 쓰는 번호면 차단
        const dup = await prisma.user.findFirst({
          where: { phone: normalizedPhone, id: { not: req.user!.id } },
          select: { id: true },
        });
        if (dup) throw new AppError('이미 사용 중인 연락처입니다.', 409);
        userData.phone = normalizedPhone;
      }
      if (Object.keys(userData).length > 0) {
        await prisma.user.update({ where: { id: req.user!.id }, data: userData });
      }
    }

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
        ...(corporateName !== undefined && { corporateName: corporateName || null }),
        ...(hasCriminalRecord !== undefined && { hasCriminalRecord: hasCriminalRecord === null ? null : Boolean(hasCriminalRecord) } as any),
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

    // 자격증 이미지 — 비공개 저장(uploadPrivate) 후 인증 라우트로만 접근
    const imageUrl = (req as any).file
      ? '/api/files/private/' + (req as any).file.filename
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

    // 관리자에게 검증 요청 알림
    const userInfo = await prisma.user.findUnique({
      where: { id: caregiver.userId },
      select: { name: true },
    });
    await sendToAdmins({
      key: 'CERTIFICATE_UPLOADED_ADMIN',
      vars: { caregiverName: userInfo?.name || '간병인', certName: name },
      data: { caregiverId: caregiver.id, certificateId: certificate.id },
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: certificate,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /certificates/:id - 자격증 삭제 (본인 소유만)
export const deleteCertificate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
    if (!caregiver) throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);

    const { id } = req.params;
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert || cert.caregiverId !== caregiver.id) {
      throw new AppError('자격증을 찾을 수 없습니다.', 404);
    }
    await prisma.certificate.delete({ where: { id } });
    res.json({ success: true, message: '자격증이 삭제되었습니다.' });
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
      on_leave: 'ON_LEAVE', leave: 'ON_LEAVE',
    };
    workStatus = workStatusMap[workStatus?.toLowerCase()] || workStatus?.toUpperCase() || workStatus;

    if (!workStatus || !['WORKING', 'AVAILABLE', 'IMMEDIATE', 'ON_LEAVE'].includes(workStatus)) {
      throw new AppError('유효한 근무 상태를 입력해주세요. (WORKING, AVAILABLE, IMMEDIATE, ON_LEAVE)', 400);
    }

    if (caregiver.status !== 'APPROVED') {
      throw new AppError('승인된 간병인만 근무 상태를 변경할 수 있습니다.', 403);
    }

    // 간병 매칭이 진행 중이면 근무 상태를 아예 변경할 수 없다.
    //  (기존엔 AVAILABLE/IMMEDIATE 만 막아 매칭 중에도 '휴직'으로 바꿀 수 있었음)
    //  근무 상태는 계약 종료/취소 흐름에서 자동 해제된다.
    const ongoing = await prisma.contract.findFirst({
      where: {
        caregiverId: caregiver.id,
        status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] },
      },
      select: { endDate: true },
    });
    if (ongoing && workStatus !== caregiver.workStatus) {
      throw new AppError(
        `간병 매칭이 진행 중입니다. 간병이 종료(${new Date(ongoing.endDate).toLocaleDateString('ko-KR')})된 후 변경할 수 있습니다.`,
        409,
      );
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
          associationFeeDeducted: true,
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

    // 추가 간병비 (옵션 B: 별도 트랙으로 수익 요약에만 합산)
    // platformFee %와 taxRate %는 계약별로 다를 수 있어 개별 계산
    const additionalFees = await prisma.additionalFee.findMany({
      where: {
        requestedBy: caregiver.id,
        rejected: false,
      },
      include: {
        contract: {
          select: { platformFee: true, taxRate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const additionalFeesEnriched = additionalFees.map((f) => {
      const platformFeePercent = f.contract?.platformFee ?? 10;
      const taxRate = f.contract?.taxRate ?? 3.3;
      const platformFeeAmount = Math.round(f.amount * (platformFeePercent / 100));
      const taxAmount = Math.round((f.amount - platformFeeAmount) * (taxRate / 100));
      const netAmount = f.amount - platformFeeAmount - taxAmount;
      return {
        id: f.id,
        contractId: f.contractId,
        amount: f.amount,
        platformFeeAmount,
        taxAmount,
        netAmount,
        reason: f.reason,
        approvedByGuardian: f.approvedByGuardian,
        paid: f.paid,
        createdAt: f.createdAt,
      };
    });

    const approvedFees = additionalFeesEnriched.filter((f) => f.approvedByGuardian);
    const additionalFeesSummary = {
      totalAmount: approvedFees.reduce((s, f) => s + f.amount, 0),
      totalPlatformFee: approvedFees.reduce((s, f) => s + f.platformFeeAmount, 0),
      totalTax: approvedFees.reduce((s, f) => s + f.taxAmount, 0),
      totalNetAmount: approvedFees.reduce((s, f) => s + f.netAmount, 0),
      unpaidAmount: approvedFees.filter((f) => !f.paid).reduce((s, f) => s + f.netAmount, 0),
      pendingCount: additionalFeesEnriched.filter((f) => !f.approvedByGuardian).length,
      approvedCount: approvedFees.length,
    };

    // 정산 수익 + 추가비를 합친 통합 요약
    const combinedNet = (summary._sum.netAmount || 0) + additionalFeesSummary.totalNetAmount;
    const combinedUnpaid = (unpaidTotal._sum.netAmount || 0) + additionalFeesSummary.unpaidAmount;

    res.json({
      success: true,
      data: {
        earnings,
        summary: {
          totalAmount: summary._sum.amount || 0,
          totalPlatformFee: summary._sum.platformFee || 0,
          totalTax: summary._sum.taxAmount || 0,
          totalAssociationFee: (summary._sum as any).associationFeeDeducted || 0,
          totalNetAmount: summary._sum.netAmount || 0,
          unpaidAmount: unpaidTotal._sum.netAmount || 0,
        },
        additionalFees: additionalFeesEnriched,
        additionalFeesSummary,
        combinedSummary: {
          totalNetAmount: combinedNet,
          unpaidAmount: combinedUnpaid,
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

    // 오늘(KST) 간병일지 작성 여부 확인을 위해 오늘 날짜 범위 계산
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart.getTime() + 86400000);

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
          // 오늘 날짜의 간병기록만 include (프론트가 hasTodayRecord 판별용)
          careRecords: {
            where: { date: { gte: todayStart, lt: tomorrow } },
            select: { id: true, date: true },
            take: 1,
          },
          // 진행 중 연장 (수락/결제 대기) — 프론트 알림용
          extensions: {
            where: { status: { in: ['PENDING_CAREGIVER_APPROVAL', 'PENDING_PAYMENT'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
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

    // 간병사에게 보이는 금액은 매칭수수료(보호자 부담 플랫폼 이용료) 제외 기준으로 통일.
    //  공고 목록의 netDailyRate 와 동일해야 계약서·활동이력 금액이 어긋나지 않는다.
    const contractsForCaregiver = contracts.map((c: any) => {
      const days = Math.max(1, Math.round((c.totalAmount || 0) / (c.dailyRate || 1)));
      // 실제 정산과 동일 공식 — 정률(%) + 정액(원/일) 수수료를 모두 반영
      const calc = calculateEarning({
        amount: c.totalAmount || 0,
        platformFeePercent: c.platformFee || 0,
        platformFeeFixed: c.platformFeeFixed || 0,
        durationDays: days,
        taxRate: c.taxRate ?? 3.3,
      });
      const netTotalAmount = Math.max(0, (c.totalAmount || 0) - calc.platformFee);
      return {
        ...c,
        netDailyRate: Math.round(netTotalAmount / days),
        netTotalAmount,
        netPayoutAmount: calc.netAmount, // 원천징수까지 차감(협회비 별도)
      };
    });

    res.json({
      success: true,
      data: {
        stats,
        contracts: contractsForCaregiver,
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
            // 환자 민감정보(이름/생년월일/진단)는 결제 전 노출 금지 — birthDate 만 받아 ageBucket 계산
            patient: {
              select: { id: true, gender: true, birthDate: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ACCEPTED + 활성 계약이 있는 경우(결제 후)는 환자 이름 공개
    const acceptedRequestIds = applications
      .filter((a) => a.status === 'ACCEPTED')
      .map((a) => a.careRequestId);
    const activeContracts = acceptedRequestIds.length
      ? await prisma.contract.findMany({
          where: {
            careRequestId: { in: acceptedRequestIds },
            caregiverId: caregiver.id,
            status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE', 'COMPLETED'] },
          },
          include: { careRequest: { include: { patient: { select: { name: true } } } } },
        })
      : [];
    const exposedNameByRequest = new Map<string, string>();
    for (const c of activeContracts) {
      if (c.careRequest?.patient?.name) {
        exposedNameByRequest.set(c.careRequestId, c.careRequest.patient.name);
      }
    }

    const ageBucketOf = (birth: Date | null): string => {
      if (!birth) return '연령 미정';
      const age = Math.floor((Date.now() - new Date(birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 30) return '30대 이하';
      if (age < 40) return '30대';
      if (age < 50) return '40대';
      if (age < 60) return '50대';
      if (age < 70) return '60대';
      if (age < 80) return '70대';
      if (age < 90) return '80대';
      return '90대 이상';
    };

    const masked = applications.map((a) => {
      const exposedName = exposedNameByRequest.get(a.careRequestId);
      const cr: any = a.careRequest;
      const patient = cr?.patient
        ? {
            id: cr.patient.id,
            gender: cr.patient.gender,
            ageBucket: ageBucketOf(cr.patient.birthDate),
            ...(exposedName ? { name: exposedName } : {}),
          }
        : null;
      // 위치 정보도 결제 전엔 좌표 미노출
      const careRequest = cr
        ? {
            ...cr,
            patient,
            ...(exposedName ? {} : { latitude: null, longitude: null, address: null }),
          }
        : null;
      return { ...a, careRequest };
    });

    res.json({
      success: true,
      data: masked,
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
      include: { user: { select: { name: true } } },
    });
    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }
    // 비공개 파일 — 인증 라우트(/api/files/private/...) 경유로만 접근 가능
    const url = `/api/files/private/${req.file.filename}`;
    // 업로드만으로는 검증 완료가 아님 — criminalCheckDone 은 ADMIN 승인 시에만 true 로 전환
    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: {
        criminalCheckDoc: url,
        criminalCheckDate: new Date(),
      },
    });
    // 관리자에게 검증 요청 알림
    await sendToAdmins({
      key: 'CRIMINAL_CHECK_UPLOADED_ADMIN',
      vars: { caregiverName: caregiver.user?.name || '간병인' },
      data: { caregiverId: caregiver.id },
    }).catch(() => {});
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
      include: { user: { select: { name: true } } },
    });
    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }
    // 비공개 파일 — 인증 라우트(/api/files/private/...) 경유로만 접근 가능
    const url = `/api/files/private/${req.file.filename}`;
    // 업로드만으로는 신원 검증 완료가 아님 — identityVerified 는 ADMIN 승인 시에만 true 로 전환
    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: {
        idCardImage: url,
      },
    });
    // 관리자에게 본인 인증 알림
    await sendToAdmins({
      key: 'ID_CARD_UPLOADED_ADMIN',
      vars: { caregiverName: caregiver.user?.name || '간병인' },
      data: { caregiverId: caregiver.id },
    }).catch(() => {});
    res.json({ success: true, data: { url, caregiver: updated } });
  } catch (error) {
    next(error);
  }
};
