-- 2026-07-21 배치: db push 로 선반영된 스키마 변경을 마이그레이션으로 정식 기록
-- (운영 DB에는 prisma migrate resolve --applied 로 마킹됨 — 재실행되지 않음)

-- 간병인 휴직 중 상태
ALTER TYPE "CaregiverWorkStatus" ADD VALUE IF NOT EXISTS 'ON_LEAVE';

-- 무통장입금 입금계좌 (관리자 설정)
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "depositBankName" TEXT;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "depositAccountNumber" TEXT;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "depositAccountHolder" TEXT;

-- 병원·기업 제휴 문의
CREATE TABLE IF NOT EXISTS "BusinessInquiry" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "type" TEXT NOT NULL DEFAULT 'hospital',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BusinessInquiry_status_createdAt_idx" ON "BusinessInquiry"("status", "createdAt");
