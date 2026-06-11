# Skill: build-wire

Triggered by: `/build-wire <screen-id>` (e.g. `/build-wire 7c-invoice-list`)

Wires one frontend screen to real backend API endpoints. One screen per invocation — never batch.

## Inputs required
- Screen ID (e.g. `7c-invoice-list`)

## Load order
1. Read `src/web/src/screens/<screen-id>/index.tsx`
2. Read `src/web/e2e/<screen-id>.spec.ts` (existing E2E test)
3. Read `src/web/src/lib/api.ts` (shared client — must exist before wiring)

Confirm in one line: "Loaded <screen-id>. Auditing API calls."

## Step 1 — Audit

Identify every place in the screen that:
- Uses `event.preventDefault()` with no subsequent API call
- Renders hardcoded/static data instead of fetching
- Has a `TODO` or comment deferring an API call

List each finding as: `[ACTION] <description> → needs <HTTP method> <endpoint>`

If nothing needs wiring, report "Screen already wired." and stop.

## Step 2 — Check backend endpoint exists

For each needed endpoint, confirm it exists in `src/api/`:
- If endpoint exists → proceed to Step 3
- If endpoint does not exist → write `test.todo('TC-WIRE-XX: <action> — blocked: needs <METHOD> <endpoint>')` in the E2E test and stop. Do not mock the missing endpoint.

## Step 3 — Wire the screen

For each unwired action:
1. Replace the static/preventDefault pattern with a call to `api.<method>(path, body)` from `src/web/src/lib/api.ts`
2. Handle loading state (show spinner/disabled button while request is in flight)
3. Handle error state (show error message on failure)
4. On success, update local state or navigate as appropriate

Rules:
- Import only from `src/web/src/lib/api.ts` — never raw `fetch`
- Never store the access token in localStorage — `authStore` manages it in memory
- Keep the change surgical — do not refactor surrounding code

## Step 4 — Update E2E test

For the happy-path test(s):
- Remove `page.route()` mock for the success case
- The test must hit the real backend (ensure backend is running or use `beforeAll` setup)
- Keep `page.route()` mocks only for error states and loading states

## Step 5 — Verify

```bash
npx playwright test e2e/<screen-id>.spec.ts
npm run build
```

Both must pass before reporting done.

## End state
Report: "Wired <screen-id>. <N> actions connected. Tests passing."

## Forbidden
- Mocking the happy-path API call with `page.route()`
- Using raw `fetch` instead of `api.*`
- Wiring more than one screen per invocation
- Touching files outside the screen's `index.tsx` and its `e2e/*.spec.ts`
