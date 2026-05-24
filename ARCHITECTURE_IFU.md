# Algeria Bakery IFU Declaration Module — Architecture & Specification

**Status:** Phase 0 Complete — Architecture & Analysis (No code written)  
**Date:** 2026-05-24  
**Module:** Tax Declarations (IFU, G12, G50-ter)  

---

## Executive Summary

This document specifies the architecture for an Algeria bakery tax compliance module covering:
- **IFU (Impôt Forfaitaire Unique):** Simplified single-rate tax declaration for commercial activity
- **G12 Annual Declaration:** Annual tax summary for the tax authority
- **G50-ter (Quarterly IRG):** Quarterly declaration of employee income tax withheld (only if payroll module exists)

The module integrates with existing **Payroll**, **Finance**, and **Sales** modules and leverages established patterns (config snapshots, journal entries, immutable audit trails).

---

## 1. EXISTING CODEBASE ANALYSIS

### 1.1 What Already Exists

#### **Payroll & IRG Computation**
- ✅ `src/lib/payrollEngine.ts` — Progressive IRG calculation with brackets, rebates, CNAS rates
- ✅ `src/types.ts` — PayrollConfig, IrgBracket, Payslip types with snapshot support
- ✅ `src/pages/Finance/Payroll.tsx` — Payroll UI with run creation, approval workflow
- ✅ Database schema: `PayrollRun`, `Payslip`, `FinancialEmployee` tables
- ✅ Default config: CNAS rates (9% employee, 26% employer), IRG brackets (0–35%), rebate cap (1,500 DA)
- ✅ Config versioning pattern: `PayrollRun.configSnapshot` (JSON at execution time)

#### **Finance Module Structure**
- ✅ `src/pages/Finance/index.tsx` — Tab-based layout (Dashboard, GL, Payroll, Expenses, Revenue, Tax Reports, Risk, Budget)
- ✅ `src/pages/Finance/TaxReports.tsx` — Placeholder tabs (TVA, G50, P&L)
- ✅ `src/services/financeService.ts` — API client for journal entries, balances, payroll
- ✅ Database schema: `Account`, `JournalEntry`, `JournalLine`, `Sale`, `SupplierInvoice`, `CustomerInvoice`
- ✅ Revenue tracking: `Sale` table with `totalAmount`, `paymentMethod`, `createdAt`
- ✅ Purchase tracking: `SupplierInvoice` with totals and amounts paid

#### **Sales & Revenue Data**
- ✅ `Sale` table: `totalAmount`, `paymentMethod`, `createdAt` — all sales recorded
- ✅ API endpoint: `/api/sales` — fetch all sales with filtering by date
- ✅ Revenue recognition: Sales treated as income, auto-journaled to GL if CASH payment

#### **G50 Integration (External)**
- ✅ `src/services/g50.client.ts` — HTTP client for external G50 service (push sales/purchase summaries, fetch declarations, download PDFs)
- ✅ Endpoints: `/api/v1/g50/source/sales-summary`, `/api/v1/g50/source/purchase-summary`, `/api/v1/g50/declarations`
- ⚠️ **Note:** G50 service is EXTERNAL — Bella Dolce will push data to it, not compute G50 locally

#### **Settings & Configuration**
- ✅ `Setting` table (id, data JSON string) — payroll_config stored here, accessible to admin
- ✅ Admin UI for payroll config (edit CNAS rates, IRG brackets, rebate cap)
- ✅ Bilingual UI: All user-facing strings in `src/constants.ts` (FR + AR + EN)

#### **Audit & Immutability**
- ✅ `ActivityLog` table — all user actions logged with timestamp, user, action, details
- ✅ `JournalEntry` → `BROUILLON` → `APPROUVÉ` → `COMPTABILISÉ` workflow (immutable once approved)
- ✅ `PayrollRun.status` — `BROUILLON` → `CALCULÉ` → `VÉRIFIÉ` → `APPROUVÉ` workflow

#### **PDF/Export**
- ✅ `src/lib/export.ts` — Payslip PDF generation (`downloadPayslipPdf`)
- ✅ Thermal receipt printing implemented (Xprinter D200)
- ✅ Pattern: async PDF generation with error handling

### 1.2 What Is Missing for IFU Compliance

#### **Core IFU Module**
- ❌ `IfuDeclaration` table — store annual/quarterly declarations with status, metadata, config snapshot
- ❌ `IfuLineItem` table — breakdown of revenue by rate (if multi-rate needed), adjustments
- ❌ Quarterly G50-ter submission tracking (if payroll exists)
- ❌ IFU calculation engine — turnover → tax computation
- ❌ Tax rate configuration storage — currently hardcoded in module logic (MUST BE CONFIGURABLE)

#### **Turnover Aggregation**
- ❌ Service to calculate gross turnover (chiffre d'affaires) from sales for a period
- ❌ Logic to exclude returns, refunds, or zero-value transactions
- ❌ Multi-activity filtering (bakery is commercial only, no services)

#### **G12 Annual Declaration**
- ❌ G12 generation logic (name, NIF, turnover, tax amount, signatures)
- ❌ G12 storage (immutable record with date, user, metadata)
- ❌ G12 PDF export template

#### **G50-ter Quarterly IRG (Payroll Dependency)**
- ❌ Query to aggregate IRG withheld from payroll runs in a quarter
- ❌ G50-ter generation logic (employee list, IRG amounts, employer declaration)
- ❌ G50-ter storage (immutable, quarterly)

#### **Submission & History**
- ❌ Declaration submission workflow (draft → finalized → submitted)
- ❌ Audit trail (who finalized, when, with which rates/snapshot)
- ❌ Re-declaration support (e.g., corrective amendments)
- ❌ Version/amendment tracking

#### **UI Components**
- ❌ IFU dashboard — current year YTD turnover, estimated tax, submission status
- ❌ Annual G12 form — input validation, PDF preview, submission button
- ❌ Quarterly G50-ter view (payroll dependent)
- ❌ Declaration history archive — view past declarations, download PDFs
- ❌ Tax rate admin panel — edit single IFU rate, versioning UI

#### **API Endpoints**
- ❌ `/api/tax/turnover-summary` — GET turnover for a period
- ❌ `/api/tax/ifu-declarations` — GET/POST/PUT declarations
- ❌ `/api/tax/ifu-declarations/:id` — GET single declaration, finalize, submit
- ❌ `/api/tax/ifu-declarations/:id/pdf` — Download G12 PDF
- ❌ `/api/tax/g50ter-declarations` — GET/POST quarterly IRG declarations (if payroll exists)
- ❌ `/api/admin/tax-config` — GET/PUT IFU tax rate

---

## 2. BUSINESS REQUIREMENTS

### 2.1 Bakery Context

**Activity Type:** Commercial / Artisanal (Boulangerie-Pâtisserie)  
**Tax Regime:** IFU (Impôt Forfaitaire Unique) — Simplified Single-Rate Tax  
**Revenue Source:** Sales of bread, pastries, cakes, traiteur (commercial activity ONLY)

### 2.2 IFU Fundamentals

**IFU Rate:** Single flat-rate percentage applied to gross turnover (chiffre d'affaires)
- **2024–2026 Rate:** Typically 1–3% depending on activity sector (bakery: ~1.5–2%)
- **Turnover Threshold:** Businesses under ~50M DA turnover qualify for simplified IFU
- **Bella Dolce Context:** Single-rate commercial activity; no mixed activity, no services

### 2.3 G12 Annual Declaration

**Scope:** Annual tax summary submitted to tax authority (fiscal authority)  
**Timing:** Due after fiscal year-end (typically by March 31)  
**Contents:**
- Taxpayer identity (NIF, company name, address)
- Gross turnover (chiffre d'affaires total)
- IFU tax computed (turnover × rate)
- Signed declaration

**Immutability:** Once submitted, G12 is locked for audit/compliance. Corrections via amendment (G12-bis).

### 2.4 G50-ter (Quarterly IRG Payroll Declaration)

**Scope:** Quarterly aggregated withholding of IRG (Impôt sur le Revenu Global) from employee salaries  
**Requirement:** Only if bakery has salaried employees  
**Timing:** Quarterly submission (M+30 days after quarter end)  
**Contents:**
- Employer identity (NIF)
- Employee list (name, NIN, gross salary, IRG withheld)
- Total IRG remitted to tax authority
- Employer signature

**Dependency:** Requires active payroll module with finalized payroll runs.

---

## 3. DATA MODEL

### 3.1 New Tables Required

```sql
-- IFU Annual Declaration
CREATE TABLE IfuDeclaration (
  id                   STRING PRIMARY KEY,
  year                 INT,                    -- Fiscal year (e.g. 2026)
  grossTurnover        FLOAT,                  -- Chiffre d'affaires (from sales)
  taxRatePercent       FLOAT,                  -- IFU rate % (e.g. 1.5)
  taxAmountDue         FLOAT,                  -- Computed: turnover × rate
  
  -- Audit & Versioning
  configSnapshot       STRING,                 -- JSON: { taxRatePercent, ... } at finalization
  status               STRING DEFAULT "BROUILLON",  -- BROUILLON | FINALISÉ | SOUMIS | REJÉT
  
  -- Submission Tracking
  finalizedBy          STRING,                 -- Admin who locked declaration
  finalizedAt          DATETIME,               -- When locked (immutable after this)
  submittedAt          DATETIME,               -- When sent to tax authority (if applicable)
  submissionReference  STRING,                 -- Tax authority reference/receipt
  
  -- Corrections
  amendmentOf          STRING,                 -- If correction of prior year, link to original
  
  createdAt            DATETIME DEFAULT NOW(),
  updatedAt            DATETIME,
  
  UNIQUE(year)                                 -- One declaration per year
);

-- G50-ter Quarterly IRG Declaration (Payroll-dependent)
CREATE TABLE G50terDeclaration (
  id                   STRING PRIMARY KEY,
  year                 INT,                    -- Fiscal year
  quarter              INT (1-4),              -- Q1, Q2, Q3, Q4
  grossPayroll         FLOAT,                  -- Total gross salaries paid
  totalIrgWithheld     FLOAT,                  -- Total IRG retained from payroll
  employeeCount        INT,                    -- Number of employees
  
  -- Line items (stored as JSON or separate table)
  lineItems            STRING,                 -- JSON: [{ employeeId, name, nin, grossSalary, irgRetained }]
  
  status               STRING DEFAULT "BROUILLON",
  configSnapshot       STRING,                 -- Payroll config at time of quarter
  
  finalizedBy          STRING,
  finalizedAt          DATETIME,
  submittedAt          DATETIME,
  submissionReference  STRING,
  
  createdAt            DATETIME DEFAULT NOW(),
  updatedAt            DATETIME,
  
  UNIQUE(year, quarter)
);

-- IFU Tax Configuration (replaces hardcoded rate)
CREATE TABLE TaxConfig (
  id                   STRING PRIMARY KEY,
  type                 STRING,                 -- "IFU_RATE"
  year                 INT,                    -- Applicable year (or NULL for default)
  ratePercent          FLOAT,                  -- e.g. 1.5 for 1.5%
  description          STRING,                 -- e.g. "2026 IFU rate for bakery (commercial)"
  
  effectiveFrom        DATE,
  effectiveUntil       DATE,
  
  createdBy            STRING,
  createdAt            DATETIME DEFAULT NOW(),
  updatedAt            DATETIME,
  
  UNIQUE(type, year)
);
```

### 3.2 Updated Existing Tables

**Setting table:**
- Add `tax_config` entries for versioned IFU rates (alongside `payroll_config`)
- Admin panel to edit and version tax rates

**IfuDeclaration & G50terDeclaration:**
- Link to `JournalEntry` (when declaration is finalized, optionally post journal entries)
- Link to `ActivityLog` for audit trail (finalized by, submitted by, amendments)

---

## 4. CALCULATION LOGIC

### 4.1 Turnover Aggregation (Revenue Input)

**Source:** `Sale` table, filtered by period and status

```typescript
function calculateGrossTurnover(startDate: Date, endDate: Date): number {
  // 1. Sum all Sales in period where:
  //    - createdAt >= startDate AND createdAt < endDate
  //    - status = "completed" (or always completed in this system)
  //    - paymentMethod in ["cash", "card", "mobile", "transfer"]
  //    - totalAmount > 0
  
  // 2. Exclude:
  //    - Returns/refunds (if returnComment is set, consider discount rule)
  //    - Cancelled orders
  //    - Zero-value test transactions
  
  // 3. Return SUM(totalAmount)
  const sales = await db.sales.findMany({
    where: {
      createdAt: { gte: startDate, lt: endDate },
    },
  });
  
  return sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
}
```

### 4.2 IFU Tax Calculation

```typescript
function calculateIfuTax(
  grossTurnover: number,
  taxRatePercent: number
): number {
  // IFU = Turnover × (Rate % / 100)
  return Math.round(grossTurnover * (taxRatePercent / 100) * 100) / 100;
  // Round to 2 decimals (DZD cents)
}
```

### 4.3 G50-ter Aggregation (Payroll Input)

**Source:** `Payslip` table in completed `PayrollRun`s

```typescript
function aggregateG50terForQuarter(
  year: number,
  quarter: 1 | 2 | 3 | 4
): {
  employeeCount: number;
  grossPayroll: number;
  totalIrgWithheld: number;
  lineItems: Array<{
    employeeId: string;
    name: string;
    nin: string;
    grossSalary: number;
    irgRetained: number;
  }>;
} {
  // 1. Determine quarter months:
  //    Q1: Jan, Feb, Mar  (months 1-3)
  //    Q2: Apr, May, Jun  (months 4-6)
  //    etc.
  
  // 2. Find all PayrollRun(s) for those months where status = "APPROUVÉ"
  
  // 3. For each Payslip in those runs:
  //    - Extract employeeId, name, nin
  //    - Sum grossSalary (per employee)
  //    - Sum irgRetained (per employee)
  
  // 4. Return aggregates
}
```

---

## 5. WORKFLOW & STATUS TRANSITIONS

### 5.1 G12 Annual Declaration Workflow

```
┌─────────────┐
│  BROUILLON  │  (Draft) — auto-calculated, not finalized
│             │  • User views YTD turnover, estimated tax
│             │  • Can edit if rate needs correction
└──────┬──────┘
       │
       │ [Admin: Finalize Button]
       ↓
┌─────────────┐
│ FINALISÉ    │  (Locked) — immutable after this
│             │  • Config snapshot stored
│             │  • User signs/approves
└──────┬──────┘
       │
       │ [Admin: Submit Button]
       ↓
┌─────────────┐
│  SOUMIS     │  (Submitted to tax authority)
│             │  • Submission reference recorded
│             │  • PDF archived
└─────────────┘

[OPTIONAL]
       ↓
┌─────────────┐
│   REJÉT     │  (Returned for correction)
└─────────────┘
```

### 5.2 G50-ter Quarterly Declaration Workflow

Same as G12, but:
- **Trigger:** Auto-generated after quarter end when payroll runs finalized
- **Status:** `BROUILLON` → `FINALISÉ` → `SOUMIS`
- **Dependency:** Requires ≥ 1 approved payroll run in quarter

### 5.3 Amendment/Correction

If G12 is rejected or amendment required:
1. Create new `IfuDeclaration` with `year = same`, `amendmentOf = original.id`
2. Set status to `BROUILLON` again
3. User corrects and re-finalizes
4. Both original and amendment retained in audit trail

---

## 6. CONFIGURATION & ADMIN PANEL

### 6.1 Tax Rate Management

**Admin Interface (new page or section in Finance > Admin):**

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| **IFU Tax Rate (%)** | Float | 1.5 | Configurable, versioned |
| **Effective From** | Date | auto | When rate takes effect |
| **Description** | Text | "2026 IFU rate" | Free text, audit trail |
| **Actions** | Button | — | Save, Version History |

**Backend:**
- Store in `TaxConfig` table with year and effective dates
- Admin can view/edit rates via `/api/admin/tax-config`
- Rate change creates new row, old rate remains in history (immutable)
- When finalizing IFU declaration, snapshot the rate used

### 6.2 Payroll Config Dependencies

- G50-ter requires payroll config snapshot (CNAS rates, IRG brackets)
- If payroll not configured, G50-ter tab shows "Not enabled" message

---

## 7. REPORTING & PDF EXPORTS

### 7.1 G12 Annual Declaration PDF

**Template:**
```
┌─────────────────────────────────────┐
│     DÉCLARATION ANNUELLE (G12)      │
│   Impôt Forfaitaire Unique (IFU)    │
└─────────────────────────────────────┘

DÉCLARANT
─────────
Nom:         [Company Name from config]
NIF:         [NIF from User/config]
RC:          [RC from User/config]
Adresse:     [Address from config]

DÉCLARATION
──────────
Année Fiscale:  2026
Chiffre d'Affaires Total: 15,450,000.00 DA
Taux IFU (%):   1.5%
Impôt Dû:       231,750.00 DA

SIGNATURES
─────────
Déclarant: _______________    Date: _______________
Responsable Admin: ________    Date: _______________

Référence: 2026-001-IFU-G12
Date de Finalisation: 2026-12-31 10:30 AM
```

**Implementation:**
- Use `src/lib/export.ts` pattern (pdfkit or similar)
- Bilingual (FR + AR) support
- Immutable once finalized (download only, no edit)

### 7.2 G50-ter Quarterly Declaration PDF

Similar structure, but tabular employee listing:

```
Trimestre Q1 2026 (Jan–Mar)

LISTE DES SALARIÉS
───────────────────
Nom          | NIN       | Salaire | IRG Retenu
─────────────┼───────────┼─────────┼────────────
Ali Dupont   | 12345678  | 50,000  | 2,500
Marie Ahmed  | 87654321  | 45,000  | 2,100
...

TOTAL TRIMESTRE
───────────────
Nombre salariés:  15
Masse Salariale:  750,000.00 DA
IRG Total Retenu: 35,250.00 DA
```

---

## 8. API ENDPOINTS SPECIFICATION

### 8.1 IFU Declarations

```
GET /api/tax/ifu-declarations?year=2026
  → List all IFU declarations for year (including amendments)
  → Response: [{ id, year, grossTurnover, taxRatePercent, taxAmountDue, status, ... }]

POST /api/tax/ifu-declarations
  → Create new IFU declaration (auto-calculated from sales)
  → Body: { year: INT }
  → Response: { id, grossTurnover, taxAmountDue, status: "BROUILLON", ... }

GET /api/tax/ifu-declarations/:id
  → Fetch single declaration
  → Response: { id, year, grossTurnover, ..., configSnapshot, lineItems: [] }

PUT /api/tax/ifu-declarations/:id
  → Update draft declaration (e.g., correct rate if needed)
  → Body: { taxRatePercent?: FLOAT, notes?: STRING }
  → Only allowed if status = "BROUILLON"

POST /api/tax/ifu-declarations/:id/finalize
  → Lock declaration (immutable, snapshot config)
  → Body: { approvedBy: STRING (user ID) }
  → Transitions: BROUILLON → FINALISÉ

POST /api/tax/ifu-declarations/:id/submit
  → Submit to tax authority (if applicable)
  → Body: { submissionReference?: STRING }
  → Transitions: FINALISÉ → SOUMIS

GET /api/tax/ifu-declarations/:id/pdf
  → Download G12 PDF
  → Response: Binary PDF file

GET /api/tax/turnover-summary?startDate=2026-01-01&endDate=2026-12-31
  → Calculate gross turnover from sales
  → Response: { startDate, endDate, grossTurnover, transactionCount, ... }
```

### 8.2 G50-ter Declarations

```
GET /api/tax/g50ter-declarations?year=2026
  → List quarterly declarations
  → Response: [{ id, year, quarter, totalIrgWithheld, status, ... }]

POST /api/tax/g50ter-declarations
  → Auto-generate from payroll runs
  → Body: { year: INT, quarter: 1-4 }
  → Response: { id, employeeCount, grossPayroll, totalIrgWithheld, status: "BROUILLON" }

GET /api/tax/g50ter-declarations/:id
  → Fetch single quarterly declaration
  → Response: { id, year, quarter, lineItems: [{ employeeId, name, nin, grossSalary, irgRetained }], ... }

POST /api/tax/g50ter-declarations/:id/finalize
  → Lock quarterly declaration
  → Transitions: BROUILLON → FINALISÉ

POST /api/tax/g50ter-declarations/:id/submit
  → Submit quarterly report

GET /api/tax/g50ter-declarations/:id/pdf
  → Download G50-ter PDF
```

### 8.3 Tax Configuration (Admin)

```
GET /api/admin/tax-config?type=IFU_RATE&year=2026
  → Fetch current or historical tax rates
  → Response: [{ id, type, year, ratePercent, effectiveFrom, effectiveUntil, description }]

POST /api/admin/tax-config
  → Add new tax rate (versioning)
  → Body: { type: "IFU_RATE", year: INT, ratePercent: FLOAT, description: STRING, effectiveFrom: DATE }
  → Response: { id, createdAt, createdBy }

GET /api/admin/tax-config/history
  → View all rate changes (audit trail)
  → Response: [{ ...taxConfig records with timestamps }]
```

---

## 9. UI COMPONENTS (NEW)

### 9.1 IFU Dashboard Tab (in Finance > Tax Reports)

**Sub-tabs:**
1. **IFU Annual** — Current year YTD summary
   - Gross turnover (live from sales)
   - Tax rate (current configured rate)
   - Estimated IFU due
   - Declaration status
   - Action buttons: "New G12", "View History", "Finalize"

2. **G50-ter Quarterly** (if payroll enabled)
   - Q1, Q2, Q3, Q4 status
   - Gross payroll, IRG withheld
   - Employee count
   - Action: "Finalize", "Submit"

3. **Declaration History**
   - Table: Year, Type (G12 / G50-Q1 / G50-Q2), Status, Finalized Date, Actions
   - Actions: View PDF, Re-download, Amend (if applicable)

### 9.2 Admin Tax Rate Panel (new)

**Location:** Settings > Financial Config (or Finance > Admin)

**Sections:**
- **Current IFU Rate**
  - Display current effective rate
  - Edit button → form (year, rate %, effective date, description)
  - Save creates versioned entry

- **Rate History**
  - Timeline or table of all rate changes
  - Shows who changed it, when, from/to values

### 9.3 G12 Form Modal

**Trigger:** Click "Finalize G12" on IFU dashboard

**Fields:**
- Year (read-only, auto-filled)
- Gross Turnover (read-only, from sales calc)
- IFU Rate % (read-only, from TaxConfig)
- Tax Amount Due (read-only, computed)
- Approved By (dropdown: current user, pre-filled)
- Checkbox: "I confirm this declaration is accurate"

**Actions:**
- Cancel
- Finalize (transition to FINALISÉ, lock, snapshot config)

### 9.4 Declaration Details & PDF View

**After finalization:**
- Display declaration as read-only view
- Show all fields (with snapshot config visible)
- "Download PDF" button
- Amendment link (if needed)

---

## 10. IMPLEMENTATION PHASES

### Phase 1: Core IFU Infrastructure (2–3 days)
**Scope:** Backend data model, calculation engine, API endpoints

1. Create `IfuDeclaration` and `TaxConfig` tables
2. Implement turnover aggregation logic
3. Implement IFU calculation (turnover × rate)
4. Add `/api/tax/ifu-declarations` CRUD endpoints
5. Add `/api/admin/tax-config` endpoints
6. Unit tests: Turnover calc, tax calculation, status transitions
7. **No UI yet**

### Phase 2: IFU UI & PDF Export (2–3 days)
**Scope:** Frontend forms, dashboard, PDF generation

1. Add IFU dashboard tab to Finance > Tax Reports
2. Build G12 form modal (finalize workflow)
3. Implement G12 PDF export
4. Build admin tax rate panel
5. Build declaration history view
6. E2E tests: Create declaration → finalize → download PDF

### Phase 3: G50-ter Payroll Integration (2–3 days) [CONDITIONAL]
**Scope:** Quarterly payroll tax reporting (only if payroll module actively used)

1. Create `G50terDeclaration` and line items
2. Implement quarterly IRG aggregation from payroll runs
3. Add `/api/tax/g50ter-declarations` CRUD endpoints
4. Auto-generate G50-ter after payroll run approval
5. G50-ter PDF export
6. G50-ter UI (quarterly view, finalize, submit)
7. Tests: Quarter aggregation, payroll-to-g50ter flow

### Phase 4: Audit Trail & Amendment Support (1–2 days) [POLISH]
**Scope:** Compliance features (optional, can defer)

1. Link declarations to `ActivityLog` (who finalized, when)
2. Amendment workflow (create new declaration, link to original)
3. Submission reference tracking
4. History archive view
5. Tests: Amendment flow, audit trail integrity

---

## 11. FILES TO CREATE/MODIFY

### New Files
```
src/
  pages/Finance/
    ├─ IfuDashboard.tsx           (new) Main IFU/G12 view
    ├─ G12Form.tsx                (new) Finalize G12 modal
    ├─ DeclarationHistory.tsx      (new) View past declarations
  pages/Admin/
    ├─ TaxConfiguration.tsx        (new) Edit IFU rates
  lib/
    ├─ ifuEngine.ts               (new) Turnover calc, IFU tax calc
    ├─ g50Engine.ts               (new) G50-ter aggregation [Phase 3]
  services/
    ├─ taxService.ts              (new) API client for tax endpoints
  __tests__/
    ├─ ifu-engine.test.ts         (new) Unit tests
    ├─ g50-engine.test.ts         (new) Unit tests [Phase 3]

prisma/
    schema.prisma                  (modify) Add IfuDeclaration, TaxConfig tables
```

### Modified Files
```
src/
  types.ts                         (add IFU types)
  constants.ts                     (add FR/AR strings for IFU, tax config)
  pages/Finance/
    index.tsx                      (add IFU tab to Finance)
    TaxReports.tsx                 (replace G50 placeholder with IfuDashboard)
  server.ts                        (add /api/tax/* routes)
  
BRD.md                            (update with IFU section and test coverage)
```

---

## 12. DATA MIGRATION & SEED

**Current State:**
- Sales table has all transactions with totalAmount, createdAt
- PayrollRun & Payslip tables have complete history
- No IfuDeclaration or TaxConfig records yet

**On Deploy:**
1. Run migration: Create `IfuDeclaration`, `TaxConfig`, `G50terDeclaration` tables
2. Seed `TaxConfig` with 2026 IFU rate (e.g., 1.5%)
3. Optional: Backfill IfuDeclaration for 2024, 2025 (if needed for historical audit)

---

## 13. CONFIGURATION SNAPSHOT PATTERN

All declarations store a **config snapshot** at time of finalization (same pattern as PayrollRun):

```typescript
// At finalize time:
const snapshot = {
  taxRatePercent: 1.5,
  rateDateEffective: "2026-01-01",
  description: "2026 IFU rate for bakery (commercial)",
  finalizationDate: new Date().toISOString(),
  system: "bella-dolce-v2.1",
};

// Store as JSON in IfuDeclaration.configSnapshot
```

**Rationale:** If tax rate changes mid-year, declaration always shows the rate that WAS in effect, immutable.

---

## 14. AUDIT & COMPLIANCE RULES

1. **Immutability After Finalization:** Once `IfuDeclaration.status = "FINALISÉ"`, no field changes (except amendments)
2. **Config Snapshot:** Every finalized declaration includes snapshot of tax rate/settings at that time
3. **Activity Logging:** Every status transition logged to `ActivityLog` (finalized by, submitted by, etc.)
4. **Amendment Chain:** If amended, both original and amendment kept; marked with `amendmentOf` link
5. **PDF Archival:** PDF download includes data hash for tamper detection (optional, future)

---

## 15. TESTING STRATEGY

### Unit Tests (src/__tests__/)
- Turnover calculation (sum sales, exclude returns/voids)
- IFU tax calculation (turnover × rate)
- Quarterly aggregation (IRG from payroll)
- Status transitions (valid/invalid flows)
- Config snapshot serialization

### Integration Tests
- Create IFU declaration from sales data
- Finalize with rate snapshot
- Fetch declaration and validate snapshot
- Amendment workflow

### E2E Tests (Playwright)
- Navigate to Finance > IFU
- Create and finalize G12
- Download PDF
- View declaration history
- [Phase 3] Create G50-ter from payroll
- [Phase 3] Finalize and submit quarterly

---

## 16. ASSUMPTIONS & CONSTRAINTS

1. **Single Activity:** Bakery is commercial only (no services, no mixed activity)
2. **Tax Rate Stability:** Rate typically doesn't change mid-year (but versioned for future changes)
3. **Payroll Optional:** G50-ter only if payroll module is in use; gracefully disabled otherwise
4. **External G50 Service:** Actual G50 submission may be delegated to external platform (not implemented locally)
5. **NIF/RC Required:** Bakery must have NIF and RC configured in User/Company settings to finalize declarations
6. **PDF Mandatory:** All finalized declarations must generate a PDF (archival requirement)
7. **Audit Trail:** All modifications logged; admins can view history but not modify past declarations

---

## 17. RISK MITIGATION

| Risk | Mitigation |
|------|------------|
| **Rate changes mid-year** | Config snapshot at finalization; versioned TaxConfig table |
| **Sales data inaccuracy** | Validate sales total against GL (journal entries) |
| **Payroll data lag** | G50-ter only auto-generated after payroll run finalized |
| **PDF corruption** | Store date/hash in DB; re-generate from snapshot if needed |
| **Accidental submission** | Require explicit "Submit" action (not automatic) |
| **User error (wrong rate)** | Admin can create amendment; original stays immutable |

---

## 18. FUTURE ENHANCEMENTS (Out of Scope v1)

- **Multi-activity support** (if bakery adds services)
- **Advanced validation** (cross-check sales ↔ GL accounts)
- **Automatic submission** (push to external G50 platform)
- **Quarterly estimates** (forecast YTD tax based on current rate)
- **Deductions/adjustments** (if tax regime allows)
- **Multi-branch** (if Bella Dolce expands)
- **Notifications** (email reminders for submission deadlines)
- **Tax calendar** (annually repeat reminders for G12, quarterly for G50-ter)

---

## 19. GLOSSARY

| Term | Definition |
|------|-----------|
| **IFU** | Impôt Forfaitaire Unique — Simplified flat-rate tax |
| **G12** | Annual tax declaration form |
| **G50-ter** | Quarterly IRG withholding declaration |
| **Chiffre d'Affaires** | Gross turnover / total revenue |
| **NIF** | National Identification Number (tax ID) |
| **RC** | Business registration number |
| **IRG** | Impôt sur le Revenu Global — Income tax |
| **CNAS** | Social security contribution |
| **Finalisé** | Locked/approved (immutable) |
| **Soumis** | Submitted to tax authority |

---

**End of Specification Document**

---

## SUMMARY TABLE: Existing vs. Missing Functionality

| Component | Existing | Missing | Status |
|-----------|----------|---------|--------|
| Sales Revenue Tracking | ✅ Sale table | — | Ready |
| Payroll & IRG Calc | ✅ Engine, UI, DB | — | Ready |
| Config Management | ✅ Setting pattern | ❌ TaxConfig table | Need to add |
| IFU Calculation | ❌ | ✅ Engine, API, UI | **To build** |
| G12 Annual Form | ❌ | ✅ Form, PDF, API | **To build** |
| G50-ter Quarterly | ❌ | ✅ Aggregation, Form, PDF, API | **To build (Phase 3)** |
| Declaration History | ❌ | ✅ View, Archive | **To build** |
| Admin Tax Config | ❌ | ✅ Panel, Versioning | **To build** |
| PDF Export | ✅ Pattern (payslip) | ✅ G12, G50-ter templates | **To customize** |

