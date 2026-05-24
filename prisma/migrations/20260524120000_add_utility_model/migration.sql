-- CreateTable
CREATE TABLE "Utility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invoiceNumber" TEXT,
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Utility_type_idx" ON "Utility"("type");

-- CreateIndex
CREATE INDEX "Utility_provider_idx" ON "Utility"("provider");

-- CreateIndex
CREATE INDEX "Utility_status_idx" ON "Utility"("status");

-- CreateIndex
CREATE INDEX "Utility_createdAt_idx" ON "Utility"("createdAt");
