-- CreateTable
CREATE TABLE "AssociationFeePayment" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssociationFeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssociationFeePayment_year_month_idx" ON "AssociationFeePayment"("year", "month");

-- CreateIndex
CREATE INDEX "AssociationFeePayment_paid_idx" ON "AssociationFeePayment"("paid");

-- CreateIndex
CREATE UNIQUE INDEX "AssociationFeePayment_caregiverId_year_month_key" ON "AssociationFeePayment"("caregiverId", "year", "month");

-- AddForeignKey
ALTER TABLE "AssociationFeePayment" ADD CONSTRAINT "AssociationFeePayment_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
