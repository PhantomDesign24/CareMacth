-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'PROCESSING', 'RESOLVED', 'ESCALATED', 'REJECTED');
CREATE TYPE "DisputeCategory" AS ENUM ('CARE_QUALITY', 'CANCELLATION', 'PAYMENT', 'ABUSE', 'NO_SHOW', 'OTHER');

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "reporterId" TEXT NOT NULL,
    "targetId" TEXT,
    "category" "DisputeCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dispute_contractId_idx" ON "Dispute"("contractId");
CREATE INDEX "Dispute_reporterId_idx" ON "Dispute"("reporterId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
