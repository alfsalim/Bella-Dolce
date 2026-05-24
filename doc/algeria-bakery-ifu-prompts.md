# Algeria Bakery IFU Module — Claude Code Prompts

## Usage pattern for every new Claude Code session

Paste the **Session Bootstrap Header** first, then paste the phase prompt for the step you want Claude Code to do.

Keep these repo files updated between sessions:
- `CLAUDE.md` — permanent repo-level coding rules only
- `context/current-work.md` — temporary current initiative summary
- `context/session-log.md` — handoff log between sessions

---

## Session Bootstrap Header

Use this at the top of **every fresh Claude Code session**.

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.
```

---

## Phase 0 — Context setup

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: prepare the repository context for multi-session Claude Code work on the bakery IFU module.

Do not implement tax logic yet.

1. Inspect repository structure and existing instruction/context files.
2. Create or update these files if needed:
   - CLAUDE.md (repo-level only; no temporary bakery details)
   - context/current-work.md
   - context/session-log.md
3. Add the bakery IFU module to context/current-work.md with a short scope summary.
4. Make sure session-log has a clean section for the bakery IFU module.
5. Report exact files created or updated and the conventions discovered.

Stop after setup is complete.
```

---

## Phase 1 — Analysis and architecture

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: analyze the existing app and produce an architecture/specification for the Algeria bakery IFU declaration module.

Do not write production code yet.

You must:
1. Find all existing code related to:
   - tax declarations
   - G50 / G50 ter / G12 / IFU
   - company settings / fiscal settings
   - invoicing / sales / revenue / turnover
   - print/export/PDF
2. Identify:
   - what already exists
   - what is reusable
   - what is missing
   - what is inaccurate or risky
3. Produce a specification covering:
   - bakery IFU scope (single-rate commercial activity only)
   - annual G12 declaration requirements
   - quarterly G50 ter requirements for IRG salaries if payroll module exists
   - required data inputs
   - required outputs and statuses
   - config/versioning requirements
   - audit/immutability rules
   - reporting and print requirements
4. Propose implementation phases with minimal disruption to current architecture.
5. List likely files/tables/modules to be touched.

Do not write code. Wait for approval.
```

---

## Phase 2 — Config and calculation engine

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: define and implement the bakery IFU configuration and calculation engine.

Before coding:
1. Re-read context/session-log.md
2. Inspect actual schema/config patterns in the app
3. Confirm where tax constants should live in this app

Then implement:
1. Config storage or reuse existing config mechanism for:
   - IFU commercial rate (default initial value can be 5%, but configurable)
   - IFU CA eligibility threshold
   - G12 deadline
   - G50 ter deadline offset
   - any other tax settings needed for this bakery module
2. A deterministic calculation engine for bakery IFU:
   - input: total gross turnover by month and year
   - output: annual turnover total, applicable rate, annual IFU due
3. If payroll module exists, an aggregation function for quarterly G50 ter IRG salaries totals from validated payslips
4. Tests for:
   - zero turnover
   - normal turnover
   - turnover near threshold
   - changed rate after config versioning
   - quarterly payroll aggregation if applicable

Rules:
- no hardcoded tax rates in engine logic
- use config versioning / snapshots for audit
- keep functions testable and deterministic
- keep current bakery UI assumptions single-rate commercial only

At the end:
- run tests
- summarize files changed
- update context/session-log.md
```

---

## Phase 3 — Schema, service, and API specification/implementation

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: schema/service/API work for the bakery IFU module.

Analyze first. Do not start with code.

1. Audit existing schema/models/tables related to:
   - company/business settings
   - revenue/sales/invoices
   - tax/declaration records
   - payroll totals if G50 ter is supported
2. Determine:
   - what can be reused
   - what fields already exist under different names
   - what is missing
   - what should not be changed because it increases risk
3. Propose the minimal changes needed to support:
   - versioned IFU config
   - annual G12 declaration records
   - quarterly G50 ter records (if payroll exists)
   - draft/submitted statuses
   - stored computed totals
   - config snapshot for audit/history
   - print/export data source
4. Specify service operations and API endpoints using the app's existing patterns.
5. Present a keep/modify/add/avoid table with reasons.

If the implementation path is clear and safe, proceed with the minimal required changes.
Otherwise stop and wait for approval.

Update context/session-log.md at the end.
```

---

## Phase 4a — UI for annual G12 and quarterly G50 ter

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: build the bakery IFU declaration UI using existing app patterns.

Before coding:
1. Inspect existing admin/settings pages, forms, tables, badges, and print/export actions
2. Inspect how the app currently handles bilingual labels if that exists
3. Reuse existing design system and navigation patterns

Build Screen 1 — G12 Annual Declaration:
- year selector
- status badge: draft / submitted
- monthly turnover table for Jan–Dec
  - single turnover column only
  - footer total
- auto-calculated summary:
  - total annual turnover
  - applicable IFU rate
  - annual IFU due
- actions:
  - save draft
  - submit
  - print/export
- warning if annual turnover exceeds IFU eligibility threshold

Build Screen 2 — G50 ter Quarterly Declaration (only if payroll module exists):
- year + quarter selector
- status badge
- auto-aggregated summary from payroll:
  - number of salaried employees in quarter
  - total gross payroll for quarter
  - total IRG withheld
  - monthly breakdown for the 3 months in the quarter
- actions:
  - generate/refresh
  - submit
  - print/export
- warning if no validated payslips exist for a month

Build Screen 3 — Tax dashboard overview:
- current year turnover to date
- current year IFU estimate
- G12 status
- quarterly G50 ter cards if payroll exists
- reminder/deadline widgets based on config

Requirements:
- bakery flow is single-rate only
- bilingual labels where appropriate
- follow current app styling and validation patterns
- submitted declarations are locked for editing

Update context/session-log.md at the end.
```

---

## Phase 4b — Admin config screen

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: build the bakery IFU admin configuration screen.

This screen must follow the same access-control, layout, and versioning patterns used elsewhere in the app.

STEP 1 — Inspect before coding
1. Confirm how admin/settings screens are built in this app
2. Confirm how versioned config is stored and loaded
3. Reuse the same screen layout and history pattern if a payroll config screen already exists

STEP 2 — Build the screen

Section 1 — Fiscal regime basics
- IFU eligibility turnover threshold (DA/year)
- read-only note that this bakery uses commercial/artisanal activity only

Section 2 — IFU rate
- editable IFU commercial rate (%)
- label FR: "Taux IFU — activité commerciale/artisanale"
- label AR: "معدل الضريبة الجزافية — النشاط التجاري/الحرفي"
- live preview example:
  - for 1,000,000 DA turnover, IFU = X DA

Section 3 — Declaration parameters
- G12 annual deadline
- G50 ter quarterly deadline offset or configured deadlines if payroll exists

Section 4 — Version history
- table: version, effective date, saved by, actions
- view detail action opens read-only full snapshot

Save behavior:
- saving creates a new config version with effective_date = today
- saving does not modify already submitted declarations
- persistent warning banner:
  FR: "Les modifications de taux s'appliqueront uniquement aux nouvelles déclarations. Les déclarations déjà soumises conservent les taux en vigueur à leur date de soumission."
  AR: "تعديلات المعدلات تنطبق فقط على الإقرارات الجديدة. الإقرارات المودعة تحتفظ بالمعدلات المطبقة وقت إيداعها."

Validation:
- numeric positive values
- max 2 decimal places for rate
- access limited to admin using existing app guard

STEP 3 — Verify integration
- new declarations use the latest active config version
- submitted declarations keep their saved config snapshot
- changing rate from 5 to 6 today does not alter previously submitted G12 declarations

STEP 4 — QA checklist
- screen renders without errors
- access control works
- save creates a new version
- history table works
- warning banner visible
- live preview works
- submitted declarations remain unchanged after rate update
- bilingual labels render correctly

STEP 5 — Wrap up
Update context/session-log.md and report files touched and QA results.
```

---

## Phase 5 — Print and export templates

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: build the print/export templates for the bakery IFU module.

Inspect existing print styles, PDF generation flows, and export mechanisms before coding.
Reuse current app patterns.

Implement Template 1 — G12 annual summary:
- company identity block
- fiscal year
- turnover table Jan–Dec
- annual turnover total
- IFU rate applied
- annual IFU due
- submission date/status
- config version or snapshot reference where appropriate
- bilingual FR/AR labels where app conventions support it

Implement Template 2 — G50 ter quarterly summary (if payroll module exists):
- company identity block
- year and quarter
- three-month breakdown
- total employees, gross payroll, total IRG withheld
- submission date/status

Requirements:
- A4 print-safe layout
- submitted declarations render from stored values, not recomputed values
- no UI chrome in print
- export actions wired using existing app mechanism

Update context/session-log.md at the end.
```

---

## Phase 6 — Integration and QA

```txt
## SESSION CONTEXT — READ FIRST

Start by reading these files if they exist:
- CLAUDE.md
- context/current-work.md
- context/session-log.md

Then inspect relevant codebase files before making any assumptions.

Rules:
- Do not assume table names, field names, route structure, folder conventions, or service names.
- Reuse existing patterns, components, validation, access control, and printing/export mechanisms.
- Before implementation, summarize what exists, what is missing, and what you plan to change.
- If context/session-log.md is missing or does not contain the bakery IFU module history, stop and tell me before proceeding.
- At the end of this session, update context/session-log.md with:
  - completed work
  - decisions made and why
  - files created or modified (with full paths)
  - open issues
  - exact next step

Business context for this module:
- The business is a bakery / boulangerie-pâtisserie in Algeria.
- Activity type is commercial/artisanal only.
- Current target regime is IFU simplified taxation.
- IFU calculation for this bakery is based on total gross turnover (chiffre d'affaires) using a single commercial rate.
- There is no services activity and no mixed-activity UI is needed.
- The tax rate must remain configurable in admin and must never be hardcoded, because it may change in future.
- Submitted declarations must preserve a config snapshot for audit/history.

TASK: integrate, verify, and finish the bakery IFU module.

Do not start by coding. Start by validating the current state.

Verify end-to-end:
- create or update annual G12 draft
- calculate IFU from annual turnover using current active config
- submit G12 and verify lock behavior
- change config rate and verify submitted G12 remains unchanged
- if payroll exists: generate quarterly G50 ter from validated payslips
- submit G50 ter and verify lock behavior
- print/export both declaration types

Boundary checks:
- zero turnover
- normal turnover
- turnover near or above threshold
- changed rate after declarations already submitted

Verify:
- submitted declarations use stored config snapshot
- admin config affects only future declarations
- deadlines/reminders read from config
- bilingual labels and print layouts render correctly

Fix any remaining issues with minimal changes.

Final wrap-up:
1. Update context/session-log.md with final status of the bakery IFU module
2. List all files created or modified
3. Document known limitations and recommended next improvements
4. If complete, mark the module as done in current-work context
```

---

## Parallelization guidance

Use this only if you want to split work across separate Claude Code sessions.

### Safe parallel tracks after Phase 1 approval
- Phase 2 (engine/config)
- Phase 3 (schema/service/API) — can start as spec-first in parallel, then implement after Phase 2 confirms config approach
- Phase 4a UI discovery/spec can begin in parallel once Phase 1 is approved
- Phase 5 print/export discovery/spec can begin in parallel once Phase 1 is approved

### Best practical order
1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4a and Phase 4b in parallel
6. Phase 5
7. Phase 6

### If payroll module does not exist
- Skip G50 ter parts in Phases 2, 3, 4a, 5, and 6
- Keep bakery IFU scope limited to G12 annual declaration only

