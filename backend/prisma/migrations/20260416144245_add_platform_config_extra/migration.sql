-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "associationFeeDefault" INTEGER NOT NULL DEFAULT 30000,
ADD COLUMN     "cancellationFee" INTEGER NOT NULL DEFAULT 0;
