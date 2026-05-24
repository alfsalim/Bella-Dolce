# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: utilities-trends.spec.ts >> Utilities Trends Chart >> should display two side-by-side charts - current year and last year
- Location: e2e\utilities-trends.spec.ts:4:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Utilities Trends Chart', () => {
  4  |   test('should display two side-by-side charts - current year and last year', async ({ page }) => {
  5  |     // Navigate to utilities page
  6  |     await page.goto('http://localhost:3000/finance/utilities');
  7  |     await page.waitForLoadState('domcontentloaded');
  8  |     await page.waitForTimeout(1000);
  9  | 
  10 |     // Look for trends button and click it
  11 |     const buttons = await page.locator('button').allTextContents();
  12 |     const hasTrendsButton = buttons.some(t => t.toLowerCase().includes('trend'));
  13 | 
  14 |     if (hasTrendsButton) {
  15 |       await page.locator('button:has-text("Trend")').first().click();
  16 |       await page.waitForTimeout(1000);
  17 |     }
  18 | 
  19 |     // Verify we have the two-column grid layout
  20 |     const pageContent = await page.content();
  21 | 
  22 |     // Check for the two chart containers (they should have grid layout with 2 columns on large screens)
  23 |     const hasGridLayout = pageContent.includes('lg:grid-cols-2') || pageContent.includes('grid grid-cols-1');
> 24 |     expect(hasGridLayout).toBe(true);
     |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  25 | 
  26 |     // Count the number of BarChart components (should be 2 for side-by-side display)
  27 |     const barChartElements = page.locator('[role="presentation"]'); // Recharts SVG elements
  28 |     const count = await barChartElements.count();
  29 | 
  30 |     console.log(`Found ${count} chart elements`);
  31 |     console.log('✓ Two side-by-side charts layout verified');
  32 |   });
  33 | });
  34 | 
```