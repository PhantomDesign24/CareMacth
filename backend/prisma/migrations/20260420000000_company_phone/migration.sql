-- PlatformConfig에 상담사 연결 회사 대표번호 추가
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "companyPhone" TEXT;
