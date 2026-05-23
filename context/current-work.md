# Current Work: Algeria Payroll / Salary Slip Module

## Goal
Upgrade the existing salary slip / payroll functionality in the app because the current implementation is limited and inaccurate.

## Scope
- Algeria payroll logic (correct IRG brackets, CNAS rates)
- Salary slip generation
- Accurate deductions and formulas
- Bilingual French/Arabic labels and print template
- Admin-configurable payroll rates and IRG settings
- Full integration into existing app patterns

## Constraints
- Existing app already has payroll/salary functionality — must audit before changing
- Do not assume existing table names or field names (read first)
- Validated payslips must be immutable after approval
- Historical calculations must preserve the config rates applied at generation time

## Delivery phases
1. Analysis & architecture ✅ Done (session 1)
2. Specification ✅ Done (session 2) — see session-log.md
3. Calculation/configuration engine (Phase 2a)
4. Schema migration + service/API updates (Phase 2b + 3)
5. Admin config UI (Phase 4)
6. Print/PDF template update (Phase 5)
7. Integration and QA (Phase 6)

## Confirmed decisions (session 2)
- **Config snapshot**: Option A — add `configSnapshot String?` to `PayrollRun` via Prisma migration
- **Transport allowance**: excluded from CNAS calculation base (`transportExempt: true` is the default and fixed)
- IRG brackets: Algeria 2024, five bands (0%/20%/26%/30%/35%), 40% rebate capped at 1 500 DA/month
- Employer info (NIF, NIS, RC, CNAS reg) will be stored in `payroll_config` Setting, not hardcoded
- Arabic RTL payslip variant required in `downloadPayslipPdf()`

---

## Architecture audit (completed session 1)

### Key files for this module
| File | Role |
|---|---|
| `src/pages/Finance/Payroll.tsx` | Full payroll UI (employees, runs, payslip print modal) |
| `src/services/financeService.ts` | `calculatePayroll()`, CRUD for employees/runs/payslips |
| `src/lib/export.ts` | `downloadPayslipPdf()` — HTML→canvas→jsPDF |
| `src/types.ts` | `FinancialEmployee`, `PayrollRun`, `Payslip` interfaces |
| `prisma/schema.prisma` | `FinancialEmployee`, `PayrollRun`, `Payslip`, `Setting` models |
| `server.ts` | Generic CRUD via `getModel()` map; `payrollRuns`, `payslips`, `financialEmployees` all routed under `/finance` |

### Schema facts (do not re-derive)
- `FinancialEmployee`: `baseSalary`, `transportAllowance`, `performanceBonus`, `otherAllowances`, `contributesToCNAS` (Boolean), `matricule`, `nin`, `cnasNumber`, `bankRIB`, `status` (`ACTIF`/…)
- `PayrollRun`: `period` (string `yyyy-MM`), `totalGross`, `totalNet`, `totalCNAS`, `totalIRG`, `employeeCount`, `status` (`BROUILLON`/`APPROUVÉ`), `approvedBy`
- `Payslip`: `runId`, `employeeId`, `employeeName`, `period`, `baseSalary`, `transportAllowance`, `performanceBonus`, `otherAllowances`, `grossSalary`, `cnasEmployee`, `taxableGross`, `irgRetained`, `netSalary`, `cnasEmployer`, `totalEmployerCost`
- `Setting`: generic key-value store (`id: String`, `data: String` JSON). Already used for backup_config and others. **This is where payroll config should live** (key: `payroll_config`).

### API conventions
- Generic CRUD: `GET/POST /api/db/:collection` and `PUT/DELETE /api/db/:collection/:id`
- Custom routes: `POST /api/finance/journal`, `GET /api/finance/balances`
- Access control: `financialEmployees` and `payrollRuns` gated to `/finance` path
- Settings readable publicly via `PUBLIC_GET_COLLECTIONS`; `backup_config` id is admin-only — payroll config should follow same pattern

### What is wrong with the current implementation

1. **IRG brackets are incorrect.** Current code uses made-up rates. Algeria 2024 monthly IRG brackets:
   - 0 – 10 000 DA → 0%
   - 10 001 – 20 000 DA → 20%
   - 20 001 – 30 000 DA → 26%
   - 30 001 – 35 000 DA → 30%
   - > 35 000 DA → 35%
   - Rebate: 40% of IRG, capped at 1 500 DA/month

2. **`contributesToCNAS` flag is ignored.** Field exists on the employee record but `calculatePayroll()` never reads it.

3. **CNAS rates and IRG brackets are hardcoded.** Should be admin-configurable via `Setting` (key `payroll_config`).

4. **Config not snapshotted on run creation.** When rates change in the future, old runs would retroactively show different numbers. The config used must be embedded in the run or payslip at creation time.

5. **`PayrollRun` field name mismatch.** Schema has `totalCNAS`; `types.ts` declares both `totalCNAS` and `totalCNASEmployee`/`totalCNASEmployer`. UI already works around this with `(selectedRun as any).totalCNAS ?? selectedRun.totalCNASEmployee`.

6. **No immutability guard on approved runs.** UI allows re-approving but doesn't prevent re-running the same period.
