-- 지원자 미발생 안내 발송 추적 (10분/60분 시점, 재발송 방지)
ALTER TABLE "CareRequest" ADD COLUMN "noApplicant10minSentAt" TIMESTAMP(3);
ALTER TABLE "CareRequest" ADD COLUMN "noApplicant60minSentAt" TIMESTAMP(3);
