import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import {
  calculateDistance,
  getDistanceScore,
  getExperienceScore,
  getReviewScore,
  getRehireScore,
  getCancelPenalty,
} from '../utils/matchingScores';
import { sendFromTemplate, renderTemplate } from '../services/notificationService';

// POST / - 간병 요청 생성
export const createCareRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // 간병 신청은 보호자(GUARDIAN) 또는 병원(HOSPITAL) 회원만 가능
    if (!['GUARDIAN', 'HOSPITAL'].includes(req.user!.role)) {
      throw new AppError('간병 신청은 보호자 또는 병원 회원만 가능합니다.', 403);
    }

    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다. (병원 계정은 관리자에게 문의)', 404);
    }

    const {
      patientId,
      careType,
      scheduleType,
      location,
      hospitalName,
      address,
      latitude,
      longitude,
      startDate,
      endDate,
      durationDays,
      preferredGender,
      preferredNationality,
      specialRequirements,
      medicalActAgreed,
      dailyRate,
      hourlyRate,
      // 신규
      relationToPatient,
      preferredServices,
      preferredWageType,
      preferredWageAmount,
    } = req.body;

    // 환자가 본인 소유인지 확인
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, guardianId: guardian.id },
    });

    if (!patient) {
      throw new AppError('환자 정보를 찾을 수 없습니다.', 404);
    }

    if (!careType || !scheduleType || !location || !address || !startDate) {
      throw new AppError('필수 항목을 입력해주세요.', 400);
    }

    // 중복 방지: 같은 환자로 활성 상태인 간병 요청이 이미 있으면 차단
    // (OPEN/MATCHING/MATCHED — DB 부분 유니크 인덱스와 동일 집합)
    const existingOpenRequest = await prisma.careRequest.findFirst({
      where: {
        guardianId: guardian.id,
        patientId,
        status: { in: ['OPEN', 'MATCHING', 'MATCHED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingOpenRequest) {
      // 최근 10초 이내면 중복 클릭으로 간주 → 기존 요청 반환
      const diff = Date.now() - new Date(existingOpenRequest.createdAt).getTime();
      if (diff < 10 * 1000) {
        return res.status(200).json({
          success: true,
          data: existingOpenRequest,
          duplicate: true,
        });
      }
      // 그 외(같은 환자로 이미 진행 중인 요청이 있는 경우) → 거부
      throw new AppError(
        '해당 환자의 간병 요청이 이미 진행 중입니다. 기존 요청을 확인해주세요.',
        409,
      );
    }

    // Normalize enum values
    const careTypeMap: Record<string, string> = {
      hospital: 'INDIVIDUAL', home: 'FAMILY', visit: 'INDIVIDUAL', daily: 'INDIVIDUAL',
      individual: 'INDIVIDUAL', family: 'FAMILY',
    };
    const scheduleTypeMap: Record<string, string> = {
      '24h': 'FULL_TIME', hourly: 'PART_TIME', parttime: 'PART_TIME',
      full_time: 'FULL_TIME', part_time: 'PART_TIME',
    };
    const locationMap: Record<string, string> = {
      hospital: 'HOSPITAL', home: 'HOME',
    };
    const genderMap: Record<string, string> = { male: 'M', female: 'F', m: 'M', f: 'F', '남성': 'M', '여성': 'F' };

    const resolvedCareType = careTypeMap[careType?.toLowerCase()] || careType?.toUpperCase() || 'INDIVIDUAL';
    const resolvedScheduleType = scheduleTypeMap[scheduleType?.toLowerCase()] || scheduleType?.toUpperCase() || 'FULL_TIME';
    const resolvedLocation = locationMap[location?.toLowerCase()] || location?.toUpperCase() || 'HOSPITAL';
    const resolvedPreferredGender = preferredGender ? (genderMap[preferredGender?.toLowerCase()] || preferredGender) : null;

    // 시작일은 오늘 이후여야 함
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parsedStartDate = new Date(startDate);
    if (parsedStartDate < today) {
      throw new AppError('시작일은 오늘 이후여야 합니다.', 400);
    }

    // 종료일 검증: 시작일 이후여야 함
    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (parsedEndDate <= parsedStartDate) {
        throw new AppError('종료일은 시작일 이후여야 합니다.', 400);
      }
    }

    // 일당/시급 양수 검증
    if (dailyRate !== undefined && dailyRate !== null && parseInt(dailyRate) < 0) {
      throw new AppError('일당은 0 이상이어야 합니다.', 400);
    }
    if (hourlyRate !== undefined && hourlyRate !== null && parseInt(hourlyRate) < 0) {
      throw new AppError('시급은 0 이상이어야 합니다.', 400);
    }

    // 신규 필드 검증/정규화
    const VALID_WAGE_TYPES = ['MONTHLY_24H', 'MONTHLY_12H', 'MONTHLY_1H'];
    const VALID_PREFERRED_SERVICES = ['EXERCISE', 'COMPANION', 'TIDY', 'MEDICATION'];
    let resolvedWageType: string | null = null;
    if (preferredWageType) {
      if (!VALID_WAGE_TYPES.includes(preferredWageType)) {
        throw new AppError('희망 급여 형태가 올바르지 않습니다.', 400);
      }
      resolvedWageType = preferredWageType;
    }
    let resolvedWageAmount: number | null = null;
    if (preferredWageAmount !== undefined && preferredWageAmount !== null && preferredWageAmount !== '') {
      const n = Number(preferredWageAmount);
      if (!Number.isFinite(n) || n < 0) {
        throw new AppError('희망 급여 금액이 올바르지 않습니다.', 400);
      }
      resolvedWageAmount = Math.floor(n);
    }
    const resolvedPreferredServices = Array.isArray(preferredServices)
      ? preferredServices.filter((s) => VALID_PREFERRED_SERVICES.includes(s))
      : [];

    let careRequest;
    try {
      careRequest = await prisma.careRequest.create({
        data: {
          guardianId: guardian.id,
          patientId,
          careType: resolvedCareType as any,
          scheduleType: resolvedScheduleType as any,
          location: resolvedLocation as any,
          hospitalName,
          address,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          region: req.body.region || (Array.isArray(req.body.regions) && req.body.regions[0]) || null,
          regions: Array.isArray(req.body.regions) ? req.body.regions : (req.body.region ? [req.body.region] : []),
          startDate: new Date(startDate),
          endDate: endDate
            ? new Date(endDate)
            : durationDays
              ? new Date(new Date(startDate).getTime() + parseInt(durationDays) * 24 * 60 * 60 * 1000)
              : null,
          durationDays: durationDays ? parseInt(durationDays) : null,
          preferredGender: resolvedPreferredGender,
          preferredNationality,
          specialRequirements,
          medicalActAgreed: true,
          medicalActAgreedAt: new Date(),
          dailyRate: dailyRate ? parseInt(dailyRate) : null,
          hourlyRate: hourlyRate ? parseInt(hourlyRate) : null,
          // 신규
          relationToPatient: relationToPatient || null,
          preferredServices: resolvedPreferredServices,
          preferredWageType: resolvedWageType,
          preferredWageAmount: resolvedWageAmount,
        },
        include: { patient: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // DB 부분 유니크 인덱스 위반 — 동시 요청 중 패자. 기존 활성 요청 재조회 후 10초 이내면 duplicate, 아니면 409.
        const existing = await prisma.careRequest.findFirst({
          where: { guardianId: guardian.id, patientId, status: { in: ['OPEN', 'MATCHING', 'MATCHED'] } },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          const diff = Date.now() - new Date(existing.createdAt).getTime();
          if (diff < 10 * 1000) {
            return res.status(200).json({ success: true, data: existing, duplicate: true });
          }
          throw new AppError('해당 환자의 간병 요청이 이미 진행 중입니다.', 409);
        }
        throw new AppError('간병 요청 생성 중 충돌이 발생했습니다. 다시 시도해주세요.', 409);
      }
      throw e;
    }

    res.status(201).json({
      success: true,
      data: careRequest,
    });
  } catch (error) {
    next(error);
  }
};

// GET / - 간병 요청 목록
export const getCareRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status ? (req.query.status as string).toUpperCase() : undefined;

    // 보호자인 경우 본인 요청만, 간병인인 경우 OPEN 상태 요청 목록
    let whereClause: any = {};

    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian) {
        throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
      }
      whereClause.guardianId = guardian.id;
      if (status) {
        whereClause.status = status;
      }
    } else if (req.user!.role === 'CAREGIVER') {
      // 간병인: OPEN 상태 일감만 (미승인 간병인은 차단)
      const me = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
      if (!me || me.status !== 'APPROVED') {
        throw new AppError('승인된 간병인만 일감을 조회할 수 있습니다.', 403);
      }
      whereClause.status = status || 'OPEN';
    } else if (req.user!.role === 'ADMIN') {
      if (status) {
        whereClause.status = status;
      }
    } else {
      // 그 외 역할(HOSPITAL 등)은 차단
      throw new AppError('일감 목록에 접근할 수 없습니다.', 403);
    }

    // 지역 필터 — 모든 역할 공통
    const queryRegions: string[] = req.query.regions
      ? (Array.isArray(req.query.regions)
          ? (req.query.regions as string[])
          : (req.query.regions as string).split(',').filter(Boolean))
      : [];
    if (queryRegions.length > 0) {
      whereClause.OR = [
        { region: { in: queryRegions } },
        { regions: { hasSome: queryRegions } },
      ];
    }

    const [careRequests, total] = await Promise.all([
      prisma.careRequest.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              name: true,
              gender: true,
              birthDate: true,
              mobilityStatus: true,
              hasDementia: true,
              hasInfection: true,
              diagnosis: true,
            },
          },
          guardian: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
          _count: {
            select: { applications: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.careRequest.count({ where: whereClause }),
    ]);

    // 간병인 view: 결제 전 개인정보 마스킹
    // - 환자명/생년월일/진단명, 보호자명, 정확한 주소, 좌표 제거
    // - 시·구 단위 주소, 연령대(10단위), 성별, 거동 상태만 노출
    const sanitized =
      req.user!.role === 'CAREGIVER'
        ? careRequests.map((cr: any) => {
            const birthY = cr.patient?.birthDate ? new Date(cr.patient.birthDate).getFullYear() : null;
            const ageBucket = birthY
              ? Math.floor((new Date().getFullYear() - birthY) / 10) * 10
              : null;
            return {
              id: cr.id,
              careType: cr.careType,
              scheduleType: cr.scheduleType,
              location: cr.location,
              hospitalName: cr.hospitalName,
              address: typeof cr.address === 'string' ? cr.address.split(' ').slice(0, 2).join(' ') : null,
              region: cr.region,
              regions: cr.regions,
              startDate: cr.startDate,
              endDate: cr.endDate,
              durationDays: cr.durationDays,
              dailyRate: cr.dailyRate,
              hourlyRate: cr.hourlyRate ?? null,
              status: cr.status,
              medicalActAgreed: cr.medicalActAgreed,
              createdAt: cr.createdAt,
              patient: cr.patient
                ? {
                    gender: cr.patient.gender,
                    ageBucket,
                    mobilityStatus: cr.patient.mobilityStatus,
                    hasDementia: cr.patient.hasDementia,
                    hasInfection: cr.patient.hasInfection,
                  }
                : null,
              applicantCount: cr._count?.applications ?? 0,
            };
          })
        : careRequests;

    res.json({
      success: true,
      data: {
        careRequests: sanitized,
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

// GET /:id - 간병 요청 상세
export const getCareRequestById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const careRequest = await prisma.careRequest.findUnique({
      where: { id },
      include: {
        patient: true,
        guardian: {
          include: {
            user: {
              select: { name: true, phone: true },
            },
          },
        },
        applications: {
          include: {
            caregiver: {
              include: {
                user: {
                  select: { name: true, profileImage: true },
                },
                certificates: {
                  where: { verified: true },
                },
                reviews: {
                  where: { isHidden: false },
                  select: {
                    id: true,
                    rating: true,
                    comment: true,
                    wouldRehire: true,
                    createdAt: true,
                    guardian: { include: { user: { select: { name: true } } } },
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 3,
                },
                _count: {
                  select: { reviews: { where: { isHidden: false } } },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        matchScores: {
          orderBy: { score: 'desc' },
          take: 20,
        },
        contracts: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    // 역할별 접근 제어 — GUARDIAN/CAREGIVER/ADMIN 외에는 차단
    // (HOSPITAL 도 guardian 레코드를 함께 갖고 있으므로 GUARDIAN 분기로 통합)
    const role = req.user!.role;
    if (role !== 'GUARDIAN' && role !== 'CAREGIVER' && role !== 'ADMIN' && role !== 'HOSPITAL') {
      throw new AppError('접근 권한이 없습니다.', 403);
    }
    if (role === 'GUARDIAN' || role === 'HOSPITAL') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || careRequest.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    }

    // 간병인 view: 공개 일감 필드만 응답 (개인정보·경쟁자 정보 제거)
    if (req.user!.role === 'CAREGIVER') {
      // OPEN/MATCHING 외 상태는 간병인에게 비공개
      if (!['OPEN', 'MATCHING'].includes(careRequest.status)) {
        throw new AppError('현재 지원이 불가능한 일감입니다.', 404);
      }
      // 본인 application 만 추려서 노출
      const cg = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
      const myApp = cg
        ? (careRequest as any).applications?.find((a: any) => a.caregiverId === cg.id) || null
        : null;
      const safeView = {
        id: careRequest.id,
        careType: careRequest.careType,
        scheduleType: careRequest.scheduleType,
        location: careRequest.location,
        hospitalName: careRequest.hospitalName,
        // 자택 주소는 매칭 전엔 시·구 단위까지만 노출
        address: typeof careRequest.address === 'string'
          ? careRequest.address.split(' ').slice(0, 2).join(' ')
          : null,
        startDate: careRequest.startDate,
        endDate: careRequest.endDate,
        durationDays: careRequest.durationDays,
        dailyRate: careRequest.dailyRate,
        hourlyRate: (careRequest as any).hourlyRate ?? null,
        status: careRequest.status,
        medicalActAgreed: (careRequest as any).medicalActAgreed,
        regions: (careRequest as any).regions ?? null,
        // 좌표는 결제/계약 확정 후에만 노출 — 매칭 전엔 거리는 별도 계산해서 내려야 안전
        // latitude / longitude 는 의도적으로 응답에서 제외
        createdAt: careRequest.createdAt,
        // 환자: 식별정보 제외, 간병에 필요한 일반 정보만
        // - 정확한 나이 대신 10세 단위 ageBucket
        // - 진단명/의료기록은 매칭 후에만
        patient: careRequest.patient
          ? {
              gender: careRequest.patient.gender,
              ageBucket: careRequest.patient.birthDate
                ? Math.floor((new Date().getFullYear() - new Date(careRequest.patient.birthDate).getFullYear()) / 10) * 10
                : null,
              mobilityStatus: careRequest.patient.mobilityStatus,
              hasDementia: (careRequest.patient as any).hasDementia ?? false,
              hasInfection: (careRequest.patient as any).hasInfection ?? false,
              consciousness: (careRequest.patient as any).consciousness ?? null,
            }
          : null,
        // 보호자: 이름·연락처·이메일 모두 비노출
        // 다른 지원자 정보 비노출 (경쟁자 정보)
        // matchScores 비노출
        myApplication: myApp
          ? {
              id: myApp.id,
              status: myApp.status,
              proposedRate: myApp.proposedRate,
              isAccepted: myApp.isAccepted,
              message: myApp.message,
              createdAt: myApp.createdAt,
            }
          : null,
        // 지원자 수만 (경쟁률 표시용)
        applicantCount: (careRequest as any).applications?.length ?? 0,
      };
      return res.json({ success: true, data: safeView });
    }

    // 기존 API 호환: contract(단수) 필드로 활성 계약 1건 제공
    const anyCr: any = careRequest;
    anyCr.contract = anyCr.contracts?.[0] || null;

    // 지원자별 매칭 점수 붙이기 (MatchScore는 careRequestId + caregiverId 기준)
    // MatchScore 레코드 없으면 지원자 정보 기반 즉시 계산 (fallback)
    const scoresByCaregiver = new Map<string, any>();
    for (const s of (anyCr.matchScores || [])) {
      scoresByCaregiver.set(s.caregiverId, s);
    }

    // fallback 계산에 필요한 지원자들의 caregiver 상세 조회
    const needsFallback = (anyCr.applications || []).filter(
      (app: any) => !scoresByCaregiver.has(app.caregiverId)
    );
    if (needsFallback.length > 0) {
      const fallbackCaregivers = await prisma.caregiver.findMany({
        where: { id: { in: needsFallback.map((a: any) => a.caregiverId) } },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          preferredRegions: true,
          experienceYears: true,
          specialties: true,
          avgRating: true,
          totalMatches: true,
          rehireRate: true,
          cancellationRate: true,
          noShowCount: true,
          hasBadge: true,
          workStatus: true,
        },
      });
      const fallbackMap = new Map(fallbackCaregivers.map((c) => [c.id, c]));
      const patient = anyCr.patient;
      for (const app of needsFallback) {
        const cg = fallbackMap.get(app.caregiverId);
        if (!cg) continue;
        let distanceScore = 15;
        if (anyCr.latitude && anyCr.longitude && cg.latitude && cg.longitude) {
          const dist = calculateDistance(anyCr.latitude, anyCr.longitude, cg.latitude, cg.longitude);
          distanceScore = getDistanceScore(dist);
        }
        // 희망 지역 매칭 보너스 (matchingService 와 동일 정책)
        if (Array.isArray(cg.preferredRegions) && cg.preferredRegions.length > 0) {
          const requestRegions: string[] = Array.isArray(anyCr.regions) ? anyCr.regions : [];
          const regionMatch = cg.preferredRegions.some((cgRegion: string) => {
            if (requestRegions.some((r: string) => r === cgRegion || r.startsWith(`${cgRegion} `) || cgRegion.startsWith(`${r} `))) return true;
            return typeof anyCr.address === 'string' && anyCr.address.includes(cgRegion);
          });
          if (regionMatch) distanceScore = Math.min(30, distanceScore + 5);
        }
        const experienceScore = getExperienceScore(
          cg.experienceYears,
          cg.specialties,
          {
            hasDementia: patient?.hasDementia ?? false,
            hasInfection: patient?.hasInfection ?? false,
            mobilityStatus: patient?.mobilityStatus ?? 'INDEPENDENT',
          }
        );
        const reviewScore = getReviewScore(cg.avgRating, cg.totalMatches);
        const rehireScore = getRehireScore(cg.rehireRate);
        const cancelPenalty = getCancelPenalty(cg.cancellationRate, cg.noShowCount);
        const badgeBonus = cg.hasBadge ? 5 : 0;
        const immediateBonus = cg.workStatus === 'IMMEDIATE' ? 3 : 0;
        const total = Math.max(0, distanceScore + experienceScore + reviewScore + rehireScore + cancelPenalty + badgeBonus + immediateBonus);
        scoresByCaregiver.set(app.caregiverId, {
          caregiverId: cg.id,
          score: total,
          distanceScore,
          experienceScore,
          reviewScore,
          rehireScore,
          cancelPenalty,
        });
      }
    }

    for (const app of (anyCr.applications || [])) {
      const s = scoresByCaregiver.get(app.caregiverId);
      app.matchScore = s ? {
        total: Math.round(s.score * 10) / 10,
        distance: Math.round(s.distanceScore * 10) / 10,
        experience: Math.round(s.experienceScore * 10) / 10,
        review: Math.round(s.reviewScore * 10) / 10,
        rehire: Math.round(s.rehireScore * 10) / 10,
        cancelPenalty: Math.round(s.cancelPenalty * 10) / 10,
      } : null;
    }

    res.json({
      success: true,
      data: careRequest,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /:id - 간병 요청 수정
export const updateCareRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const careRequest = await prisma.careRequest.findFirst({
      where: { id, guardianId: guardian.id },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    if (!['OPEN', 'MATCHING'].includes(careRequest.status)) {
      throw new AppError('현재 상태에서는 수정할 수 없습니다. (OPEN 또는 MATCHING 상태만 수정 가능)', 400);
    }

    const {
      careType,
      scheduleType,
      location,
      hospitalName,
      address,
      latitude,
      longitude,
      startDate,
      endDate,
      durationDays,
      preferredGender,
      preferredNationality,
      specialRequirements,
      dailyRate,
      hourlyRate,
      relationToPatient,
      preferredServices,
      preferredWageType,
      preferredWageAmount,
    } = req.body;

    // 날짜 검증
    if (startDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parsedStartDate = new Date(startDate);
      if (parsedStartDate < today) {
        throw new AppError('시작일은 오늘 이후여야 합니다.', 400);
      }
    }

    if (startDate && endDate) {
      if (new Date(endDate) <= new Date(startDate)) {
        throw new AppError('종료일은 시작일 이후여야 합니다.', 400);
      }
    } else if (endDate && !startDate) {
      // endDate만 변경하는 경우, 기존 startDate와 비교
      if (new Date(endDate) <= new Date(careRequest.startDate)) {
        throw new AppError('종료일은 시작일 이후여야 합니다.', 400);
      }
    }

    // Normalize enum values for updates
    const careTypeMap: Record<string, string> = {
      hospital: 'INDIVIDUAL', home: 'FAMILY', visit: 'INDIVIDUAL', daily: 'INDIVIDUAL',
      individual: 'INDIVIDUAL', family: 'FAMILY',
    };
    const scheduleTypeMap: Record<string, string> = {
      '24h': 'FULL_TIME', hourly: 'PART_TIME', parttime: 'PART_TIME',
      full_time: 'FULL_TIME', part_time: 'PART_TIME',
    };
    const locationMap: Record<string, string> = {
      hospital: 'HOSPITAL', home: 'HOME',
    };
    const genderMap: Record<string, string> = { male: 'M', female: 'F', m: 'M', f: 'F', '남성': 'M', '여성': 'F' };

    const resolvedCareType = careType !== undefined ? (careTypeMap[careType?.toLowerCase()] || careType?.toUpperCase()) : undefined;
    const resolvedScheduleType = scheduleType !== undefined ? (scheduleTypeMap[scheduleType?.toLowerCase()] || scheduleType?.toUpperCase()) : undefined;
    const resolvedLocation = location !== undefined ? (locationMap[location?.toLowerCase()] || location?.toUpperCase()) : undefined;
    const resolvedPreferredGender = preferredGender !== undefined ? (preferredGender ? (genderMap[preferredGender?.toLowerCase()] || preferredGender) : preferredGender) : undefined;

    // 신규 필드 검증/정규화 (create 와 동일 정책)
    const VALID_WAGE_TYPES_U = ['MONTHLY_24H', 'MONTHLY_12H', 'MONTHLY_1H'];
    const VALID_PREFERRED_SERVICES_U = ['EXERCISE', 'COMPANION', 'TIDY', 'MEDICATION'];
    let resolvedUpdateWageType: string | null | undefined = undefined;
    if (preferredWageType !== undefined) {
      if (!preferredWageType) {
        resolvedUpdateWageType = null;
      } else {
        if (!VALID_WAGE_TYPES_U.includes(preferredWageType)) {
          throw new AppError('희망 급여 형태가 올바르지 않습니다.', 400);
        }
        resolvedUpdateWageType = preferredWageType;
      }
    }
    let resolvedUpdateWageAmount: number | null | undefined = undefined;
    if (preferredWageAmount !== undefined) {
      if (preferredWageAmount === null || preferredWageAmount === '') {
        resolvedUpdateWageAmount = null;
      } else {
        const n = Number(preferredWageAmount);
        if (!Number.isFinite(n) || n < 0) {
          throw new AppError('희망 급여 금액이 올바르지 않습니다.', 400);
        }
        resolvedUpdateWageAmount = Math.floor(n);
      }
    }
    const resolvedUpdateServices = preferredServices !== undefined
      ? (Array.isArray(preferredServices)
          ? preferredServices.filter((s: any) => typeof s === 'string' && VALID_PREFERRED_SERVICES_U.includes(s))
          : [])
      : undefined;

    const updated = await prisma.careRequest.update({
      where: { id },
      data: {
        ...(resolvedCareType !== undefined && { careType: resolvedCareType as any }),
        ...(resolvedScheduleType !== undefined && { scheduleType: resolvedScheduleType as any }),
        ...(resolvedLocation !== undefined && { location: resolvedLocation as any }),
        ...(hospitalName !== undefined && { hospitalName }),
        ...(address !== undefined && { address }),
        ...(req.body.region !== undefined && { region: req.body.region }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(durationDays !== undefined && { durationDays: parseInt(durationDays) }),
        ...(resolvedPreferredGender !== undefined && { preferredGender: resolvedPreferredGender }),
        ...(preferredNationality !== undefined && { preferredNationality }),
        ...(specialRequirements !== undefined && { specialRequirements }),
        ...(dailyRate !== undefined && { dailyRate: parseInt(dailyRate) }),
        ...(hourlyRate !== undefined && { hourlyRate: parseInt(hourlyRate) }),
        ...(relationToPatient !== undefined && { relationToPatient: relationToPatient || null }),
        ...(resolvedUpdateServices !== undefined && { preferredServices: resolvedUpdateServices }),
        ...(resolvedUpdateWageType !== undefined && { preferredWageType: resolvedUpdateWageType }),
        ...(resolvedUpdateWageAmount !== undefined && { preferredWageAmount: resolvedUpdateWageAmount }),
        ...(Array.isArray(req.body.regions) && { regions: req.body.regions }),
      },
      include: {
        patient: true,
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

// POST /:id/apply - 간병인 지원 (인드라이브 방식)
export const applyToCareRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: careRequestId } = req.params;
    const { message, proposedRate, isAccepted } = req.body;

    // 간병인 확인 (ADMIN은 caregiverId를 body로 받아서 대리 지원 가능)
    let caregiver;
    if (req.user!.role === 'ADMIN' && req.body.caregiverId) {
      caregiver = await prisma.caregiver.findUnique({
        where: { id: req.body.caregiverId },
        include: { user: { select: { name: true } } },
      });
    } else {
      caregiver = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
        include: { user: { select: { name: true } } },
      });
    }

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    if (req.user!.role !== 'ADMIN') {
      if (caregiver.status !== 'APPROVED') {
        throw new AppError('승인된 간병인만 지원할 수 있습니다.', 403);
      }
      // 필수 서류 등록 여부 확인 — 신분증 + 범죄이력 조회서
      if (!caregiver.identityVerified || !caregiver.idCardImage) {
        throw new AppError('신분증 등록 및 본인 인증이 완료된 후 지원 가능합니다.', 403);
      }
      if (!caregiver.criminalCheckDone || !caregiver.criminalCheckDoc) {
        throw new AppError('범죄이력 조회서 등록이 완료된 후 지원 가능합니다.', 403);
      }
      // workStatus 는 캐시 — 실제 진행 중 계약 존재 여부로 판정 (단일 진실 원천)
      const ongoingContracts = await prisma.contract.count({
        where: {
          caregiverId: caregiver.id,
          status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] },
        },
      });
      if (ongoingContracts > 0) {
        throw new AppError('현재 진행 중인 계약이 있어 새로운 지원을 할 수 없습니다.', 400);
      }
      // 다른 요청에 PENDING/ACCEPTED 지원이 있으면 동시 지원 차단
      const activeApplications = await prisma.careApplication.count({
        where: {
          caregiverId: caregiver.id,
          status: { in: ['PENDING', 'ACCEPTED'] },
          careRequestId: { not: careRequestId },
        },
      });
      if (activeApplications > 0) {
        throw new AppError('이미 다른 간병 요청에 지원 중입니다. 먼저 해당 지원을 정리해주세요.', 409);
      }
    }

    // 간병 요청 확인
    const careRequest = await prisma.careRequest.findUnique({
      where: { id: careRequestId },
      include: { patient: true },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    if (!['OPEN', 'MATCHING'].includes(careRequest.status)) {
      throw new AppError('현재 지원이 불가능한 상태입니다.', 400);
    }

    // 차단 검증: 보호자가 이 간병인을 차단했거나 간병인이 보호자를 차단한 경우 지원 불가
    if (req.user!.role !== 'ADMIN') {
      const guardianForBlock = await prisma.guardian.findUnique({
        where: { id: careRequest.guardianId },
        select: { userId: true },
      });
      if (guardianForBlock) {
        const blocked = await prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerId: guardianForBlock.userId, blockedId: caregiver.userId },
              { blockerId: caregiver.userId, blockedId: guardianForBlock.userId },
            ],
          },
        });
        if (blocked) {
          throw new AppError('차단된 사용자와는 매칭이 불가능합니다.', 403);
        }
      }
    }

    // 중복 지원 확인 — PENDING/ACCEPTED 상태만 차단
    // REJECTED/CANCELLED 된 경우 재지원 허용
    const existingApplication = await prisma.careApplication.findUnique({
      where: {
        careRequestId_caregiverId: {
          careRequestId,
          caregiverId: caregiver.id,
        },
      },
    });

    if (existingApplication) {
      if (['PENDING', 'ACCEPTED'].includes(existingApplication.status)) {
        throw new AppError('이미 지원한 간병 요청입니다.', 400);
      }
      // REJECTED/CANCELLED → 기존 레코드 삭제 후 재지원 허용
      await prisma.careApplication.delete({
        where: { id: existingApplication.id },
      });
    }

    // isAccepted가 true이면 보호자 금액 수락 → proposedRate null
    // isAccepted가 false이면 proposedRate 필수
    let finalProposedRate: number | null = null;
    let finalIsAccepted = false;

    if (isAccepted) {
      finalIsAccepted = true;
      finalProposedRate = null;
    } else {
      if (proposedRate === undefined || proposedRate === null) {
        throw new AppError('제안 금액을 입력해주세요.', 400);
      }
      if (typeof proposedRate !== 'number' || proposedRate <= 0) {
        throw new AppError('제안 금액은 0보다 커야 합니다.', 400);
      }
      finalProposedRate = proposedRate;
      finalIsAccepted = false;
    }

    const application = await prisma.careApplication.create({
      data: {
        careRequestId,
        caregiverId: caregiver.id,
        message: message || null,
        proposedRate: finalProposedRate,
        isAccepted: finalIsAccepted,
      },
      include: {
        caregiver: {
          include: {
            user: {
              select: { name: true, profileImage: true },
            },
          },
        },
      },
    });

    // 보호자에게 알림
    const guardian = await prisma.guardian.findUnique({
      where: { id: careRequest.guardianId },
    });

    if (guardian) {
      // 보호자에게 새 지원자 알림 (템플릿 기반)
      const patientName = caregiver.user?.name || '간병인';
      await sendFromTemplate({
        userId: guardian.userId,
        key: 'APPLICATION_GUARDIAN_NEW',
        vars: { patientName },
        data: { careRequestId, applicationId: application.id },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

// POST /:id/raise-rate - 금액 인상 재공고
export const raiseRate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newDailyRate } = req.body;

    if (!newDailyRate || typeof newDailyRate !== 'number' || newDailyRate <= 0) {
      throw new AppError('새 일당을 올바르게 입력해주세요.', 400);
    }

    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const careRequest = await prisma.careRequest.findFirst({
      where: { id, guardianId: guardian.id },
      include: {
        matchScores: {
          include: {
            careRequest: false,
          },
        },
      },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    if (!['OPEN', 'MATCHING'].includes(careRequest.status)) {
      throw new AppError('현재 상태에서는 금액을 인상할 수 없습니다. (OPEN 또는 MATCHING 상태만 가능)', 400);
    }

    const currentRate = careRequest.dailyRate;
    if (currentRate != null && newDailyRate <= currentRate) {
      throw new AppError(`새 일당은 현재 일당(${(currentRate ?? 0).toLocaleString()}원)보다 높아야 합니다.`, 400);
    }

    // 금액 인상 — CAS 패턴: 같은 currentRate 일 때만 update 적용 (NULL 도 동일하게 매칭)
    const cas = await prisma.careRequest.updateMany({
      where: { id, dailyRate: currentRate ?? null },
      data: { dailyRate: newDailyRate },
    });
    if (cas.count !== 1) {
      throw new AppError('금액이 이미 다른 요청으로 변경되었습니다. 새로고침 후 다시 시도해주세요.', 409);
    }

    // 매칭 점수가 있는 간병인들에게 푸시+알림 발송 (템플릿 기반)
    const matchedCaregiverIds = careRequest.matchScores.map((ms) => ms.caregiverId);
    if (matchedCaregiverIds.length > 0) {
      const caregivers = await prisma.caregiver.findMany({
        where: { id: { in: matchedCaregiverIds } },
        select: { userId: true },
      });
      await Promise.all(
        caregivers.map((cg) =>
          sendFromTemplate({
            userId: cg.userId,
            key: 'MATCHING_RATE_RAISED',
            vars: {
              currentRate: (currentRate ?? 0).toLocaleString(),
              newRate: newDailyRate.toLocaleString(),
            },
            fallbackTitle: '간병 요청 금액 인상',
            fallbackBody: `일당이 ${(currentRate ?? 0).toLocaleString()}원 → ${newDailyRate.toLocaleString()}원으로 인상되었습니다`,
            fallbackType: 'MATCHING',
            data: { careRequestId: id },
          }).catch(() => {}),
        ),
      );
    }

    const updated = await prisma.careRequest.findUnique({
      where: { id },
      include: { patient: true },
    });

    res.json({
      success: true,
      data: updated,
      message: `일당이 ${(currentRate ?? 0).toLocaleString()}원에서 ${newDailyRate.toLocaleString()}원으로 인상되었습니다.`,
      previousRate: currentRate,
      newRate: newDailyRate,
    });
  } catch (error) {
    next(error);
  }
};

// POST /:id/expand-regions - 지역 범위 확장 재공고
export const expandRegions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { regions } = req.body;

    if (!Array.isArray(regions) || regions.length === 0) {
      throw new AppError('추가할 지역을 한 개 이상 선택해주세요.', 400);
    }

    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });
    if (!guardian) throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);

    // 트랜잭션 안에서 SELECT FOR UPDATE → 병합 → UPDATE 로 동시 확장 race 차단
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string; regions: string[] }>>`
        SELECT id, status, regions FROM "CareRequest" WHERE id = ${id} AND "guardianId" = ${guardian.id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
      const cur = locked[0];
      if (!['OPEN', 'MATCHING'].includes(cur.status)) {
        throw new AppError('현재 상태에서는 지역을 확장할 수 없습니다.', 400);
      }
      const existingRegions = Array.isArray(cur.regions) ? cur.regions : [];
      const merged = Array.from(new Set([...existingRegions, ...regions]));
      const updated = await tx.careRequest.update({
        where: { id },
        data: { regions: merged },
      });
      return { updated, existingRegions };
    });
    const careRequest = { regions: result.existingRegions };
    const updated = result.updated;

    // 추가된 지역의 간병인에게 알림
    // — caregiver의 preferredRegions가 "서울"(시·도)만 등록됐어도, 새 지역이 "서울 강남구"면 매칭되도록
    //   시·도 prefix까지 확장한 매칭 키 집합을 사용
    const addedRegions = regions.filter((r: string) => !(careRequest.regions || []).includes(r));
    if (addedRegions.length > 0) {
      const matchKeys = new Set<string>();
      for (const r of addedRegions) {
        const trimmed = String(r).trim();
        if (!trimmed) continue;
        matchKeys.add(trimmed);
        const sido = trimmed.split(/\s+/)[0];
        if (sido && sido !== trimmed) matchKeys.add(sido);
      }
      const caregivers = await prisma.caregiver.findMany({
        where: {
          status: 'APPROVED',
          preferredRegions: { hasSome: Array.from(matchKeys) },
        },
        select: { userId: true },
      });
      if (caregivers.length > 0) {
        await prisma.notification.createMany({
          data: caregivers.map((cg) => ({
            userId: cg.userId,
            type: 'MATCHING' as const,
            title: '새 간병 요청',
            body: `선호 지역(${addedRegions.join(', ')})에 새 간병 요청이 있습니다.`,
            data: { careRequestId: id },
          })),
        });
      }
    }

    res.json({
      success: true,
      data: updated,
      message: `지역이 확장되었습니다 (${((updated as any).regions || []).join(', ')})`,
      addedRegions,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /:id - 간병 요청 취소
export const cancelCareRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
    });

    if (!guardian) {
      throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);
    }

    const careRequest = await prisma.careRequest.findFirst({
      where: { id, guardianId: guardian.id },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    if (['COMPLETED', 'CANCELLED'].includes(careRequest.status)) {
      throw new AppError('이미 완료되었거나 취소된 요청입니다.', 400);
    }

    // 진행 중인 계약이 있는지 확인
    if (careRequest.status === 'IN_PROGRESS') {
      throw new AppError('간병이 진행 중인 요청은 직접 취소할 수 없습니다. 계약 취소를 먼저 진행해주세요.', 400);
    }

    // 요청 취소 및 관련 지원 취소 처리
    await prisma.$transaction([
      prisma.careRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      prisma.careApplication.updateMany({
        where: { careRequestId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      }),
    ]);

    res.json({
      success: true,
      message: '간병 요청이 취소되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /region-stats - 지역별 오픈 요청 수
export const getRegionStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.careRequest.groupBy({
      by: ['region'],
      where: { status: 'OPEN', region: { not: null } },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const s of stats) {
      if (s.region) result[s.region] = s._count.id;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// DELETE /:id/apply - 간병인 본인 지원 취소 (보호자가 선택 전까지만)
export const cancelApplication = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: careRequestId } = req.params;

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });
    if (!caregiver) throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);

    const application = await prisma.careApplication.findUnique({
      where: {
        careRequestId_caregiverId: {
          careRequestId,
          caregiverId: caregiver.id,
        },
      },
    });
    if (!application) throw new AppError('지원 내역을 찾을 수 없습니다.', 404);
    if (application.status !== 'PENDING') {
      throw new AppError('보호자가 이미 처리한 지원은 취소할 수 없습니다.', 400);
    }

    await prisma.careApplication.update({
      where: { id: application.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, message: '지원이 취소되었습니다.' });
  } catch (error) {
    next(error);
  }
};
