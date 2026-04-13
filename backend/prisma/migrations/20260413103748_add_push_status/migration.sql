-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "pushError" TEXT,
ADD COLUMN     "pushSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pushSentAt" TIMESTAMP(3),
ADD COLUMN     "pushSuccess" BOOLEAN;
