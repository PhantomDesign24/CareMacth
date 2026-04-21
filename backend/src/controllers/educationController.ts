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

// POST /:id/heartbeat - 서버 기반 시청 진도 누적 (부정 방지)
// Body: { videoTime: number, duration: number, playing: boolean }
// Server가 자체 시계로 wallclock delta 측정 → 실제 재생된 시간만 누적
export const heartbeat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { videoTime, duration, playing } = req.body;

    if (typeof videoTime !== 'number' || typeof duration !== 'number' || duration <= 0) {
      throw new AppError('유효한 videoTime / duration이 필요합니다.', 400);
    }

    const caregiver = await prisma.caregiver.findUnique({ where: { userId: req.user!.id } });
    if (!caregiver) throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);

    const education = await prisma.education.findUnique({ where: { id } });
    if (!education || !education.isActive) throw new AppError('교육을 찾을 수 없습니다.', 404);

    const now = new Date();
    const existing = await prisma.educationRecord.findUnique({
      where: { caregiverId_educationId: { caregiverId: caregiver.id, educationId: id } },
    });

    let watchedSeconds = existing?.watchedSeconds ?? 0;
    // 이미 완료된 과정은 더 집계 안 함
    if (existing?.completed) {
      return res.json({
        success: true,
        data: { watchedSeconds, progress: 100, completed: true, duration },
      });
    }

    if (existing?.lastHeartbeatAt && existing?.lastVideoTime !== null && playing) {
      const wallDelta = (now.getTime() - new Date(existing.lastHeartbeatAt).getTime()) / 1000;
      const videoDelta = videoTime - (existing.lastVideoTime ?? 0);

      // 방어: 너무 빠른 연속 호출 (<3초) 차단
      if (wallDelta >= 3 && wallDelta <= 30) {
        // 정상 재생: videoDelta ≈ wallDelta (±3초 허용)
        if (videoDelta > 0 && Math.abs(videoDelta - wallDelta) < 3) {
          watchedSeconds = Math.min(watchedSeconds + videoDelta, duration);
        }
        // seek / pause 중이면 누적 X
      }
    }

    const progress = Math.min(100, (watchedSeconds / duration) * 100);
    const completed = progress >= 80;

    const record = await prisma.educationRecord.upsert({
      where: { caregiverId_educationId: { caregiverId: caregiver.id, educationId: id } },
      create: {
        caregiverId: caregiver.id,
        educationId: id,
        progress,
        completed,
        completedAt: completed ? now : null,
        watchedSeconds: Math.round(watchedSeconds),
        lastHeartbeatAt: now,
        lastVideoTime: Math.round(videoTime),
        videoDuration: Math.round(duration),
      },
      update: {
        progress,
        completed: completed || existing?.completed || false,
        completedAt: completed && !existing?.completed ? now : existing?.completedAt,
        watchedSeconds: Math.round(watchedSeconds),
        lastHeartbeatAt: now,
        lastVideoTime: Math.round(videoTime),
        videoDuration: Math.round(duration),
      },
    });

    res.json({
      success: true,
      data: {
        watchedSeconds: record.watchedSeconds,
        progress: record.progress,
        completed: record.completed,
        duration,
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

// GET /certificate/:id/download - 수료증 HTML 반환 (브라우저에서 인쇄 → PDF 저장)
export const downloadCertificate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { name: true } } },
    });
    if (!caregiver) throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);

    const record = await prisma.educationRecord.findFirst({
      where: { educationId: id, caregiverId: caregiver.id },
      include: { education: true },
    });
    if (!record || !record.completed) {
      throw new AppError('수료증 발급 대상이 아닙니다.', 400);
    }

    const completedAt = record.completedAt ? new Date(record.completedAt).toLocaleDateString('ko-KR') : '-';
    const certNo = `CM-${record.id.slice(0, 8).toUpperCase()}`;

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>수료증 - ${caregiver.user.name}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans KR', sans-serif; background: #f4f4f4; }
  .cert {
    width: 297mm; height: 210mm; margin: 0 auto; background: #fff;
    border: 12px solid #FF922E; padding: 40mm 30mm; position: relative;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .cert::before {
    content: ''; position: absolute; inset: 8mm; border: 2px solid #FFD4A8;
  }
  .header { text-align: center; position: relative; }
  .header h1 { font-size: 48pt; font-weight: 900; color: #FF922E; letter-spacing: 20pt; }
  .header .sub { font-size: 14pt; color: #888; margin-top: 6pt; letter-spacing: 8pt; }
  .body { text-align: center; position: relative; }
  .body .no { font-size: 11pt; color: #666; }
  .body .name { font-size: 32pt; font-weight: 700; margin-top: 20pt; color: #222; }
  .body .name span { border-bottom: 2px solid #222; padding: 0 30pt 4pt; }
  .body .title { font-size: 18pt; margin-top: 30pt; color: #333; line-height: 1.8; }
  .body .title strong { color: #FF922E; font-size: 22pt; }
  .footer { text-align: center; position: relative; }
  .footer .date { font-size: 14pt; color: #333; margin-bottom: 16pt; }
  .footer .issuer { font-size: 18pt; font-weight: 700; color: #222; }
  .footer .seal { margin-top: 8pt; font-size: 13pt; color: #666; }
  @media print {
    body { background: #fff; }
    .cert { border: 12px solid #FF922E; }
    .noprint { display: none; }
  }
  .noprint {
    position: fixed; top: 20px; right: 20px; padding: 12px 24px;
    background: #FF922E; color: #fff; border: none; border-radius: 8px;
    font-size: 14pt; font-weight: 700; cursor: pointer;
  }
</style>
</head>
<body>
<button class="noprint" onclick="window.print()">인쇄 / PDF 저장</button>
<div class="cert">
  <div class="header">
    <h1>수료증</h1>
    <div class="sub">CERTIFICATE OF COMPLETION</div>
  </div>
  <div class="body">
    <div class="no">증 제 ${certNo} 호</div>
    <div class="name">성명: <span>${caregiver.user.name}</span></div>
    <div class="title">
      위 사람은 케어매치 간병인 전문 교육과정<br>
      『 <strong>${record.education.title}</strong> 』<br>
      을(를) 이수하였으므로 이 증서를 수여합니다.
    </div>
  </div>
  <div class="footer">
    <div class="date">${completedAt}</div>
    <div class="issuer">(주) 케어매치</div>
    <div class="seal">대표 (인)</div>
  </div>
</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

// GET /certificate/:id/pdf - 실제 PDF 생성 (pdfkit)
export const downloadCertificatePdf = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const { id } = req.params;

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { name: true, referralCode: true } } },
    });
    if (!caregiver) throw new AppError('간병인 정보를 찾을 수 없습니다.', 404);

    const record = await prisma.educationRecord.findFirst({
      where: { educationId: id, caregiverId: caregiver.id },
      include: { education: true },
    });
    if (!record || !record.completed) {
      throw new AppError('수료증 발급 대상이 아닙니다.', 400);
    }

    const FONT_REGULAR = '/usr/share/fonts/truetype/nanum/NanumGothic.ttf';
    const FONT_BOLD = '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf';
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificate-${record.id.slice(0, 8)}.pdf"`);
    doc.pipe(res);

    if (fs.existsSync(FONT_REGULAR)) doc.registerFont('Kor', FONT_REGULAR);
    if (fs.existsSync(FONT_BOLD)) doc.registerFont('KorBold', FONT_BOLD);

    const W = 841.89, H = 595.28;
    // 외곽 박스
    doc.rect(0, 0, W, H).fill('#FFFFFF');
    doc.lineWidth(12).strokeColor('#1E3A5F').rect(18, 18, W - 36, H - 36).stroke();
    doc.lineWidth(1).strokeColor('#93A5BE').rect(34, 34, W - 68, H - 68).stroke();

    // 타이틀
    doc.font('KorBold').fontSize(48).fillColor('#1E3A5F')
      .text('수 료 증', 0, 90, { width: W, align: 'center', characterSpacing: 10 });
    doc.font('Kor').fontSize(12).fillColor('#5A6B80')
      .text('CERTIFICATE OF COMPLETION', 0, 150, { width: W, align: 'center', characterSpacing: 6 });

    // 구분선
    doc.lineWidth(1).strokeColor('#D0D5DD')
      .moveTo(W / 2 - 60, 180).lineTo(W / 2 + 60, 180).stroke();

    // 증 번호
    const certNo = `CM-${record.id.slice(0, 8).toUpperCase()}`;
    doc.font('Kor').fontSize(11).fillColor('#666')
      .text(`증 제 ${certNo} 호`, 0, 210, { width: W, align: 'center' });

    // 성명
    doc.font('KorBold').fontSize(32).fillColor('#1A202C')
      .text(`성 명  ${caregiver.user.name}`, 0, 245, { width: W, align: 'center' });

    // 내용
    doc.font('Kor').fontSize(16).fillColor('#333')
      .text('위 사람은 케어매치 간병인 전문 교육과정', 0, 315, { width: W, align: 'center' });
    doc.font('KorBold').fontSize(20).fillColor('#1E3A5F')
      .text(`『 ${record.education.title} 』`, 0, 345, { width: W, align: 'center' });
    doc.font('Kor').fontSize(16).fillColor('#333')
      .text('을(를) 이수하였으므로 이 증서를 수여합니다.', 0, 380, { width: W, align: 'center' });

    // 발행일 + 발행처
    const completedAt = record.completedAt ? new Date(record.completedAt).toLocaleDateString('ko-KR') : '-';
    doc.font('Kor').fontSize(13).fillColor('#333')
      .text(completedAt, 0, 460, { width: W, align: 'center' });
    doc.font('KorBold').fontSize(16).fillColor('#1A202C')
      .text('케어매치 주식회사', 0, 485, { width: W, align: 'center' });
    doc.font('Kor').fontSize(10).fillColor('#666')
      .text('사업자등록번호 173-81-03376', 0, 510, { width: W, align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
};
