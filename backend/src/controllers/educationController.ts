import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { prisma } from '../app';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

// GET / - 교육 목록
export const getEducations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const educations = await prisma.education.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    // 수강 기록 조회
    const records = await prisma.educationRecord.findMany({
      where: { caregiverId: caregiver.id },
    });

    const recordMap = new Map(records.map((r) => [r.educationId, r]));

    const educationsWithProgress = educations.map((edu) => {
      const record = recordMap.get(edu.id);
      return {
        ...edu,
        progress: record?.progress ?? 0,
        completed: record?.completed ?? false,
        completedAt: record?.completedAt ?? null,
        certificateUrl: record?.certificateUrl ?? null,
      };
    });

    // 전체 진행률 계산
    const totalEducations = educations.length;
    const completedCount = records.filter((r) => r.completed).length;
    const overallProgress = totalEducations > 0
      ? Math.round((completedCount / totalEducations) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        educations: educationsWithProgress,
        overallProgress,
        completedCount,
        totalEducations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /:id/progress - 수강 진행도 업데이트
export const updateProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { progress } = req.body;

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    // 교육 존재 여부 확인
    const education = await prisma.education.findUnique({
      where: { id },
    });

    if (!education || !education.isActive) {
      throw new AppError('교육을 찾을 수 없습니다.', 404);
    }

    if (progress === undefined || progress < 0 || progress > 100) {
      throw new AppError('진행도는 0~100 사이의 값이어야 합니다.', 400);
    }

    const progressValue = parseFloat(progress);
    const isCompleted = progressValue >= 80; // 80% 이상 수료

    // upsert로 기록 생성 또는 업데이트
    const record = await prisma.educationRecord.upsert({
      where: {
        caregiverId_educationId: {
          caregiverId: caregiver.id,
          educationId: id,
        },
      },
      update: {
        progress: progressValue,
        completed: isCompleted,
        ...(isCompleted && { completedAt: new Date() }),
      },
      create: {
        caregiverId: caregiver.id,
        educationId: id,
        progress: progressValue,
        completed: isCompleted,
        ...(isCompleted && { completedAt: new Date() }),
      },
    });

    // 전체 교육 진행률 업데이트
    const totalEducations = await prisma.education.count({
      where: { isActive: true },
    });

    const completedEducations = await prisma.educationRecord.count({
      where: {
        caregiverId: caregiver.id,
        completed: true,
      },
    });

    const overallProgress = totalEducations > 0
      ? Math.round((completedEducations / totalEducations) * 100)
      : 0;

    const allCompleted = completedEducations === totalEducations && totalEducations > 0;

    await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: {
        educationProgress: overallProgress,
        educationCompleted: allCompleted,
      },
    });

    res.json({
      success: true,
      data: {
        record,
        overallProgress,
        educationCompleted: allCompleted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /certificate/:id - 수료증 발급
export const getCertificate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    if (!caregiver) {
      throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);
    }

    const record = await prisma.educationRecord.findFirst({
      where: {
        educationId: id,
        caregiverId: caregiver.id,
      },
      include: {
        education: true,
      },
    });

    if (!record) {
      throw new AppError('수강 기록을 찾을 수 없습니다.', 404);
    }

    if (!record.completed) {
      throw new AppError('교육을 수료하지 않았습니다. 80% 이상 수강해야 수료증을 발급받을 수 있습니다.', 400);
    }

    // 수료증 URL이 이미 있으면 반환
    if (record.certificateUrl) {
      res.json({
        success: true,
        data: {
          certificateUrl: record.certificateUrl,
          educationTitle: record.education.title,
          completedAt: record.completedAt,
          caregiverName: caregiver.user.name,
        },
      });
      return;
    }

    // 수료증 URL 생성 (실제로는 PDF 생성 서비스 연동)
    const certificateUrl = `/api/education/certificate/${id}/download?caregiverId=${caregiver.id}`;

    await prisma.educationRecord.update({
      where: { id: record.id },
      data: { certificateUrl },
    });

    res.json({
      success: true,
      data: {
        certificateUrl,
        educationTitle: record.education.title,
        completedAt: record.completedAt,
        caregiverName: caregiver.user.name,
      },
    });
  } catch (error) {
    next(error);
  }
};
