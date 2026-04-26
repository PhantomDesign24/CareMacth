-- CreateEnum
CREATE TYPE "NoticeCategory" AS ENUM ('GENERAL', 'UPDATE', 'EVENT', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "Notice" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" "NoticeCategory" NOT NULL DEFAULT 'GENERAL',
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_isPublished_isPinned_createdAt_idx" ON "Notice"("isPublished", "isPinned", "createdAt");
CREATE INDEX "Notice_category_idx" ON "Notice"("category");
