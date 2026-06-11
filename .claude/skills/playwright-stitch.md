# Skill: Playwright Tests Aligned to Stitch

## Rule
A Stitch-aligned test has 3 layers. All three required.

## Layer 1 — Visual snapshot (mandatory)
await expect(page).toHaveScreenshot('<screen>.png', { maxDiffPixels: 100 });
Baseline lives in tests/__screenshots__/. Regenerate only with explicit approval.

## Layer 2 — Behavior (mandatory)
Use getByRole, getByText, getByAltText. Never class regex.
Click buttons. Assert navigation. Assert text content.

## Layer 3 — Asset load (mandatory if images present)
For every <img>: assert naturalWidth > 0, not just toBeVisible().

## Forbidden
- toHaveClass(/.../) as the primary assertion. CSS classes are implementation detail.
- Trusting toBeVisible() for images.
- Writing a test without loading the Stitch screen.png AND code.html first.

## Required inputs before writing a test
1. stitch_export/<screen>/screen.png  — visual source of truth
2. stitch_export/<screen>/code.html   — markup reference
3. src/web/src/screens/<screen>/index.tsx — actual implementation
If any of the three is missing → STOP, ask Salim.