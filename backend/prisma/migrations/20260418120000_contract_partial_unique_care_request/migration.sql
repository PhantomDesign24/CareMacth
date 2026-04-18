-- Contract.careRequestId: drop full unique, add partial unique (exclude CANCELLED)
-- 계약 취소 후 같은 공고에 대한 새 계약 생성을 허용

-- 기존 unique constraint/index 제거
-- Prisma의 @unique는 constraint가 아니라 unique INDEX로 생성되므로 DROP INDEX 사용
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_careRequestId_key";
DROP INDEX IF EXISTS "Contract_careRequestId_key";

-- 부분 유니크 인덱스: 활성/완료/연장 상태의 계약은 공고당 1건만 허용
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_careRequestId_active_unique"
  ON "Contract"("careRequestId")
  WHERE "status" != 'CANCELLED';

-- 일반 조회용 인덱스 (Prisma @@index)
CREATE INDEX IF NOT EXISTS "Contract_careRequestId_idx" ON "Contract"("careRequestId");
