-- 간병인 당 ACTIVE/EXTENDED 계약은 동시에 1건만 허용
-- 중복 계약이 있으면 이 마이그레이션은 실패 — 먼저 수동으로 중복 취소 후 재실행 필요
-- 아래 쿼리로 중복 확인:
--   SELECT "caregiverId", COUNT(*) FROM "Contract"
--   WHERE status IN ('ACTIVE','EXTENDED') GROUP BY "caregiverId" HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Contract_caregiverId_active_unique"
  ON "Contract"("caregiverId")
  WHERE "status" IN ('ACTIVE', 'EXTENDED');
