import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  extras?: Record<string, unknown>;

  constructor(message: string, statusCode: number, extras?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.extras = extras;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.extras || {}),
    });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({
    success: false,
    message: '서버 내부 오류가 발생했습니다.',
  });
};
