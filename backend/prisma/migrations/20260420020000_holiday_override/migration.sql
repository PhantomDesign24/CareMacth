-- HolidayType enum
CREATE TYPE "HolidayType" AS ENUM ('CUSTOM', 'EXCLUDE');

-- Holiday 테이블: 라이브러리 공휴일에 대한 관리자 override
CREATE TABLE "Holiday" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "type" "HolidayType" NOT NULL DEFAULT 'CUSTOM',
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");
