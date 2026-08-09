/*
  Warnings:

  - Added the required column `updatedAt` to the `FinancialEmployee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FixedAsset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "amountPaid" REAL;
ALTER TABLE "Sale" ADD COLUMN "change" REAL;
ALTER TABLE "Sale" ADD COLUMN "comment" TEXT;
ALTER TABLE "Sale" ADD COLUMN "discount" REAL;
ALTER TABLE "Sale" ADD COLUMN "returnComment" TEXT;

-- CreateTable
CREATE TABLE "SpecificationOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UtilityDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "contractStartDate" DATETIME,
    "contractEndDate" DATETIME,
    "fixedPrice" REAL,
    "dueDay" INTEGER NOT NULL DEFAULT 31,
    "generateRecurring" BOOLEAN NOT NULL DEFAULT false,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overdueDays" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "collection" TEXT,
    "operation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TaxConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "year" INTEGER,
    "ratePercent" REAL NOT NULL,
    "description" TEXT,
    "effectiveFrom" DATETIME,
    "effectiveUntil" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IfuDeclaration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "grossTurnover" REAL NOT NULL,
    "taxRatePercent" REAL NOT NULL,
    "taxAmountDue" REAL NOT NULL,
    "monthlyBreakdown" TEXT,
    "configSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "submittedAt" DATETIME,
    "submissionReference" TEXT,
    "amendmentOf" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ActivityLog" ("action", "details", "id", "timestamp", "userId", "userName") SELECT "action", "details", "id", "timestamp", "userId", "userName" FROM "ActivityLog";
DROP TABLE "ActivityLog";
ALTER TABLE "new_ActivityLog" RENAME TO "ActivityLog";
CREATE TABLE "new_FinancialEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "matricule" TEXT NOT NULL,
    "nin" TEXT,
    "cnasNumber" TEXT,
    "department" TEXT,
    "hireDate" DATETIME,
    "baseSalary" REAL NOT NULL,
    "transportAllowance" REAL NOT NULL DEFAULT 0,
    "performanceBonus" REAL NOT NULL DEFAULT 0,
    "otherAllowances" REAL NOT NULL DEFAULT 0,
    "contributesToCNAS" BOOLEAN NOT NULL DEFAULT true,
    "bankRIB" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FinancialEmployee" ("baseSalary", "createdAt", "id", "matricule", "name", "nin", "role", "status") SELECT "baseSalary", "createdAt", "id", "matricule", "name", "nin", "role", "status" FROM "FinancialEmployee";
DROP TABLE "FinancialEmployee";
ALTER TABLE "new_FinancialEmployee" RENAME TO "FinancialEmployee";
CREATE UNIQUE INDEX "FinancialEmployee_matricule_key" ON "FinancialEmployee"("matricule");
CREATE TABLE "new_FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "location" TEXT,
    "acquisitionCost" REAL NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL DEFAULT 5,
    "salvageValue" REAL NOT NULL DEFAULT 0,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'LINEAR',
    "notes" TEXT,
    "lastMaintenanceAt" DATETIME,
    "nextMaintenanceAt" DATETIME,
    "maintenanceNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_SERVICE',
    "acquisitionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FixedAsset" ("acquisitionCost", "acquisitionDate", "code", "id", "name", "usefulLifeYears") SELECT "acquisitionCost", "acquisitionDate", "code", "id", "name", "usefulLifeYears" FROM "FixedAsset";
DROP TABLE "FixedAsset";
ALTER TABLE "new_FixedAsset" RENAME TO "FixedAsset";
CREATE UNIQUE INDEX "FixedAsset_code_key" ON "FixedAsset"("code");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "clientName" TEXT,
    "description" TEXT,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deliveryStatus" TEXT,
    "type" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "deliveryId" TEXT,
    "notes" TEXT,
    "expectedTime" TEXT,
    "expectedDate" TEXT,
    "createdBy" TEXT,
    "amountPaid" REAL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'n/a',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Order" ("clientName", "createdAt", "createdBy", "customerId", "deliveryId", "deliveryStatus", "description", "expectedDate", "expectedTime", "id", "items", "notes", "status", "totalAmount", "type", "updatedAt") SELECT "clientName", "createdAt", "createdBy", "customerId", "deliveryId", "deliveryStatus", "description", "expectedDate", "expectedTime", "id", "items", "notes", "status", "totalAmount", "type", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_PayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "executionDate" DATETIME NOT NULL,
    "totalGross" REAL NOT NULL DEFAULT 0,
    "totalNet" REAL NOT NULL,
    "totalCNAS" REAL NOT NULL DEFAULT 0,
    "totalCNASEmployer" REAL NOT NULL DEFAULT 0,
    "totalIRG" REAL NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "approvedBy" TEXT,
    "configSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PayrollRun" ("createdAt", "executionDate", "id", "period", "status", "totalNet") SELECT "createdAt", "executionDate", "id", "period", "status", "totalNet" FROM "PayrollRun";
DROP TABLE "PayrollRun";
ALTER TABLE "new_PayrollRun" RENAME TO "PayrollRun";
CREATE TABLE "new_Payslip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL,
    "baseSalary" REAL NOT NULL,
    "transportAllowance" REAL NOT NULL DEFAULT 0,
    "performanceBonus" REAL NOT NULL DEFAULT 0,
    "otherAllowances" REAL NOT NULL DEFAULT 0,
    "grossSalary" REAL NOT NULL,
    "cnasEmployee" REAL NOT NULL DEFAULT 0,
    "taxableGross" REAL NOT NULL DEFAULT 0,
    "irgRetained" REAL NOT NULL DEFAULT 0,
    "irgAbatement" REAL NOT NULL DEFAULT 0,
    "netSalary" REAL NOT NULL,
    "cnasEmployer" REAL NOT NULL DEFAULT 0,
    "totalEmployerCost" REAL NOT NULL
);
INSERT INTO "new_Payslip" ("baseSalary", "employeeId", "grossSalary", "id", "netSalary", "period", "runId", "totalEmployerCost") SELECT "baseSalary", "employeeId", "grossSalary", "id", "netSalary", "period", "runId", "totalEmployerCost" FROM "Payslip";
DROP TABLE "Payslip";
ALTER TABLE "new_Payslip" RENAME TO "Payslip";
CREATE TABLE "new_ProductionBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "recipeId" TEXT NOT NULL,
    "plannedQty" REAL NOT NULL,
    "actualQty" REAL,
    "ingredients" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "createdBy" TEXT,
    "location" TEXT DEFAULT 'shop',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionBatch" ("actualQty", "createdAt", "createdBy", "endDate", "id", "ingredients", "location", "plannedQty", "productId", "recipeId", "startDate", "status", "updatedAt") SELECT "actualQty", "createdAt", "createdBy", "endDate", "id", "ingredients", "location", "plannedQty", "productId", "recipeId", "startDate", "status", "updatedAt" FROM "ProductionBatch";
DROP TABLE "ProductionBatch";
ALTER TABLE "new_ProductionBatch" RENAME TO "ProductionBatch";
CREATE TABLE "new_Utility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "lastBillAmount" REAL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invoiceNumber" TEXT,
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Utility_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "UtilityDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Utility" ("amount", "attachmentUrl", "createdAt", "currency", "dueDate", "id", "invoiceNumber", "notes", "paidAt", "periodEnd", "periodStart", "provider", "status", "type", "updatedAt") SELECT "amount", "attachmentUrl", "createdAt", "currency", "dueDate", "id", "invoiceNumber", "notes", "paidAt", "periodEnd", "periodStart", "provider", "status", "type", "updatedAt" FROM "Utility";
DROP TABLE "Utility";
ALTER TABLE "new_Utility" RENAME TO "Utility";
CREATE INDEX "Utility_type_idx" ON "Utility"("type");
CREATE INDEX "Utility_provider_idx" ON "Utility"("provider");
CREATE INDEX "Utility_status_idx" ON "Utility"("status");
CREATE INDEX "Utility_definitionId_idx" ON "Utility"("definitionId");
CREATE INDEX "Utility_createdAt_idx" ON "Utility"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SpecificationOption_category_value_key" ON "SpecificationOption"("category", "value");

-- CreateIndex
CREATE INDEX "UtilityDefinition_type_idx" ON "UtilityDefinition"("type");

-- CreateIndex
CREATE INDEX "UtilityDefinition_provider_idx" ON "UtilityDefinition"("provider");

-- CreateIndex
CREATE INDEX "TaxConfig_type_idx" ON "TaxConfig"("type");

-- CreateIndex
CREATE INDEX "TaxConfig_year_idx" ON "TaxConfig"("year");

-- CreateIndex
CREATE UNIQUE INDEX "TaxConfig_type_year_key" ON "TaxConfig"("type", "year");

-- CreateIndex
CREATE INDEX "IfuDeclaration_status_idx" ON "IfuDeclaration"("status");

-- CreateIndex
CREATE INDEX "IfuDeclaration_year_idx" ON "IfuDeclaration"("year");

-- CreateIndex
CREATE UNIQUE INDEX "IfuDeclaration_year_version_key" ON "IfuDeclaration"("year", "version");
