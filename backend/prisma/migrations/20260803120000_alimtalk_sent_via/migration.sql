-- 알림톡 실제 발송 수단 기록 (ALIMTALK / SMS / LMS)
ALTER TABLE "AlimtalkLog" ADD COLUMN IF NOT EXISTS "sentVia" TEXT;
