-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "allowedPaths" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "companyRegistrationNumber" TEXT
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "costPrice" REAL NOT NULL,
    "shelfLife" INTEGER NOT NULL DEFAULT 24,
    "imageUrl" TEXT,
    "stock" REAL NOT NULL DEFAULT 0,
    "shopStock" REAL NOT NULL DEFAULT 0,
    "freezerStock" REAL NOT NULL DEFAULT 0,
    "wasteQuantity" REAL NOT NULL DEFAULT 0,
    "minStock" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "specifications" TEXT,
    "ingredients" TEXT,
    "itemType" TEXT NOT NULL DEFAULT 'product',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isPack" BOOLEAN NOT NULL DEFAULT false,
    "packItems" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currentStock" REAL NOT NULL DEFAULT 0,
    "stock" REAL NOT NULL DEFAULT 0,
    "wasteQuantity" REAL NOT NULL DEFAULT 0,
    "minStock" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'none',
    "imageUrl" TEXT,
    "brand" TEXT,
    "expiryDate" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "batchSize" REAL NOT NULL,
    "prepTime" INTEGER NOT NULL,
    "ingredients" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "deliveryGuyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trackingUrl" TEXT,
    "comments" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
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
    CONSTRAINT "ProductionBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT,
    "customerId" TEXT,
    "totalAmount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "materials" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'b2c',
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "expiryDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'banner',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent" TEXT,
    "isCategory" BOOLEAN NOT NULL DEFAULT false,
    "normalBalance" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "period" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "sourceModule" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "debit" REAL NOT NULL,
    "credit" REAL NOT NULL,
    "label" TEXT
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "executionDate" DATETIME NOT NULL,
    "totalNet" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "baseSalary" REAL NOT NULL,
    "grossSalary" REAL NOT NULL,
    "netSalary" REAL NOT NULL,
    "totalEmployerCost" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "amountHT" TEXT,
    "tvaAmount" REAL,
    "totalAmount" REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acquisitionCost" REAL NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL,
    "acquisitionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyCashReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "systemClosingBalance" REAL NOT NULL,
    "physicalClosingBalance" REAL NOT NULL,
    "discrepancy" REAL NOT NULL,
    "closedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "compositeScore" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FinancialEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nin" TEXT,
    "baseSalary" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT,
    "itemType" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "previousStock" REAL NOT NULL,
    "newStock" REAL NOT NULL,
    "location" TEXT,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amountHT" REAL NOT NULL,
    "amountTVA" REAL NOT NULL,
    "amountTTC" REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "journalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "System" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "performed" BOOLEAN,
    "performedAt" TEXT,
    "performedBy" TEXT,
    "data" TEXT
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "monthlyAmounts" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "approvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_number_key" ON "Account"("number");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key" ON "SupplierInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_code_key" ON "FixedAsset"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashReconciliation_date_key" ON "DailyCashReconciliation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSnapshot_date_key" ON "RiskSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEmployee_matricule_key" ON "FinancialEmployee"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_invoiceNumber_key" ON "CustomerInvoice"("invoiceNumber");
