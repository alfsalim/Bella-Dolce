-- CreateTable
CREATE TABLE "FixedAssetMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fixedAssetId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "cost" REAL NOT NULL DEFAULT 0,
    "nextDueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FixedAssetMaintenance_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FixedAssetMaintenance_fixedAssetId_idx" ON "FixedAssetMaintenance"("fixedAssetId");

-- CreateIndex
CREATE INDEX "FixedAssetMaintenance_date_idx" ON "FixedAssetMaintenance"("date");
