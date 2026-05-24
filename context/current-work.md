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
**Phase 1: Core Infrastructure ✓ COMPLETE**
**Phase 2: UI Implementation ✓ COMPLETE** (2026-05-24)
**Phase 3: Admin IFU Configuration Screen ✓ COMPLETE** (2026-05-24)

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

### Future Enhancements (Out of Scope)
- PDF export implementation (button structure in place)
- Excel export implementation (button structure in place)
- Real payslip data aggregation for G50ter (mock data in place)
- Declaration submission workflow (Save Draft button in place)
- Additional tax modules (VAT, other forms)