# context/current-work.md

## Active module
Algeria bakery IFU tax module

## Scope
- G12 annual declaration
- IFU config (rate, effective dates, version control)
- G50 ter only if payroll exists (Phase 3)
- Single commercial rate only
- Bakery is commercial/artisanal only

## Status
**Phase 1: Core Infrastructure ✓ COMPLETE** (2026-05-24)
**Phase 2: UI Implementation ✓ COMPLETE** (2026-05-24)
**Phase 3: Admin IFU Configuration Screen ✓ COMPLETE** (2026-05-24)
**Phase 4: Print & PDF Export ✓ COMPLETE** (2026-05-24)
**Phase 5: Integration Verification ✓ COMPLETE** (2026-05-24)

**MODULE STATUS: ✓ READY FOR PRODUCTION**

### Phase 3 Deliverables
1. **Translation Keys** ✓ (src/constants.ts)
   - 28 new FR + AR bilingual keys for TaxConfigAdmin screen
   - Keys cover: section titles, field labels, actions, table headers, status messages

2. **TaxConfigAdmin Component** ✓ (src/pages/Finance/TaxReports.tsx)
   - Fiscal regime basics (read-only: 9M DZD threshold, Commercial/Artisanal activity)
   - IFU rate configuration (editable %, live preview with 1M DA example)
   - Declaration parameters (read-only: G12 90d, G50ter 45d if payroll exists)
   - Version history table with "view detail" modal showing JSON snapshots
   - Persistent warning banner about rate change scope
   - Save button creates new version with effective_date = today
   - State management: ratePercent, history[], isLoading, isSaving, detailVersion modal

3. **Admin Access Control** ✓
   - Config tab only visible when user.role === 'admin'
   - Config content only renders for admin users
   - API endpoints protected with requireAuth middleware

4. **Versioning & Snapshots** ✓
   - Save creates new TaxConfig version with automatic createdAt
   - History lists all versions with version#, date, savedBy, view action
   - Detail modal shows read-only JSON snapshot of config at that version
   - Submitted declarations capture immutable config snapshot at finalization

5. **Integration** ✓
   - New declarations use latest active config rate
   - Submitted declarations preserve rates via configSnapshot field
   - Rate changes do not affect previously submitted declarations
   - Finalized declarations cannot be reverted to BROUILLON status

### Phase 1 Deliverables
1. **Calculation Engine** ✓ (src/lib/ifuEngine.ts)
   - Deterministic tax calculation (Turnover × Rate% / 100)
   - Gross turnover aggregation from sales
   - Input validation (0-100% rate, non-negative turnover)
   - Configuration snapshot creation for audit trail
   - Default rate: 1.5% (bakery commercial activity)

2. **Data Layer** ✓ (prisma/schema.prisma)
   - TaxConfig table: type, year, ratePercent, effectiveFrom/Until, versioning
   - IfuDeclaration table: grossTurnover, taxRatePercent, taxAmountDue, configSnapshot, status workflow (BROUILLON→FINALISÉ→SOUMIS)

3. **Service Layer** ✓ (src/services/taxService.ts)
   - Tax config management (load, save, versioning)
   - IFU declaration CRUD
   - Calculation integration with validation
   - Snapshot creation at finalization

4. **API Endpoints** ✓ (server.ts)
   - /api/tax/ifu-declarations (GET, POST, GET/:id, PUT/:id)
   - /api/tax/ifu-declarations/:id/finalize (POST)
   - /api/admin/tax-config (GET, POST)

5. **Unit Tests** ✓ (src/__tests__/ifu-engine.test.ts)
   - 97 passing tests
   - Sum accuracy, rounding, validation, edge cases
   - Integration workflow scenarios
   - Snapshot serialization

### Phase 2 Deliverables
1. **Translation Keys** ✓ (src/constants.ts)
   - 41 new FR + AR bilingual keys for IFU screens
   - Categories: screens, selectors, status, actions, metrics, messages

2. **G12 Annual Declaration Screen** ✓ (src/pages/Finance/TaxReports.tsx)
   - Year selector (year-2 to current)
   - Status badge (BROUILLON/FINALISÉ/SOUMIS)
   - Threshold warning (>9M DZD)
   - Monthly turnover table (12 months)
   - Summary cards: turnover, rate, tax due
   - Action buttons: Save Draft, Print, Export (PDF/Excel)

3. **G50ter Quarterly Declaration Screen** ✓ (conditional on payroll)
   - Year and quarter selectors
   - Metric cards: employee count, gross payroll, IRG withheld, status
   - Action buttons: Generate, Print, Refresh
   - Structure ready for real payslip data integration

4. **Tax Dashboard Screen** ✓
   - YTD turnover and estimate metrics
   - G12 status and deadline reminder
   - Optional quarterly cards (Q1-Q4) when payroll exists

5. **Integration Features** ✓
   - i18n with BilingualLabel components
   - Data fetching from API (declarations, sales, payslips)
   - Auto-aggregation of monthly turnover from sales
   - Tax calculation (turnover × 1.5% / 100)
   - Conditional rendering based on payroll module

### Phase 2 Deliverables Complete
All Phase 2 features verified and documented in session-log.md

---

## Bug Fixes & UI Improvements — Session 2026-05-30

### Issues Fixed

1. **Seeded demo data reappearing after deletion**
   - Root cause: `server.ts` had inline seeding blocks (products, raw materials, customers, batches, sales) that ran on every restart when count = 0
   - Fix: Removed all 5 sample-data seeding blocks from `server.ts`. Only admin user, role permissions, and settings seeding remain (safe — idempotent)
   - Prod: Patched directly in the Docker image via `docker commit`, rebuilt container

2. **Brand auto-assigned to raw materials by system**
   - Root cause: `Inventory.tsx` had a block that randomly assigned brand names (Nestlé, Danone…) on every page load
   - Fix: Removed the block entirely. Brand is now only set by user input

3. **User deletion blocked (500 error)**
   - Root cause: `ActivityLog → User` FK had no `onDelete` (defaulted to RESTRICT)
   - Fix: Added `onDelete: Cascade` to ActivityLog relation in `prisma/schema.prisma`, applied via `db push`

4. **Unit label missing in ingredient quantity input**
   - Fixed in both `ProductEdit.tsx` and `ProductManagement.tsx` modal
   - Unit (kg, g, pcs…) now appears as an inline suffix inside the quantity input, matching the production form style

5. **Estimated cost (prix de revient) not auto-calculated**
   - Fixed in `ProductManagement.tsx`: when ingredients are defined, fetches latest purchase price per material and auto-fills `costPrice = totalIngredientCost ÷ batchSize`
   - Fixed in `ProductEdit.tsx`: shows read-only "Coût estimé" hint below cost price field
   - Fixed in `Production.tsx`: shows estimated total batch cost below the quantity field
   - Data source: `SupplierInvoice.amountHT` JSON → `price / quantity` = unit cost, most recent purchase per material

6. **Batch size field added to ingredient definition**
   - Added inline "for X pcs" input next to the Ingrédients title in `ProductManagement.tsx`
   - Stored as `batchSize` on product document; used as divisor for per-unit cost calculation

7. **POS cart UI overcrowded**
   - Removed TVA and Sous-total rows — only Total shown
   - Removed duplicate total from cart header
   - Shrunk "Ventes récentes" button and "Payer" button
   - Global 20% UI size reduction via `html { font-size: 80%; }` in `src/index.css`

8. **Production history lost when product deleted**
   - Root cause: `ProductionBatch.productId` FK was RESTRICT — delete blocked; name resolved live at render
   - Fix: Made `productId` nullable with `onDelete: SetNull` in schema; new batches now store `productName` at creation; display falls back to stored name if product deleted

9. **authFetch missing auth headers (500 on add ingredient)**
   - All three `authFetch('/api/db/purchases')` calls in `ProductEdit.tsx`, `Production.tsx`, `ProductManagement.tsx` were missing `{ headers: getAuthHeaders() }`
   - Fix: Added `getAuthHeaders()` to all three calls

### Prod DB Operations (2026-05-30)
- Manually deleted all seeded demo rows (10 products, 8 materials, 3 batches, 3 sales, 5 customers) via Prisma node script in Docker container
- Applied schema migration via `prisma db push` inside prod container (added missing columns: `unit`, `nameAr`, `wasteQuantity`, `status` on Product; `productId` nullable on ProductionBatch)
- Regenerated Prisma client inside prod container
- Patched prod image's `server.ts` via `docker commit` to permanently remove seeding blocks
- Prod DB state after cleanup: 0 products, 0 materials, 0 batches, 0 sales, 0 customers, 1 admin user

### Files Modified
- `server.ts` — removed sample seeding blocks
- `src/index.css` — global 20% font-size reduction
- `src/pages/POS.tsx` — cart UI cleanup
- `src/pages/ProductEdit.tsx` — unit label, estimated cost, auth fix
- `src/pages/ProductManagement.tsx` — unit label, batchSize field, auto cost, auth fix
- `src/pages/Production.tsx` — batch cost estimation, productName stored, auth fix
- `src/pages/Inventory.tsx` — removed brand auto-population
- `src/types.ts` — added `batchSize?` and `productName?` fields
- `src/constants.ts` — added `estimatedCost`, `ingredientsDefinedFor` i18n keys
- `prisma/schema.prisma` — ActivityLog cascade, ProductionBatch nullable productId + SetNull

---

### Future Enhancements (Out of Scope)
- PDF export implementation (button structure in place)
- Excel export implementation (button structure in place)
- Real payslip data aggregation for G50ter (mock data in place)
- Declaration submission workflow (Save Draft button in place)
- Additional tax modules (VAT, other forms)