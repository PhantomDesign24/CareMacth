-- AdditionalFee: 거절 이력 보존을 위해 rejected + rejectReason 필드 추가
ALTER TABLE "AdditionalFee"
  ADD COLUMN "rejected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rejectReason" TEXT;

CREATE INDEX IF NOT EXISTS "AdditionalFee_rejected_idx" ON "AdditionalFee"("rejected");
CREATE INDEX IF NOT EXISTS "AdditionalFee_approvedByGuardian_idx" ON "AdditionalFee"("approvedByGuardian");
