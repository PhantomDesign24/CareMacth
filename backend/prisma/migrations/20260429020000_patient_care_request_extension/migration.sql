-- Patient 모델 확장 (환자 정보 입력 폼 신규 필드)
ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "diagnoses" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "infections" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "roomType" TEXT,
  ADD COLUMN IF NOT EXISTS "roomTypeEtc" TEXT,
  ADD COLUMN IF NOT EXISTS "longTermCareGrade" TEXT,
  ADD COLUMN IF NOT EXISTS "hasSurgery" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "treatments" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "treatmentsEtc" TEXT,
  ADD COLUMN IF NOT EXISTS "paralysisStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "hygieneStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "hygieneStatusEtc" TEXT,
  ADD COLUMN IF NOT EXISTS "mealStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "mealStatusEtc" TEXT,
  ADD COLUMN IF NOT EXISTS "toiletStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "toiletStatusEtc" TEXT,
  ADD COLUMN IF NOT EXISTS "exerciseStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "exerciseStatusEtc" TEXT,
  ADD COLUMN IF NOT EXISTS "hasDelirium" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hasBedsore" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "needsSuction" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hasStoma" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hospitalizationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "hospitalizationReasonEtc" TEXT,
  ADD COLUMN IF NOT EXISTS "covidTestRequirement" TEXT,
  ADD COLUMN IF NOT EXISTS "vaccineCheckRequirement" TEXT;

-- CareRequest 모델 확장 (신청인 관계 / 희망 서비스 / 희망 급여)
ALTER TABLE "CareRequest"
  ADD COLUMN IF NOT EXISTS "relationToPatient" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredServices" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "preferredWageType" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredWageAmount" INTEGER;
