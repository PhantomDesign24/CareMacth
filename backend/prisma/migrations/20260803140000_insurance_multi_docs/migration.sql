-- 보험서류 다중 업로드 (기본 3종 + 필요한 만큼)
ALTER TABLE "InsuranceDocRequest" ADD COLUMN IF NOT EXISTS "documentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
