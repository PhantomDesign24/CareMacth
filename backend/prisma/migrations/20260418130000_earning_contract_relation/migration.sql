-- Earning.contractId FK + index 추가 (기존 scalar만 있던 관계를 Prisma relation으로 승격)
ALTER TABLE "Earning"
  ADD CONSTRAINT "Earning_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Earning_contractId_idx" ON "Earning"("contractId");
