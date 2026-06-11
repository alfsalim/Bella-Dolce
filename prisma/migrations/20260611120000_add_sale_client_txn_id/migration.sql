-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "clientTxnId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_clientTxnId_key" ON "Sale"("clientTxnId");
