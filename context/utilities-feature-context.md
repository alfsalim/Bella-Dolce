# Utilities Feature — Context

## Finance module location
`src/pages/Finance/` — Main entry at `src/pages/Finance/index.tsx`

Sub-pages include: FinancialDashboard, GeneralLedger, Payroll, Expenses, Revenue, TaxReports, RiskEngine, Budgeting

---

## Existing Spending feature

### List page
`src/pages/Finance/Expenses.tsx` — Two-tab interface:
- **Invoices tab**: Displays supplier invoices (SupplierInvoice rows)
- **Assets tab**: Displays fixed assets with depreciation and maintenance tracking

### Form pages
- Invoice editing: Redirects to `/procurement` (not inline)
- Asset management: Modal at line 771 in Expenses.tsx
  - Create new asset: `openNewAsset()` at line 287
  - Edit asset: `openEditAsset()` at line 308
  - Modal form includes: code, name, category, location, acquisition date/cost, useful life, salvage value, depreciation method, maintenance dates/notes

### API routes
```
GET   /api/db/purchases              → fetches SupplierInvoice[] (JSON)
GET   /api/db/fixedAssets            → fetches FixedAssetDbRow[] with pagination
GET   /api/db/fixedAssetMaintenances → fetches maintenance records by date range
POST  /api/db/fixedAssets            → create new asset
PUT   /api/db/fixedAssets/{id}       → update asset
DELETE /api/db/fixedAssets/{id}      → delete asset
```

All API calls use `authFetch()` with `getAuthHeaders()` from `src/lib/api-client.ts`

### Prisma models
**SupplierInvoice** (lines 268–281 in schema.prisma):
- id, invoiceNumber (unique), supplierId, supplierName, date, dueDate
- amountHT (string—contains JSON: {materialName, materialId, quantity, unit})
- tvaAmount, totalAmount, amountPaid, status, createdAt

**FixedAsset** (lines 283–302 in schema.prisma):
- id, code (unique), name, category, location
- acquisitionCost, usefulLifeYears, salvageValue, depreciationMethod
- acquisitionDate, status (IN_SERVICE, IDLE, DISPOSED)
- lastMaintenanceAt, nextMaintenanceAt, maintenanceNotes, notes
- Relations: 1→many to FixedAssetMaintenance

**FixedAssetMaintenance** (lines 304–317 in schema.prisma):
- id, fixedAssetId, date, description, cost, nextDueDate, createdAt/updatedAt

---

## Cost categorization (today)

### Purchase expenses
- Categorized by **raw material category** (from RawMaterial.category):
  - `kitchen` → bucketted as "rawMaterial"
  - Other values → bucketted as "consumable"
- Logic at lines 215–226 in Expenses.tsx: `purchaseBuckets` memoized calculation

### Asset expenses
- Categorized by **FixedAsset.category** enum:
  - oven, refrigeration, vehicle, it, furniture, other
  - Display names via `categoryTf()` function at line 263 (uses tf() keys: assetCatOven, assetCatRefrigeration, etc.)

---

## Profitability calculation

### Today's implementation
- **Product-level margin** not calculated anywhere yet
- Product model has:
  - `costPrice: Float`
  - `sellingPrice: Float`
  - Margin formula (if needed): `(sellingPrice - costPrice) / sellingPrice`

- **Depreciation** calculated in Expenses.tsx at line 282:
  ```typescript
  annualDepreciation = (cost: number, salvage: number, years: number) => 
    Math.max(0, (cost - salvage) / years)
  ```
  Monthly accrual shown in asset finance dashboard at line 650

- **Asset maintenance spend** aggregated in Expenses.tsx at line 253:
  ```typescript
  maintSpendByAssetCode = Map<assetCode, totalMaintenanceCost>
  ```
  Filtered by date range selected in UI (lines 97–99)

---

## Currency formatting

### Main utility
**File**: `src/contexts/LanguageContext.tsx` (lines 93–100)
**Function**: `formatCurrency(amount: number) → string`
```typescript
const formatted = new Intl.NumberFormat(
  language === 'ar' ? 'ar-DZ' : 'fr-DZ',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
).format(amount);

return `${formatted} ${currencyUnit}`; // "1 234,56 DA" or "1 234,56 دج"
```

### Configuration
- **Currency code**: `src/constants.ts` line 4 — `CURRENCY = config.CURRENCY`
- **Currency unit suffix**:
  - French: "DA" (from CURRENCY constant)
  - Arabic: "دج" (hardcoded at line 91)

### Usage pattern
All components using `useLanguage()` hook get `formatCurrency` injected:
```typescript
const { formatCurrency, tf } = useLanguage();
formatCurrency(1234.56) // "1 234,56 DA"
```

---

## Dependencies
- **i18n keys for expenses**: See `src/constants.ts` — FINANCIAL_TRANSLATIONS object for `fr` and `ar`
  - Key examples: `supplierInvoices`, `fixedAssets`, `expenses`, `assetCatOven`, `assetFinanceDepreciationTotalAnnual`, etc.
  - All i18n strings must go through `FINANCIAL_TRANSLATIONS[language][key]` via `tf()` function

- **Type definitions**: `src/types.ts` for Product, FixedAsset, FixedAssetMaintenance, SupplierInvoice types

- **Authentication**: All API calls require `Authorization: Bearer {token}` header via `getAuthHeaders()` from `src/lib/api-client.ts`

---

## Utility Data Model (Prisma)

### Schema (added 2026-05-24)
**Model**: `Utility` (lines 319–340 in schema.prisma)
- id: cuid
- type: String (enum values: ELECTRICITY, WATER, GAS, INTERNET, PHONE, OTHER)
- provider: String (e.g., "Sonelgaz", "ADE", "Djezzy")
- periodStart: DateTime — billing period start
- periodEnd: DateTime — billing period end
- amount: Float
- currency: String (default: "DZD")
- dueDate: DateTime (nullable) — payment due date
- paidAt: DateTime (nullable) — actual payment date
- status: String (auto-derived: PENDING, PAID, OVERDUE)
- invoiceNumber: String (nullable) — reference number from provider
- attachmentUrl: String (nullable) — URL to scanned bill/receipt
- notes: String (nullable) — internal notes
- createdAt, updatedAt: DateTime

### Indexes
- type, provider, status, createdAt (for filtering and sorting)

### API Routes (implemented 2026-05-24)

**Status Auto-Derivation**:
- If `paidAt` is set → status = PAID
- Else if `dueDate` < now → status = OVERDUE
- Else → status = PENDING

**CRUD Endpoints**:
- `GET /api/db/utilities` — list with filters (type, provider, status, date range via where/orderBy query params)
- `GET /api/db/utilities/{id}` — fetch single utility
- `POST /api/db/utilities` — create new utility (status auto-derived)
- `PUT /api/db/utilities/{id}` — update utility (status auto-derived on save)
- `DELETE /api/db/utilities/{id}` — delete utility

**Aggregation**:
- `GET /api/utilities/summary?month=MM&year=YYYY` — returns:
  - `total`: sum of amounts for the period
  - `byType`: grouped by type with totals and status breakdown
  - `utilities`: full utility list for the period

---

## For Utilities Feature Development

**No profitability utilities exist yet.** When building the utilities feature, you will likely need to:
1. Create margin calculation functions (product-level)
2. Create COGS (Cost of Goods Sold) aggregation
3. Add utilities for operating expense categorization (if expanding beyond today's raw materials / consumables split)
4. Possibly add utilities for financial ratio calculations (profit margin %, ROI, etc.)

All new utilities should:
- Be placed in `src/lib/` with appropriate naming (e.g., `profitabilityEngine.ts`, `costCalculations.ts`)
- Use `formatCurrency()` from LanguageContext for any output
- Use translation keys from `FINANCIAL_TRANSLATIONS` for any labels
- Keep files under 500 lines (per CLAUDE.md project rules)
