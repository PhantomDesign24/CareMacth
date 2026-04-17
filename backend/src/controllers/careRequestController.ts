import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// POST / - 간병 요청 생성
export const createCareRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // 중복 방지: 같은 환자로 OPEN 상태인 간병 요청이 이미 있으면 차단
    const existingOpenRequest = await prisma.careRequest.findFirst({
      where: {
        guardianId: guardian.id,
        patientId,
        status: { in: ['OPEN', 'MATCHED'] },
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

    const careRequest = await prisma.careRequest.create({
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
      },
      include: {
        patient: true,
      },
    });

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
      whereClause.status = status || 'OPEN';

      // 선택 없으면 선호지역 자동 적용 (간병인만)
      if (!req.query.regions) {
        const caregiver = await prisma.caregiver.findUnique({
          where: { userId: req.user!.id },
          select: { preferredRegions: true },
        });
        if (caregiver && caregiver.preferredRegions.length > 0) {
          whereClause.OR = [
            { region: { in: caregiver.preferredRegions } },
            { regions: { hasSome: caregiver.preferredRegions } },
          ];
        }
      }
    } else if (req.user!.role === 'ADMIN') {
      if (status) {
        whereClause.status = status;
      }
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

    res.json({
      success: true,
      data: {
        careRequests,
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
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        matchScores: {
          orderBy: { score: 'desc' },
          take: 20,
        },
        contract: true,
      },
    });

    if (!careRequest) {
      throw new AppError('간병 요청을 찾을 수 없습니다.', 404);
    }

    // 보호자인 경우 본인 요청인지 확인
    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || careRequest.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
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

    if (req.user!.role !== 'ADMIN' && caregiver.status !== 'APPROVED') {
      throw new AppError('승인된 간병인만 지원할 수 있습니다.', 403);
    }

    if (req.user!.role !== 'ADMIN' && caregiver.workStatus === 'WORKING') {
      throw new AppError('현재 간병 진행 중에는 새로운 지원을 할 수 없습니다.', 400);
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
      const notifBody = finalIsAccepted
        ? `${caregiver.user?.name || '간병인'}님이 제시 금액을 수락하고 지원했습니다.`
        : `${caregiver.user?.name || '간병인'}님이 일당 ${finalProposedRate?.toLocaleString()}원을 제안했습니다.`;

      await prisma.notification.create({
        data: {
          userId: guardian.userId,
          type: 'APPLICATION',
          title: '새로운 간병인 지원',
          body: notifBody,
          data: { careRequestId, applicationId: application.id },
        },
      });
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

    const currentRate = careRequest.dailyRate || 0;
    if (newDailyRate <= currentRate) {
      throw new AppError(`새 일당은 현재 일당(${currentRate.toLocaleString()}원)보다 높아야 합니다.`, 400);
    }

    // 금액 인상 및 매칭된 간병인들에게 알림 발송
    await prisma.$transaction(async (tx) => {
      // 일당 업데이트
      await tx.careRequest.update({
        where: { id },
        data: { dailyRate: newDailyRate },
      });

      // 매칭 점수가 있는 간병인들에게 알림 발송
      const matchedCaregiverIds = careRequest.matchScores.map((ms) => ms.caregiverId);

      if (matchedCaregiverIds.length > 0) {
        const caregivers = await tx.caregiver.findMany({
          where: { id: { in: matchedCaregiverIds } },
          select: { userId: true },
        });

        const notifications = caregivers.map((cg) => ({
          userId: cg.userId,
          type: 'MATCHING' as const,
          title: '간병 요청 금액 인상',
          body: `일당이 ${currentRate.toLocaleString()}원 → ${newDailyRate.toLocaleString()}원으로 인상되었습니다`,
          data: { careRequestId: id },
        }));

        if (notifications.length > 0) {
          await tx.notification.createMany({ data: notifications });
        }
      }
    });

    const updated = await prisma.careRequest.findUnique({
      where: { id },
      include: { patient: true },
    });

    res.json({
      success: true,
      data: updated,
      message: `일당이 ${currentRate.toLocaleString()}원에서 ${newDailyRate.toLocaleString()}원으로 인상되었습니다.`,
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

    const careRequest = await prisma.careRequest.findFirst({
      where: { id, guardianId: guardian.id },
    });
    if (!careRequest) throw new AppError('간병 요청을 찾을 수 없습니다.', 404);

    if (!['OPEN', 'MATCHING'].includes(careRequest.status)) {
      throw new AppError('현재 상태에서는 지역을 확장할 수 없습니다.', 400);
    }

    // 기존 regions + 새 regions 병합 (중복 제거)
    const merged = Array.from(new Set([...(careRequest.regions || []), ...regions]));

    const updated = await prisma.careRequest.update({
      where: { id },
      data: { regions: merged },
    });

    // 추가된 지역의 간병인에게 알림
    const addedRegions = regions.filter((r: string) => !(careRequest.regions || []).includes(r));
    if (addedRegions.length > 0) {
      const caregivers = await prisma.caregiver.findMany({
        where: {
          status: 'APPROVED',
          preferredRegions: { hasSome: addedRegions },
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
      message: `지역이 확장되었습니다 (${merged.join(', ')})`,
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
