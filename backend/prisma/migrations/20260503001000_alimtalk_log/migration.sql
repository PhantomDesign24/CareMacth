-- 알림톡 발송 로그 (Aligo)
CREATE TYPE "AlimtalkLogStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

CREATE TABLE "AlimtalkLog" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT,
  "phone"        TEXT NOT NULL,
  "templateKey"  TEXT,
  "templateCode" TEXT,
  "title"        TEXT,
  "message"      TEXT NOT NULL,
  "buttonsJson"  JSONB,
  "status"       "AlimtalkLogStatus" NOT NULL DEFAULT 'PENDING',
  "aligoMsgId"   TEXT,
  "errorReason"  TEXT,
  "sentAt"       TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlimtalkLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlimtalkLog_status_createdAt_idx" ON "AlimtalkLog"("status", "createdAt");
CREATE INDEX "AlimtalkLog_userId_createdAt_idx" ON "AlimtalkLog"("userId", "createdAt");
CREATE INDEX "AlimtalkLog_templateKey_createdAt_idx" ON "AlimtalkLog"("templateKey", "createdAt");

ALTER TABLE "AlimtalkLog" ADD CONSTRAINT "AlimtalkLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
