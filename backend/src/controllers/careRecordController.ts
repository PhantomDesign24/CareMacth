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
        // 자동 계산값은 매번 덮어씀 (수동 입력값은 careHoursManual로 별도 보관)
        ...(autoHours != null ? { careHours: autoHours } : {}),
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
      date,
      careHoursManual,
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

    // 기록 기준 날짜: 클라이언트가 보낸 date(YYYY-MM-DD) 우선, 없으면 오늘
    const targetDate = date ? new Date(`${date}T00:00:00`) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // 해당 날짜의 기록 찾기 또는 생성
    let record = await prisma.careRecord.findFirst({
      where: {
        contractId,
        caregiverId: caregiver.id,
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 86400000),
        },
      },
    });

    const logData = {
      // careHours는 checkOut 시점에 자동 계산되므로 여기선 건드리지 않음
      careHoursManual:
        careHoursManual !== undefined && careHoursManual !== null && careHoursManual !== ''
          ? parseFloat(careHoursManual)
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
          date: targetDate,
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

    // PDF 생성 (A4, 여백 45pt)
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const filename = `care-journal-${contract.careRequest.patient.name}-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    doc.pipe(res);

    // 한글 폰트 등록
    if (fs.existsSync(FONT_REGULAR)) doc.registerFont('Kor', FONT_REGULAR);
    if (fs.existsSync(FONT_BOLD)) doc.registerFont('KorBold', FONT_BOLD);
    doc.font('Kor');

    // ============ 디자인 상수 ============
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const MARGIN = 45;
    const TABLE_LEFT = MARGIN;
    const TABLE_WIDTH = PAGE_W - MARGIN * 2;
    // 전문적인 다크 네이비 + 그레이 팔레트
    const COLOR_PRIMARY = '#1E3A5F';     // 짙은 네이비 (신뢰감)
    const COLOR_ACCENT = '#2C5282';      // 밝은 네이비
    const COLOR_BORDER = '#CBD5E0';      // 연한 그레이
    const COLOR_HEADER_BG = '#EDF2F7';   // 아주 연한 그레이
    const COLOR_SUB_TEXT = '#4A5568';    // 중간 그레이
    const COLOR_ALT_ROW = '#F7FAFC';     // 얇은 교차 배경

    // 헬퍼: 얇은 테두리 셀
    const drawCell = (
      x: number, y: number, w: number, h: number, text: string,
      opts: { bold?: boolean; bg?: string; align?: 'center' | 'left' | 'right'; size?: number; color?: string; padLeft?: number } = {}
    ) => {
      const bg = opts.bg;
      doc.lineWidth(0.6).strokeColor(COLOR_BORDER);
      if (bg) {
        doc.rect(x, y, w, h).fillAndStroke(bg, COLOR_BORDER);
      } else {
        doc.rect(x, y, w, h).stroke();
      }
      doc.fillColor(opts.color || '#1A202C')
        .font(opts.bold ? 'KorBold' : 'Kor')
        .fontSize(opts.size || 10);
      const pad = opts.padLeft ?? 8;
      const textY = y + (h - (opts.size || 10)) / 2 - 1;
      doc.text(text, x + pad, textY, {
        width: w - pad * 2,
        align: opts.align || 'left',
        lineBreak: false,
      });
    };

    const patient = contract.careRequest.patient;
    const caregiver = contract.caregiver;
    const caregiverUser = caregiver.user;

    // ============ 헤더: 로고/제목/구분선 ============
    // 좌측: 케어매치 브랜드 마크
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY)
      .text('CAREMATCH', MARGIN, 50, { continued: false });
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB_TEXT)
      .text('케어매치 주식회사', MARGIN, 64);

    // 우측: 문서 ID
    const docId = `DOC-${contractId.slice(0, 8).toUpperCase()}`;
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB_TEXT)
      .text(`문서번호  ${docId}`, MARGIN, 50, { width: TABLE_WIDTH, align: 'right' });
    doc.fontSize(8).fillColor(COLOR_SUB_TEXT)
      .text(`발행일  ${new Date().toISOString().slice(0, 10)}`, MARGIN, 64, { width: TABLE_WIDTH, align: 'right' });

    // 중앙 타이틀
    doc.font('KorBold').fontSize(26).fillColor(COLOR_PRIMARY)
      .text('간 병 일 지', MARGIN, 100, { width: TABLE_WIDTH, align: 'center', characterSpacing: 3 });
    doc.font('Kor').fontSize(9).fillColor(COLOR_SUB_TEXT)
      .text('Care Record / Nursing Log', MARGIN, 132, { width: TABLE_WIDTH, align: 'center' });

    // 구분선 (그라데이션 느낌의 두 줄)
    doc.lineWidth(1.5).strokeColor(COLOR_PRIMARY)
      .moveTo(MARGIN, 152).lineTo(PAGE_W - MARGIN, 152).stroke();
    doc.lineWidth(0.4).strokeColor(COLOR_ACCENT)
      .moveTo(MARGIN, 156).lineTo(PAGE_W - MARGIN, 156).stroke();

    // ============ 환자/간병인 정보 섹션 ============
    let y = 172;
    // 섹션 타이틀
    doc.font('KorBold').fontSize(10).fillColor(COLOR_PRIMARY)
      .text('Ⅰ. 기본 정보', MARGIN, y);
    y += 18;

    const col1W = 100, col2W = 170, col3W = 85, col4W = TABLE_WIDTH - col1W - col2W - col3W;
    const rowH = 26;

    const info = [
      ['환자명', patient.name || '-', '성별', patient.gender === 'M' ? '남' : (patient.gender === 'F' ? '여' : '-')],
      ['생년월일', patient.birthDate ? new Date(patient.birthDate).toISOString().slice(0, 10) : '-', '병원명', contract.careRequest.hospitalName || contract.careRequest.address || '-'],
      ['간병 시작일', contract.startDate ? new Date(contract.startDate).toISOString().slice(0, 10) : '-', '간병 기간', contract.careRequest.durationDays ? `${contract.careRequest.durationDays}일` : '-'],
      ['간병인 성명', caregiverUser?.name || '-', '간병인 연락처', caregiverUser?.phone || '-'],
      ['간병인 사용 법인명', contract.corporateName || caregiver.corporateName || '', '', ''],
    ];

    info.forEach((row, idx) => {
      const isLast = idx === info.length - 1 && !row[2];
      drawCell(TABLE_LEFT, y, col1W, rowH, row[0], {
        bold: true, bg: COLOR_HEADER_BG, size: 9, color: COLOR_PRIMARY,
      });
      if (isLast) {
        drawCell(TABLE_LEFT + col1W, y, col2W + col3W + col4W, rowH, row[1], { size: 10 });
      } else {
        drawCell(TABLE_LEFT + col1W, y, col2W, rowH, row[1], { size: 10 });
        drawCell(TABLE_LEFT + col1W + col2W, y, col3W, rowH, row[2], {
          bold: true, bg: COLOR_HEADER_BG, size: 9, color: COLOR_PRIMARY,
        });
        drawCell(TABLE_LEFT + col1W + col2W + col3W, y, col4W, rowH, row[3], { size: 10 });
      }
      y += rowH;
    });

    // 고지 안내문
    y += 14;
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB_TEXT)
      .text(
        '※ 본 간병일지 양식은 케어매치㈜ 자사 양식으로, 보험사에 따라 자사 양식으로 대체가 불가능할 수 있음을 알려드립니다.',
        MARGIN, y, { width: TABLE_WIDTH, align: 'center' },
      );
    y += 22;

    // ============ 간병 업무 일자별 기록 ============
    doc.font('KorBold').fontSize(10).fillColor(COLOR_PRIMARY)
      .text('Ⅱ. 간병 업무 기록', MARGIN, y);
    y += 18;

    const dateW = 80, timeW = 85, taskW = TABLE_WIDTH - dateW - timeW;

    // 헤더
    drawCell(TABLE_LEFT, y, dateW, rowH, '간병일자', { bold: true, bg: COLOR_PRIMARY, color: '#FFFFFF', size: 10, align: 'center' });
    drawCell(TABLE_LEFT + dateW, y, timeW, rowH, '간병시간', { bold: true, bg: COLOR_PRIMARY, color: '#FFFFFF', size: 10, align: 'center' });
    drawCell(TABLE_LEFT + dateW + timeW, y, taskW, rowH, '간병 업무', { bold: true, bg: COLOR_PRIMARY, color: '#FFFFFF', size: 10, align: 'center' });
    y += rowH;

    // 데이터 행 (최소 10행 보장)
    const displayRows = Math.max(records.length, 10);
    for (let i = 0; i < displayRows; i++) {
      const r = records[i];
      if (y + rowH > PAGE_H - MARGIN - 160) {
        // 페이지 넘김 (하단 서명 공간 확보)
        doc.addPage();
        y = MARGIN;
        // 헤더 재인쇄
        drawCell(TABLE_LEFT, y, dateW, rowH, '간병일자', { bold: true, bg: COLOR_PRIMARY, color: '#FFFFFF', size: 10, align: 'center' });
        drawCell(TABLE_LEFT + dateW, y, timeW, rowH, '간병시간', { bold: true, bg: COLOR_PRIMARY, color: '#FFFFFF', size: 10, align: 'center' });
        drawCell(TABLE_LEFT + dateW + timeW, y, taskW, rowH, '간병 업무', { bold: true, bg: COLOR_PRIMARY, color: '#FFFFFF', size: 10, align: 'center' });
        y += rowH;
      }

      const rowBg = i % 2 === 1 ? COLOR_ALT_ROW : undefined;
      const dateStr = r?.date ? new Date(r.date).toISOString().slice(5, 10).replace('-', '. ') : '';
      const hrs = r?.careHoursManual ?? r?.careHours ?? null;
      const hoursStr = hrs ? `${hrs} 시간` : '';

      drawCell(TABLE_LEFT, y, dateW, rowH, dateStr, { size: 10, align: 'center', bg: rowBg });
      drawCell(TABLE_LEFT + dateW, y, timeW, rowH, hoursStr, { size: 10, align: 'center', bg: rowBg });

      const mark = (v: boolean) => (v ? '■' : '□');
      // 기타 내용은 길어지면 레이아웃을 깨므로 테이블에서는 체크만 표시, 상세는 하단 비고에
      const taskText = r
        ? `${mark(r.mealCare)} 식사보조   ${mark(r.activityCare)} 활동보조   ${mark(r.excretionCare)} 배변보조   ${mark(r.hygieneCare)} 위생보조   ${mark(r.otherCare)} 기타`
        : '□ 식사보조   □ 활동보조   □ 배변보조   □ 위생보조   □ 기타';
      drawCell(TABLE_LEFT + dateW + timeW, y, taskW, rowH, taskText, { size: 9, bg: rowBg, align: 'center' });
      y += rowH;
    }

    // ============ 상세 비고 섹션 헬퍼 ============
    const drawNotesSection = (title: string, rows: { date: Date; text: string }[]) => {
      if (rows.length === 0) return;
      y += 20;
      if (y + 30 + rows.length * 22 > PAGE_H - MARGIN - 140) {
        doc.addPage();
        y = MARGIN;
      }
      doc.font('KorBold').fontSize(10).fillColor(COLOR_PRIMARY)
        .text(title, MARGIN, y);
      y += 18;

      const noteDateW = 80;
      const noteContentW = TABLE_WIDTH - noteDateW;
      drawCell(TABLE_LEFT, y, noteDateW, rowH, '일자', {
        bold: true, bg: COLOR_HEADER_BG, size: 9, color: COLOR_PRIMARY, align: 'center',
      });
      drawCell(TABLE_LEFT + noteDateW, y, noteContentW, rowH, '내용', {
        bold: true, bg: COLOR_HEADER_BG, size: 9, color: COLOR_PRIMARY, align: 'center',
      });
      y += rowH;

      rows.forEach((r, i) => {
        doc.font('Kor').fontSize(9);
        const textHeight = doc.heightOfString(r.text, { width: noteContentW - 16 });
        const dynamicRowH = Math.max(rowH, textHeight + 12);

        if (y + dynamicRowH > PAGE_H - MARGIN - 140) {
          doc.addPage();
          y = MARGIN;
        }

        const rowBg = i % 2 === 1 ? COLOR_ALT_ROW : undefined;
        const dateStr = r.date.toISOString().slice(5, 10).replace('-', '. ');

        doc.lineWidth(0.6).strokeColor(COLOR_BORDER);
        if (rowBg) {
          doc.rect(TABLE_LEFT, y, noteDateW, dynamicRowH).fillAndStroke(rowBg, COLOR_BORDER);
          doc.rect(TABLE_LEFT + noteDateW, y, noteContentW, dynamicRowH).fillAndStroke(rowBg, COLOR_BORDER);
        } else {
          doc.rect(TABLE_LEFT, y, noteDateW, dynamicRowH).stroke();
          doc.rect(TABLE_LEFT + noteDateW, y, noteContentW, dynamicRowH).stroke();
        }

        doc.fillColor('#1A202C').font('Kor').fontSize(10);
        doc.text(dateStr, TABLE_LEFT, y + (dynamicRowH - 10) / 2, {
          width: noteDateW, align: 'center',
        });
        doc.fontSize(9);
        doc.text(r.text, TABLE_LEFT + noteDateW + 8, y + 6, {
          width: noteContentW - 16, align: 'left',
        });
        y += dynamicRowH;
      });
    };

    // 기타 상세 (otherCare + otherCareNote)
    const otherNotes = records
      .filter((r) => r.otherCare && r.otherCareNote)
      .map((r) => ({ date: new Date(r.date), text: r.otherCareNote! }));
    drawNotesSection('Ⅲ. 기타 업무 상세', otherNotes);

    // 특이사항 (notes)
    const specialNotes = records
      .filter((r) => r.notes && r.notes.trim())
      .map((r) => ({ date: new Date(r.date), text: r.notes! }));
    drawNotesSection(
      otherNotes.length > 0 ? 'Ⅳ. 특이사항' : 'Ⅲ. 특이사항',
      specialNotes,
    );

    // ============ 하단 확인/서명 ============
    y += 22;
    if (y + 130 > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN + 20;
    }

    // 확인 문구 강조
    doc.font('KorBold').fontSize(11).fillColor(COLOR_PRIMARY)
      .text('상기와 같이 간병인을 사용하였음을 확인합니다.', MARGIN, y, { align: 'center', width: TABLE_WIDTH });
    y += 26;

    // 서명 박스 (좌/우 2분할)
    const boxW = (TABLE_WIDTH - 20) / 2;
    const boxH = 90;

    // 왼쪽: 간병인 서명 박스
    doc.lineWidth(0.6).strokeColor(COLOR_BORDER).rect(MARGIN, y, boxW, boxH).stroke();
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB_TEXT).text('간병인 확인', MARGIN + 10, y + 10);
    doc.font('KorBold').fontSize(11).fillColor('#1A202C')
      .text(caregiverUser?.name || '', MARGIN + 10, y + 30);
    doc.font('Kor').fontSize(10).fillColor(COLOR_SUB_TEXT)
      .text('(서명 / 인)', MARGIN + 10, y + 66);
    // 서명선
    doc.lineWidth(0.4).strokeColor(COLOR_BORDER)
      .moveTo(MARGIN + 10, y + 60).lineTo(MARGIN + boxW - 10, y + 60).stroke();

    // 오른쪽: 회사 확인 박스
    const rightX = MARGIN + boxW + 20;
    doc.lineWidth(0.6).strokeColor(COLOR_BORDER).rect(rightX, y, boxW, boxH).stroke();
    doc.font('Kor').fontSize(8).fillColor(COLOR_SUB_TEXT).text('소송회사 / 발행처', rightX + 10, y + 10);
    doc.font('KorBold').fontSize(11).fillColor('#1A202C')
      .text('케어매치 주식회사', rightX + 10, y + 30);
    doc.font('Kor').fontSize(9).fillColor(COLOR_SUB_TEXT)
      .text('사업자등록번호  173-81-03376', rightX + 10, y + 50);
    const today = new Date();
    doc.font('Kor').fontSize(9).fillColor(COLOR_SUB_TEXT)
      .text(`작성일  ${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`,
        rightX + 10, y + 66);

    // ============ 푸터 ============
    const footerY = PAGE_H - MARGIN + 8;
    doc.lineWidth(0.3).strokeColor(COLOR_BORDER)
      .moveTo(MARGIN, footerY - 10).lineTo(PAGE_W - MARGIN, footerY - 10).stroke();
    doc.font('Kor').fontSize(7).fillColor(COLOR_SUB_TEXT)
      .text('CareMatch Co., Ltd.  |  Business Reg. 173-81-03376  |  carematch.co.kr',
        MARGIN, footerY, { width: TABLE_WIDTH, align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
};
