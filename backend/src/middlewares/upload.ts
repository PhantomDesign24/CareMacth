import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
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
