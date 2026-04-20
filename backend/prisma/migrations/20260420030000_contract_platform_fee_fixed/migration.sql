-- Contract에 고정 플랫폼 수수료(원 단위) 스냅샷 필드 추가
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "platformFeeFixed" INTEGER NOT NULL DEFAULT 0;
