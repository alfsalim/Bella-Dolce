# Skill: Frontend Stitch Test

Triggered by: any task to build/update Playwright test for a screen.

## Inputs required
- Screen name (e.g., 7m-404-page)
- Stitch folder = stitch_export/<screen-name> (folder name matches screen name exactly)

## Load order (stop if any missing)
1. .claude/skills/design/00-summary.md
2. .claude/skills/design/<SCREEN>.md
3. stitch_export/<FOLDER>/code.html
4. stitch_export/<FOLDER>/screen.png
5. src/web/src/screens/<SCREEN>/index.tsx (current impl, may not exist yet)

Confirm in one line: "Loaded Stitch source for <SCREEN>. Ready."

## Test structure (src/web/e2e/<SCREEN>.spec.ts)

### Layer 1 — Visual snapshot (required, first)
await expect(page).toHaveScreenshot('<SCREEN>-desktop.png', { maxDiffPixels: 100 })
await expect(page).toHaveScreenshot('<SCREEN>-mobile.png', { maxDiffPixels: 100 })

### Layer 2 — Behavior (required)
- getByRole, getByText, getByAltText only
- Test clicks, navigation, form submits
- Test image actually loads: naturalWidth > 0

### Layer 3 — Copy (required)
- Extract EXACT text from code.html, no paraphrase
- await expect(el).toHaveText('exact string')

### Layer 4 — Computed style (required for colors/sizes)
- await expect(el).toHaveCSS('background-color', 'rgb(16, 185, 129)')
- await expect(el).toHaveCSS('font-size', '24px')

## API wiring requirement
- The happy-path test (successful form submit, successful data load) MUST hit the real backend — no page.route() mock for the success case
- page.route() is ONLY allowed for: error states, loading/spinner states, and network failure states
- If the backend endpoint does not exist yet, write the happy-path test as `test.todo('TC-XX: <description> — blocked: needs POST /api/v1/...')` and stop. Do not mock the missing endpoint.

## Forbidden
- toHaveClass for visual properties (colors, spacing, sizes)
- Class regex except for structural (flex, grid)
- Inventing copy not present in code.html
- Skipping visual snapshot
- page.route() mock for the happy-path / success flow

## Tailwind → rgb reference
- emerald-600 → rgb(5, 150, 105)
- emerald-500 → rgb(16, 185, 129)
- emerald-50  → rgb(236, 253, 245)
(extend as needed)

## End state
1. Test written
2. Run: npx playwright test e2e/<SCREEN>.spec.ts
3. Confirm: FAILS (no impl) or PASSES (impl correct)
4. Stop. Do not implement.

## Query disambiguation (required)
Before writing getByText('X'), grep code.html for "X".
- If "X" appears once → getByText('X') OK
- If "X" appears multiple times → use getByRole with name, or scope with .locator(parent).getByText('X')
- Never write a query that matches multiple elements
## Label disambiguation rule
When two labels share a substring (e.g. "Mot de passe" and "Confirmer le mot de passe"), Playwright's getByLabel will match BOTH.
Always use { exact: true } when targeting the shorter label:
  page.getByLabel('Mot de passe', { exact: true })
Before writing getByLabel, grep the design.md or code.html for the label text — if it appears as substring of another label, use exact:true.
