-- 환불 요청 2단계 플로우 필드
CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Payment"
  ADD COLUMN "refundRequestStatus" "RefundRequestStatus",
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN "refundRequestedBy" TEXT,
  ADD COLUMN "refundRequestReason" TEXT,
  ADD COLUMN "refundRequestAmount" INTEGER,
  ADD COLUMN "refundReviewedAt" TIMESTAMP(3),
  ADD COLUMN "refundReviewedBy" TEXT,
  ADD COLUMN "refundRejectReason" TEXT;

CREATE INDEX "Payment_refundRequestStatus_idx" ON "Payment"("refundRequestStatus");
