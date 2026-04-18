-- Review.contract 관계 복원 (이전엔 scalar contractId만 있었음)
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Review_contractId_idx" ON "Review"("contractId");
