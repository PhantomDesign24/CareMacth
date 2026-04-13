import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// POST /check-in - 출근 체크
export const checkIn = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const { contractId, latitude, longitude } = req.body;

    if (!contractId) {
      throw new AppError('계약 ID가 필요합니다.', 400);
    }

    // 계약 확인
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        caregiverId: caregiver.id,
        status: { in: ['ACTIVE', 'EXTENDED'] },
      },
    });

    if (!contract) {
      throw new AppError('유효한 계약을 찾을 수 없습니다.', 404);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘 이미 출근했는지 확인
    const existingRecord = await prisma.careRecord.findFirst({
      where: {
        contractId,
        caregiverId: caregiver.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 86400000),
        },
      },
    });

    if (existingRecord?.checkInTime) {
      throw new AppError('이미 오늘 출근 체크를 했습니다.', 400);
    }

    const now = new Date();

    let record;
    if (existingRecord) {
      // 기존 레코드에 출근 시간 업데이트
      record = await prisma.careRecord.update({
        where: { id: existingRecord.id },
        data: {
          checkInTime: now,
          checkInLat: latitude ? parseFloat(latitude) : null,
          checkInLng: longitude ? parseFloat(longitude) : null,
        },
      });
    } else {
      // 새 레코드 생성
      record = await prisma.careRecord.create({
        data: {
          contractId,
          caregiverId: caregiver.id,
          date: today,
          checkInTime: now,
          checkInLat: latitude ? parseFloat(latitude) : null,
          checkInLng: longitude ? parseFloat(longitude) : null,
        },
      });
    }

    // 보호자에게 알림
    const guardian = await prisma.guardian.findUnique({
      where: { id: contract.guardianId },
    });

    if (guardian) {
      await prisma.notification.create({
        data: {
          userId: guardian.userId,
          type: 'CARE_RECORD',
          title: '간병인 출근',
          body: `간병인이 ${now.toLocaleTimeString('ko-KR')}에 출근했습니다.`,
          data: { contractId, recordId: record.id },
        },
      });
    }

    res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// POST /check-out - 퇴근 체크
export const checkOut = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const { contractId } = req.body;

    if (!contractId) {
      throw new AppError('계약 ID가 필요합니다.', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘 출근 기록 확인
    const record = await prisma.careRecord.findFirst({
      where: {
        contractId,
        caregiverId: caregiver.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 86400000),
        },
        checkInTime: { not: null },
      },
    });

    if (!record) {
      throw new AppError('오늘 출근 기록이 없습니다. 먼저 출근 체크를 해주세요.', 400);
    }

    if (record.checkOutTime) {
      throw new AppError('이미 퇴근 체크를 했습니다.', 400);
    }

    const now = new Date();

    const updated = await prisma.careRecord.update({
      where: { id: record.id },
      data: { checkOutTime: now },
    });

    // 보호자에게 알림
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (contract) {
      const guardian = await prisma.guardian.findUnique({
        where: { id: contract.guardianId },
      });

      if (guardian) {
        await prisma.notification.create({
          data: {
            userId: guardian.userId,
            type: 'CARE_RECORD',
            title: '간병인 퇴근',
            body: `간병인이 ${now.toLocaleTimeString('ko-KR')}에 퇴근했습니다.`,
            data: { contractId, recordId: record.id },
          },
        });
      }
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// POST /daily-log - 간병 일지 작성
export const createDailyLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      contractId,
      bodyTemp,
      bloodPressure,
      pulse,
      meals,
      medication,
      excretion,
      sleep,
      mobility,
      mentalState,
      skinState,
      notes,
      photos,
    } = req.body;

    if (!contractId) {
      throw new AppError('계약 ID가 필요합니다.', 400);
    }

    // 계약 확인
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        caregiverId: caregiver.id,
        status: { in: ['ACTIVE', 'EXTENDED'] },
      },
    });

    if (!contract) {
      throw new AppError('유효한 계약을 찾을 수 없습니다.', 404);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘의 기록 찾기 또는 생성
    let record = await prisma.careRecord.findFirst({
      where: {
        contractId,
        caregiverId: caregiver.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 86400000),
        },
      },
    });

    const logData = {
      bodyTemp: bodyTemp ? parseFloat(bodyTemp) : null,
      bloodPressure: bloodPressure || null,
      pulse: pulse ? parseInt(pulse) : null,
      meals: meals || null,
      medication: medication || null,
      excretion: excretion || null,
      sleep: sleep || null,
      mobility: mobility || null,
      mentalState: mentalState || null,
      skinState: skinState || null,
      notes: notes || null,
      photos: photos || [],
    };

    if (record) {
      record = await prisma.careRecord.update({
        where: { id: record.id },
        data: logData,
      });
    } else {
      record = await prisma.careRecord.create({
        data: {
          contractId,
          caregiverId: caregiver.id,
          date: today,
          ...logData,
        },
      });
    }

    // 보호자에게 알림
    const guardian = await prisma.guardian.findUnique({
      where: { id: contract.guardianId },
    });

    if (guardian) {
      await prisma.notification.create({
        data: {
          userId: guardian.userId,
          type: 'CARE_RECORD',
          title: '간병 일지 작성',
          body: '오늘의 간병 일지가 작성되었습니다. 확인해 주세요.',
          data: { contractId, recordId: record.id },
        },
      });
    }

    res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// POST /photos - 간병 기록 사진 업로드
export const uploadPhotos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId, recordId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError('업로드할 사진이 없습니다.', 400);
    }

    if (!contractId || !recordId) {
      throw new AppError('계약 ID와 기록 ID가 필요합니다.', 400);
    }

    // 간병인 본인 계약 확인
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });
    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const record = await prisma.careRecord.findFirst({
      where: { id: recordId, contractId, caregiverId: caregiver.id },
    });
    if (!record) {
      throw new AppError('간병 기록을 찾을 수 없습니다.', 404);
    }

    // 파일 경로를 photos 배열에 추가
    const photoUrls = files.map((f) => `/uploads/${f.filename}`);
    const updatedPhotos = [...record.photos, ...photoUrls];

    await prisma.careRecord.update({
      where: { id: recordId },
      data: { photos: updatedPhotos },
    });

    res.json({
      success: true,
      data: { photos: updatedPhotos },
    });
  } catch (error) {
    next(error);
  }
};

// GET /:contractId - 간병 기록 조회
export const getCareRecords = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new AppError('계약을 찾을 수 없습니다.', 404);
    }

    // 접근 권한 확인
    if (req.user!.role === 'GUARDIAN') {
      const guardian = await prisma.guardian.findUnique({
        where: { userId: req.user!.id },
      });
      if (!guardian || contract.guardianId !== guardian.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    } else if (req.user!.role === 'CAREGIVER') {
      const caregiver = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });
      if (!caregiver || contract.caregiverId !== caregiver.id) {
        throw new AppError('접근 권한이 없습니다.', 403);
      }
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip = (page - 1) * limit;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const where: any = { contractId };
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      prisma.careRecord.findMany({
        where,
        include: {
          caregiver: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.careRecord.count({ where }),
    ]);

    // 출근/퇴근 통계
    const attendanceStats = await prisma.careRecord.aggregate({
      where: { contractId, checkInTime: { not: null } },
      _count: { checkInTime: true, checkOutTime: true },
    });

    res.json({
      success: true,
      data: {
        records,
        attendanceStats: {
          totalCheckIns: attendanceStats._count.checkInTime,
          totalCheckOuts: attendanceStats._count.checkOutTime,
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
