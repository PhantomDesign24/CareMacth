-- 알림 템플릿 채널/대상 메타데이터 추가
ALTER TABLE "NotificationTemplate"
  ADD COLUMN IF NOT EXISTS "channels" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "targetRoles" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "alimtalkTemplateCode" TEXT,
  ADD COLUMN IF NOT EXISTS "alimtalkButtonsJson" TEXT;
