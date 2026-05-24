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

## UI Implementation Pages (2026-05-24)

### List page
`src/pages/Finance/Utilities.tsx` — Tab in Finance module:
- Table: Provider | Type | Period | Amount | Status badge | Due date | Actions (Edit/Delete)
- Filters: Type (all + 6 enum values), Month picker, Year, Status
- "Add Utility" button top-right
- Monthly total card at top

### Form (Modal)
`src/pages/Finance/UtilitiesForm.tsx` — Modal form component:
- Create: `useFormOpen()` + `setEditingId(null)` opens modal
- Edit: `setEditingId(id)` opens modal with populated data
- Type dropdown (6 values), Provider (with autocomplete from past entries)
- Period start / Period end (date pickers)
- Amount input
- Due date picker (optional)
- Mark as paid checkbox (sets paidAt = now)
- Invoice number input
- Notes textarea
- Submit calls POST /api/db/utilities or PUT /api/db/utilities/{id}

---

## Profitability Engine (2026-05-24)

### Implementation
**File**: `src/lib/profitabilityEngine.ts` (created 2026-05-24)

**Main function**: `calculateProfitability(sales, invoices, utilities, period) → ProfitabilityMetrics`
```typescript
interface ProfitabilityMetrics {
  revenue: number;           // Sum of sales.totalAmount in period
  cogs: number;              // Sum of invoices.totalAmount (Cost of Goods Sold from purchases)
  grossProfit: number;       // Revenue - COGS
  opex: number;              // Operating Expenses (utilities total)
  operatingProfit: number;   // Gross Profit - OpEx (EBIT)
  utilities: number;         // Utilities total for period
}
```

**Accounting rules**:
- **Revenue**: From sales API (POS transactions)
- **COGS**: From supplier invoices (purchased materials)
- **Gross Profit**: Revenue - COGS
- **OpEx**: Sum of utilities.amount for the period (operating expenses)
- **Operating Profit (EBIT)**: Gross Profit - OpEx
- **Shop rent**: NOT included (property is owned)

### Dashboard Integration (2026-05-24)
**File**: `src/pages/Finance/FinancialDashboard.tsx` (updated 2026-05-24)

**Changes**:
- Imports `calculateProfitability` from profitabilityEngine
- Fetches utilities via `/api/db/utilities` endpoint
- Calculates profitability metrics on period change
- Displays 4 main KPI cards:
  1. Revenue (emerald)
  2. COGS (red) — replaces "expenses" to clarify cost structure
  3. Gross Profit (blue)
  4. Operating Profit / EBIT (purple)
- Displays secondary metrics:
  1. OpEx card — shows total operating expenses + utilities breakdown
  2. Risk Score card (preserved)

### i18n Keys (2026-05-24)
**File**: `src/constants.ts` (added translations)

**French keys** (line 2031–2036):
- `grossProfit`: "Résultat brut"
- `operatingProfit`: "Résultat opérationnel (EBIT)"
- `cogs`: "Coût d'achat des matières"
- `opex`: "Dépenses opérationnelles"
- `utilitiesCosts`: "Services généraux"

**Arabic keys** (added at equivalent offset in ar section):
- `grossProfit`: "إجمالي الربح"
- `operatingProfit`: "الربح التشغيلي (EBIT)"
- `cogs`: "تكلفة البضائع المباعة"
- `opex`: "المصاريف التشغيلية"
- `utilitiesCosts`: "المرافق والخدمات"

### Cross-links (2026-05-24)

### Spending view
**Location**: `src/pages/Finance/Expenses.tsx` (lines 417-424)
- Added "Utilities" link that navigates to `/finance?tab=utilities`
- Link is styled as a tab alongside "Invoices" and "Assets" tabs
- Users can click to jump directly to utilities tracking without mixing records in Expenses table

### Finance Dashboard
**Location**: `src/pages/Finance/FinancialDashboard.tsx` (lines 248-268)
- OpEx card displays monthly operating expenses total
- Secondary line shows utilities costs breakdown: `{tf('utilitiesCosts')}: {formatCurrency(profitability?.utilities ?? 0)}`
- Hover tooltip: "Utilities are tracked separately under Finance > Utilities"

### Monthly P&L Report
**Location**: `src/pages/Finance/TaxReports.tsx` (lines 118–177)
- Added new P&L sub-tab alongside TVA and G50 reports
- Features:
  - Month/year selector for period filtering
  - KPI cards: Revenue, COGS, Gross Profit
  - P&L summary table: Revenue → COGS → Gross Profit → OpEx → Operating Profit
  - **Utilities breakdown section** (lines 167–177):
    - Displays total per type (Electricity, Water, Gas, Internet, Phone, Other)
    - Sorted by highest cost first
    - Total utilities row with all services summed
- i18n keys: `profitLoss`, `utilitiesBreakdown`, `total`, `utilitiesTrackedSeparately`

## Reports Status
- **P&L Statement** (implemented 2026-05-24)
- **Monthly Summary** (pending future enhancement)
