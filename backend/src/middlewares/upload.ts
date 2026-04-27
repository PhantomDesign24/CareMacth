import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// 커스텀 에러 (HTTP 400으로 응답하도록 statusCode 포함)
class UploadError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new UploadError('허용되지 않는 파일 형식입니다. (jpg, png, gif, webp, pdf만 가능)'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// 공지사항 첨부용: 이미지/PDF + 일반 문서 형식 허용
const noticeFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp',
    'text/plain',
    'application/octet-stream', // hwp 등 일부 브라우저는 이걸로 보냄
  ];
  const allowedExts = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf',
    '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.hwp', '.hwpx', '.txt',
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext) && (allowedMimes.includes(file.mimetype) || file.mimetype === 'application/octet-stream')) {
    cb(null, true);
  } else {
    cb(new UploadError(`허용되지 않는 파일 형식입니다. 허용: ${allowedExts.join(', ')}`));
  }
};

export const uploadNotice = multer({
  storage,
  fileFilter: noticeFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB (오피스 파일 고려)
});

// ============================================
// Magic Number 검증
// ============================================
// 확장자 + MIME 검증을 우회하는 위장 파일을 막기 위해 디스크에 저장된 파일의
// 첫 16바이트(시그니처)를 읽어서 실제 형식을 재검증한다.

type Signature = number[];

// 확장자별 허용 시그니처 (여러 개면 OR)
const SIGNATURES_BY_EXT: Record<string, Signature[]> = {
  '.jpg':  [[0xFF, 0xD8, 0xFF]],
  '.jpeg': [[0xFF, 0xD8, 0xFF]],
  '.png':  [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  '.gif':  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF — WEBP 검증은 8바이트 뒤 'WEBP' 추가 확인
  '.pdf':  [[0x25, 0x50, 0x44, 0x46, 0x2D]], // %PDF-
  // ZIP 기반 (Office 신형, hwpx 등)
  '.zip':  [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
  '.docx': [[0x50, 0x4B, 0x03, 0x04]],
  '.xlsx': [[0x50, 0x4B, 0x03, 0x04]],
  '.pptx': [[0x50, 0x4B, 0x03, 0x04]],
  '.hwpx': [[0x50, 0x4B, 0x03, 0x04]],
  // OLE Compound (구형 Office, hwp v5)
  '.doc':  [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  '.xls':  [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  '.ppt':  [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  '.hwp':  [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  // TXT 는 시그니처 없음 (BOM 만 옵셔널) — 별도 처리
};

function readHeader(filePath: string, n: number = 16): Buffer | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(n);
    const read = fs.readSync(fd, buf, 0, n, 0);
    fs.closeSync(fd);
    return buf.subarray(0, read);
  } catch {
    return null;
  }
}

function startsWith(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return false;
  return true;
}

/**
 * 단일 파일의 매직넘버 검증.
 * - 확장자 SIGNATURES 가 정의돼 있으면 그 중 하나와 일치해야 함
 * - WEBP 는 RIFF + 8바이트 후 'WEBP' 추가 확인
 * - TXT 는 첫 1KB 에 NULL 바이트 없으면 통과 (간이 검증)
 * - 정의 없는 확장자는 통과 (whitelist 방어는 fileFilter 가 담당)
 */
function isFileSignatureValid(filePath: string, originalName: string): { ok: boolean; reason?: string } {
  const ext = path.extname(originalName).toLowerCase();
  const sigs = SIGNATURES_BY_EXT[ext];

  // TXT 처리
  if (ext === '.txt') {
    const buf = readHeader(filePath, 1024);
    if (!buf) return { ok: false, reason: '파일을 읽을 수 없습니다.' };
    // NULL 바이트 비율 체크 (바이너리 위장 차단)
    let nullCount = 0;
    for (const b of buf) if (b === 0x00) nullCount++;
    if (nullCount > 5) return { ok: false, reason: 'TXT 파일이 아닙니다. (바이너리 데이터 감지)' };
    return { ok: true };
  }

  if (!sigs) return { ok: true }; // 시그니처 정의 없음 → 통과

  const head = readHeader(filePath, 16);
  if (!head) return { ok: false, reason: '파일을 읽을 수 없습니다.' };

  if (!sigs.some((s) => startsWith(head, s))) {
    return { ok: false, reason: `${ext} 파일 시그니처가 일치하지 않습니다.` };
  }

  // WEBP 추가 검증: RIFF 시작 후 offset 8 부터 'WEBP'
  if (ext === '.webp') {
    const tail = readHeader(filePath, 12);
    if (!tail || tail.length < 12) return { ok: false, reason: 'WEBP 파일이 아닙니다.' };
    if (tail[8] !== 0x57 || tail[9] !== 0x45 || tail[10] !== 0x42 || tail[11] !== 0x50) {
      return { ok: false, reason: 'WEBP 파일이 아닙니다.' };
    }
  }

  return { ok: true };
}

/** 업로드된 파일들을 모두 unlink (검증 실패 시 정리) */
function cleanupFiles(files: Express.Multer.File[]) {
  for (const f of files) {
    if (f?.path) {
      try { fs.unlinkSync(f.path); } catch {}
    }
  }
}

/**
 * multer 다음에 위치시킬 미들웨어 — req.file 또는 req.files 의 매직넘버 검증.
 * 실패 시 파일들을 모두 삭제하고 400 응답.
 */
export const verifyUploadMagicNumber = (req: Request, res: Response, next: NextFunction) => {
  const collected: Express.Multer.File[] = [];
  if ((req as any).file) collected.push((req as any).file);
  if ((req as any).files) {
    const f = (req as any).files;
    if (Array.isArray(f)) collected.push(...f);
    else if (typeof f === 'object') {
      for (const v of Object.values(f)) if (Array.isArray(v)) collected.push(...(v as Express.Multer.File[]));
    }
  }
  if (collected.length === 0) return next();

  for (const file of collected) {
    const result = isFileSignatureValid(file.path, file.originalname);
    if (!result.ok) {
      cleanupFiles(collected);
      return res.status(400).json({
        success: false,
        message: `[${file.originalname}] ${result.reason || '파일 시그니처 검증 실패'}`,
      });
    }
  }
  next();
};

// Multer 에러 핸들러 - 라우트 다음에 적용해서 400/413으로 응답
export const handleUploadError = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    // 파일 크기 초과
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: '파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.',
      });
    }
    // 기타 multer 에러
    return res.status(400).json({
      success: false,
      message: `파일 업로드 오류: ${err.message}`,
    });
  }
  if (err instanceof UploadError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next(err);
};
