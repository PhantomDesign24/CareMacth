-- CareRecord 필드 교체: 기존 상세 필드 제거, 케어매치 공식 양식 필드 추가

ALTER TABLE "CareRecord"
  DROP COLUMN IF EXISTS "bodyTemp",
  DROP COLUMN IF EXISTS "bloodPressure",
  DROP COLUMN IF EXISTS "pulse",
  DROP COLUMN IF EXISTS "meals",
  DROP COLUMN IF EXISTS "medication",
  DROP COLUMN IF EXISTS "excretion",
  DROP COLUMN IF EXISTS "sleep",
  DROP COLUMN IF EXISTS "mobility",
  DROP COLUMN IF EXISTS "mentalState",
  DROP COLUMN IF EXISTS "skinState";

ALTER TABLE "CareRecord"
  ADD COLUMN "careHours" DOUBLE PRECISION,
  ADD COLUMN "mealCare" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "activityCare" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "excretionCare" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hygieneCare" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "otherCare" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "otherCareNote" TEXT;
