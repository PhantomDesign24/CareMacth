import { Request, Response, NextFunction } from 'express';

/**
 * 문자열에서 위험한 HTML/스크립트 태그 제거
 */
function stripTags(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * HTML 허용 필드를 위한 안전한 sanitization
 * - script 태그 / javascript: / 이벤트 핸들러만 제거
 * - 일반 HTML 태그(p, br, img, a, ul, li 등)는 유지
 */
function safeHtml(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');
}

// 라우트별 HTML 허용 필드 화이트리스트
// (path prefix → 허용 필드명)
const HTML_ALLOWED: { pathPrefix: string; fields: string[] }[] = [
  { pathPrefix: '/api/admin/notices', fields: ['content'] },
];

function isHtmlAllowed(reqPath: string, fieldKey: string): boolean {
  return HTML_ALLOWED.some((rule) =>
    reqPath.startsWith(rule.pathPrefix) && rule.fields.includes(fieldKey),
  );
}

function sanitizeValue(value: any, reqPath: string, key?: string): any {
  if (typeof value === 'string') {
    if (key && isHtmlAllowed(reqPath, key)) {
      return safeHtml(value);
    }
    return stripTags(value.trim());
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v, reqPath));
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value, reqPath);
  }
  return value;
}

function sanitizeObject(obj: Record<string, any>, reqPath: string): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value, reqPath, key);
  }
  return sanitized;
}

/**
 * 요청 body, query, params의 문자열 값을 sanitize
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  const reqPath = req.path || '';
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body, reqPath);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, any>, reqPath);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params, reqPath);
  }
  next();
};
