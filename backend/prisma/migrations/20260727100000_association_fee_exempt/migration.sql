-- 협회비 영구 제외 플래그
ALTER TABLE "Caregiver" ADD COLUMN IF NOT EXISTS "associationFeeExempt" BOOLEAN NOT NULL DEFAULT false;
