import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
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

    // 간병시간 자동 계산 (체크인~체크아웃 시간차, 소수점 1자리)
    const autoHours = record.checkInTime
      ? Math.round(((now.getTime() - record.checkInTime.getTime()) / (1000 * 60 * 60)) * 10) / 10
      : null;

    const updated = await prisma.careRecord.update({
      where: { id: record.id },
      data: {
        checkOutTime: now,
        // 수동 입력한 간병시간 없을 때만 자동 설정
        ...(record.careHours == null && autoHours != null ? { careHours: autoHours } : {}),
      },
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
      careHours,
      mealCare,
      activityCare,
      excretionCare,
      hygieneCare,
      otherCare,
      otherCareNote,
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
      careHours: careHours !== undefined && careHours !== null && careHours !== ''
        ? parseFloat(careHours)
        : null,
      mealCare: !!mealCare,
      activityCare: !!activityCare,
      excretionCare: !!excretionCare,
      hygieneCare: !!hygieneCare,
      otherCare: !!otherCare,
      otherCareNote: otherCare ? (otherCareNote || null) : null,
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

// GET /care-records/:contractId/pdf - 보험사 제출용 간병일지 PDF 생성
const FONT_REGULAR = '/usr/share/fonts/truetype/nanum/NanumGothic.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf';

export const generateCareRecordPdf = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        careRequest: { include: { patient: true } },
        caregiver: { include: { user: true } },
        guardian: { include: { user: true } },
      },
    });

    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);

    // 권한 검사: 관련자만 조회 가능
    const userId = req.user!.id;
    const role = req.user!.role;
    const isRelated =
      role === 'ADMIN' ||
      contract.guardian.userId === userId ||
      contract.caregiver.userId === userId;
    if (!isRelated) throw new AppError('조회 권한이 없습니다.', 403);

    const records = await prisma.careRecord.findMany({
      where: { contractId },
      orderBy: { date: 'asc' },
    });

    // PDF 생성
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filename = `care-journal-${contract.careRequest.patient.name}-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    doc.pipe(res);

    // 한글 폰트 등록
    if (fs.existsSync(FONT_REGULAR)) doc.registerFont('Kor', FONT_REGULAR);
    if (fs.existsSync(FONT_BOLD)) doc.registerFont('KorBold', FONT_BOLD);
    doc.font('Kor');

    // ============ 제목 ============
    doc.fontSize(22).font('KorBold').text('간 병 일 지', { align: 'center' });
    doc.moveDown(0.5);

    // ============ 환자/간병인 상단 정보 ============
    const startY = doc.y + 10;
    const tableLeft = 40;
    const tableWidth = 515;
    const col1W = 90, col2W = 170, col3W = 90, col4W = 165;
    const rowH = 24;

    const drawCell = (x: number, y: number, w: number, h: number, text: string, opts: { bold?: boolean; bg?: string; align?: 'center' | 'left' } = {}) => {
      if (opts.bg) doc.rect(x, y, w, h).fill(opts.bg).stroke('#d0d0d0');
      else doc.rect(x, y, w, h).stroke('#d0d0d0');
      doc.fillColor('#000').font(opts.bold ? 'KorBold' : 'Kor').fontSize(10)
        .text(text, x + 5, y + 7, { width: w - 10, align: opts.align || 'left' });
    };

    const patient = contract.careRequest.patient;
    const caregiver = contract.caregiver;
    const caregiverUser = caregiver.user;

    const info = [
      ['환자명', patient.name || '-', '성별', patient.gender === 'M' ? '남' : (patient.gender === 'F' ? '여' : '-')],
      ['생년월일', patient.birthDate ? new Date(patient.birthDate).toISOString().slice(0, 10) : '-', '병원명', contract.careRequest.hospitalName || contract.careRequest.address || '-'],
      ['간병시작일자', contract.startDate ? new Date(contract.startDate).toISOString().slice(0, 10) : '-', '간병기간', contract.careRequest.durationDays ? `${contract.careRequest.durationDays}일` : '-'],
      ['간병인 성명', caregiverUser?.name || '-', '간병인 연락처', caregiverUser?.phone || '-'],
      ['간병인 사용 법인명', '케어매치 주식회사', '사업자등록번호', '173-81-03376'],
    ];

    let y = startY;
    info.forEach((row) => {
      drawCell(tableLeft, y, col1W, rowH, row[0], { bold: true, bg: '#fbe4cd' });
      drawCell(tableLeft + col1W, y, col2W, rowH, row[1]);
      drawCell(tableLeft + col1W + col2W, y, col3W, rowH, row[2], { bold: true, bg: '#fbe4cd' });
      drawCell(tableLeft + col1W + col2W + col3W, y, col4W, rowH, row[3]);
      y += rowH;
    });

    // 안내문
    y += 15;
    doc.font('Kor').fontSize(9).fillColor('#555')
      .text('※ 본 간병일지 양식은 케어매치㈜ 자사 양식으로, 보험사에 따라 자사양식으로 대체가 불가능할 수 있음을 알려드립니다.',
        tableLeft, y, { width: tableWidth, align: 'center' });
    y += 25;

    // ============ 일자별 테이블 ============
    const dateW = 80, timeW = 90, taskW = tableWidth - dateW - timeW;

    // 헤더
    drawCell(tableLeft, y, dateW, rowH, '간병일자', { bold: true, bg: '#fbe4cd', align: 'center' });
    drawCell(tableLeft + dateW, y, timeW, rowH, '간병시간', { bold: true, bg: '#fbe4cd', align: 'center' });
    drawCell(tableLeft + dateW + timeW, y, taskW, rowH, '간병 업무', { bold: true, bg: '#fbe4cd', align: 'center' });
    y += rowH;

    // 데이터 행 (최대 10일치, 빈 행도 포함)
    const displayRows = Math.max(records.length, 10);
    for (let i = 0; i < displayRows; i++) {
      const r = records[i];

      // 페이지 넘김
      if (y + rowH > 800) {
        doc.addPage();
        y = 50;
      }

      const dateStr = r?.date ? new Date(r.date).toISOString().slice(5, 10).replace('-', '/') : '';
      const hoursStr = r?.careHours ? `${r.careHours} 시간` : (r ? '       시간' : '       시간');

      drawCell(tableLeft, y, dateW, rowH, dateStr, { align: 'center' });
      drawCell(tableLeft + dateW, y, timeW, rowH, hoursStr, { align: 'center' });

      // 업무 체크박스 표시
      let taskText = '';
      if (r) {
        const mark = (v: boolean) => (v ? '☑' : '☐');
        taskText = `${mark(r.mealCare)} 식사보조  ${mark(r.activityCare)} 활동보조  ${mark(r.excretionCare)} 배변보조  ${mark(r.hygieneCare)} 위생보조  ${mark(r.otherCare)} 기타`;
      } else {
        taskText = '☐ 식사보조  ☐ 활동보조  ☐ 배변보조  ☐ 위생보조  ☐ 기타';
      }
      drawCell(tableLeft + dateW + timeW, y, taskW, rowH, taskText);
      y += rowH;
    }

    // ============ 하단 서명 ============
    y += 20;
    if (y + 80 > 800) {
      doc.addPage();
      y = 50;
    }
    doc.font('KorBold').fontSize(11).fillColor('#000')
      .text('상기와 같이 간병인을 사용하였음을 확인합니다.', tableLeft, y);
    y += 20;

    const signColW = [100, 160, 100, 155];
    const signRowH = 28;

    drawCell(tableLeft, y, signColW[0], signRowH, '간병인명', { bold: true, bg: '#fbe4cd', align: 'center' });
    drawCell(tableLeft + signColW[0], y, signColW[1], signRowH, `${caregiverUser?.name || ''}          (인)`);
    drawCell(tableLeft + signColW[0] + signColW[1], y, signColW[2], signRowH, '소송회사명', { bold: true, bg: '#fbe4cd', align: 'center' });
    drawCell(tableLeft + signColW[0] + signColW[1] + signColW[2], y, signColW[3], signRowH, '케어매치 주식회사', { align: 'center' });
    y += signRowH;

    const today = new Date();
    drawCell(tableLeft, y, signColW[0], signRowH, '사업자등록번호', { bold: true, bg: '#fbe4cd', align: 'center' });
    drawCell(tableLeft + signColW[0], y, signColW[1], signRowH, '173-81-03376', { align: 'center' });
    drawCell(tableLeft + signColW[0] + signColW[1], y, signColW[2], signRowH, '작성일', { bold: true, bg: '#fbe4cd', align: 'center' });
    drawCell(tableLeft + signColW[0] + signColW[1] + signColW[2], y, signColW[3], signRowH,
      `${today.getFullYear()}년  ${today.getMonth() + 1}월  ${today.getDate()}일`, { align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
};
