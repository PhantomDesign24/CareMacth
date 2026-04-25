-- 1) ContractStatus enum에 PENDING_SIGNATURE 추가
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'PENDING_SIGNATURE';

-- 2) ExtensionStatus enum 신규
DO $$ BEGIN
  CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3) Contract에 서명 필드 추가
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "guardianSignature"  TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "guardianSignedAt"   TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "caregiverSignature" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "caregiverSignedAt"  TIMESTAMP(3);

-- 4) 기존 ACTIVE/EXTENDED/COMPLETED 계약은 자동 서명 완료 처리 (마이그레이션 시점에 이미 진행 중)
UPDATE "Contract"
SET
  "guardianSignedAt"  = "createdAt",
  "caregiverSignedAt" = "createdAt"
WHERE "status" IN ('ACTIVE', 'EXTENDED', 'COMPLETED')
  AND "guardianSignedAt" IS NULL
  AND "caregiverSignedAt" IS NULL;

-- 5) ContractExtension에 결제·상태 필드 추가
ALTER TABLE "ContractExtension" ADD COLUMN IF NOT EXISTS "status"      "ExtensionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';
ALTER TABLE "ContractExtension" ADD COLUMN IF NOT EXISTS "paymentId"   TEXT;
ALTER TABLE "ContractExtension" ADD COLUMN IF NOT EXISTS "paidAt"      TIMESTAMP(3);
ALTER TABLE "ContractExtension" ADD COLUMN IF NOT EXISTS "expiredAt"   TIMESTAMP(3);
ALTER TABLE "ContractExtension" ADD COLUMN IF NOT EXISTS "rejectedAt"  TIMESTAMP(3);
ALTER TABLE "ContractExtension" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
ALTER TABLE "ContractExtension" ADD COLUMN IF NOT EXISTS "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- paymentId 1:1 unique + FK
CREATE UNIQUE INDEX IF NOT EXISTS "ContractExtension_paymentId_key" ON "ContractExtension"("paymentId");

DO $$ BEGIN
  ALTER TABLE "ContractExtension"
    ADD CONSTRAINT "ContractExtension_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 6) 기존 approvedByCaregiver=true 인 연장 건은 CONFIRMED 처리 (백워드 컴팩)
UPDATE "ContractExtension" SET "status" = 'CONFIRMED' WHERE "approvedByCaregiver" = true;
