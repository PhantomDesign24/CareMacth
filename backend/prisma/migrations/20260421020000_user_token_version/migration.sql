-- JWT 무효화용 버전 필드 (보안 이벤트 시 증가 → 기존 토큰 모두 무효화)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
