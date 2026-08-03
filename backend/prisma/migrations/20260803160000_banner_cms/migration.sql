-- 메인 광고 배너 CMS
CREATE TABLE IF NOT EXISTS "Banner" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "imageUrl" TEXT,
  "linkUrl" TEXT,
  "ctaLabel" TEXT,
  "bgColor" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Banner_isActive_sortOrder_idx" ON "Banner"("isActive", "sortOrder");
