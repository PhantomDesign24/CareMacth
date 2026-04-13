-- AlterTable
ALTER TABLE "CareApplication" ADD COLUMN     "isAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proposedRate" INTEGER;

-- CreateIndex
CREATE INDEX "CareRequest_startDate_endDate_idx" ON "CareRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CareRequest_guardianId_status_idx" ON "CareRequest"("guardianId", "status");

-- CreateIndex
CREATE INDEX "Contract_status_endDate_idx" ON "Contract"("status", "endDate");

-- CreateIndex
CREATE INDEX "Contract_caregiverId_idx" ON "Contract"("caregiverId");

-- CreateIndex
CREATE INDEX "Contract_guardianId_idx" ON "Contract"("guardianId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
