import { test, expect, Page } from '@playwright/test';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password';

async function login(page: Page) {
  await page.goto('/belladolce/login');
  await page.getByPlaceholder('admin').fill(ADMIN_USERNAME);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.waitForURL(/\/(dashboard|orders)/, { timeout: 15000 });
}

/** The daily orders reminder (z-[200]) can legitimately pop up over the Orders page if
 *  today-dated unfulfilled orders exist in dev.db — dismiss it so it can't intercept clicks. */
async function dismissReminderIfPresent(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Commandes à honorer aujourd\'hui' });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

async function openSpecialOrderModal(page: Page) {
  await page.goto('/belladolce/orders');
  await dismissReminderIfPresent(page);
  await page.getByRole('button', { name: 'Nouvelle commande spéciale' }).click();
  await expect(page.locator('form')).toBeVisible();
}

test.describe('Special orders', () => {
  test('create a special order, reuse a newly-added flavor option, verify balance, then close it', async ({ page }) => {
    const runId = Date.now();
    const uniqueFlavor = `E2E Flavor ${runId}`;
    const uniqueLastName = `Benali-${runId}`;
    const fullName = `Amina ${uniqueLastName}`;
    const unitPrice = 500;
    const quantity = 10;
    const downpayment = 2000;
    const expectedTotal = unitPrice * quantity;
    const expectedBalance = expectedTotal - downpayment;

    let createdOrderId: string | null = null;
    let createdOptionId: string | null = null;

    await login(page);

    // --- Create the first special order and add a brand-new flavor value ---
    await openSpecialOrderModal(page);
    const form = page.locator('form');

    await page.locator('#special-order-firstName').fill('Amina');
    await page.locator('#special-order-lastName').fill(uniqueLastName);
    await page.locator('#special-order-phone').fill('0555123456');
    await page.locator('#special-order-expectedDate').fill('2026-12-15');
    await page.locator('#special-order-expectedTime').fill('14:00');

    await form.getByLabel('Sélectionner un produit').selectOption({ index: 1 });
    await form.getByLabel('Quantité').fill(String(quantity));
    await form.getByLabel('Prix').fill(String(unitPrice));

    await form.getByRole('button', { name: 'Personnalisation' }).click();
    await form.getByLabel('Saveur').selectOption('__add_new__');
    await page.getByPlaceholder('Saisir une nouvelle valeur…').fill(uniqueFlavor);
    const createOptionResponsePromise = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/api/db/specificationOptions')
    );
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    const createdOption = await (await createOptionResponsePromise).json();
    createdOptionId = createdOption.id;
    await expect(form.getByLabel('Saveur')).toHaveValue(uniqueFlavor);

    await page.locator('#special-order-downpayment').fill(String(downpayment));
    await expect(form.getByText(`${expectedTotal.toLocaleString()}`)).toBeVisible();

    const createResponsePromise = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/api/db/orders')
    );
    await form.getByRole('button', { name: 'Nouvelle commande spéciale' }).click();
    const createResponse = await createResponsePromise;
    const createdOrder = await createResponse.json();
    createdOrderId = createdOrder.id;
    await expect(page.locator('form')).toBeHidden({ timeout: 15000 });

    try {
      // --- Verify the order renders in the Orders list with the right balance ---
      const orderCard = page.locator('.card', { hasText: fullName }).first();
      await expect(orderCard).toBeVisible();
      await expect(orderCard.getByText(new RegExp(expectedBalance.toLocaleString()))).toBeVisible();

      // --- Create a second special order and confirm the new flavor persisted ---
      await openSpecialOrderModal(page);
      const secondForm = page.locator('form');
      await secondForm.getByRole('button', { name: 'Personnalisation' }).click();
      await expect(secondForm.getByLabel('Saveur').locator('option', { hasText: uniqueFlavor })).toBeAttached({ timeout: 10000 });
      await secondForm.getByRole('button', { name: 'Annuler', exact: true }).click();

      // --- Close the first order by paying the exact remaining balance ---
      const cardToClose = page.locator('.card', { hasText: fullName }).first();
      const balanceInput = cardToClose.locator('input[type="number"]').last();
      await balanceInput.fill(String(expectedBalance));
      await cardToClose.getByRole('button', { name: 'Clôturer la commande' }).click();
      await expect(cardToClose.getByText('Clôturée')).toBeVisible({ timeout: 15000 });
    } finally {
      // Clean up everything this test created so dev.db doesn't accumulate test data.
      const authHeaders = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('bakery_token'))}` };
      if (createdOrderId) {
        await page.request.delete(`/api/db/orders/${createdOrderId}`, { headers: authHeaders });
      }
      if (createdOptionId) {
        await page.request.delete(`/api/db/specificationOptions/${createdOptionId}`, { headers: authHeaders });
      }
    }
  });

  test('cancelling a paid order requires a reason and refunds the deposit (not counted as revenue)', async ({ page }) => {
    const runId = Date.now();
    const uniqueLastName = `CancelTest-${runId}`;
    const fullName = `Amina ${uniqueLastName}`;
    const unitPrice = 500;
    const quantity = 10;
    const downpayment = 2000;

    let createdOrderId: string | null = null;

    await login(page);

    await openSpecialOrderModal(page);
    const form = page.locator('form');
    await page.locator('#special-order-firstName').fill('Amina');
    await page.locator('#special-order-lastName').fill(uniqueLastName);
    await page.locator('#special-order-phone').fill('0555123456');
    await page.locator('#special-order-expectedDate').fill('2026-12-15');
    await page.locator('#special-order-expectedTime').fill('14:00');
    await form.getByLabel('Sélectionner un produit').selectOption({ index: 1 });
    await form.getByLabel('Quantité').fill(String(quantity));
    await form.getByLabel('Prix').fill(String(unitPrice));
    await page.locator('#special-order-downpayment').fill(String(downpayment));

    const createResponsePromise = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/api/db/orders')
    );
    await form.getByRole('button', { name: 'Nouvelle commande spéciale' }).click();
    createdOrderId = (await (await createResponsePromise).json()).id;
    await expect(page.locator('form')).toBeHidden({ timeout: 15000 });

    try {
      const orderCard = page.locator('.card', { hasText: fullName }).first();
      await expect(orderCard).toBeVisible();

      await orderCard.getByRole('button', { name: 'Annuler la commande' }).click();

      const dialog = page.getByRole('dialog', { name: 'Annuler la commande' });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole('button', { name: 'Annuler la commande' });

      // Secondary validation: reason is mandatory — confirm stays disabled until filled.
      await expect(confirmButton).toBeDisabled();
      await page.locator('#cancel-order-reason').fill('Client changed their mind');
      await expect(confirmButton).toBeEnabled();

      const cancelResponsePromise = page.waitForResponse(
        (res) => res.request().method() === 'PUT' && res.url().includes(`/api/db/orders/${createdOrderId}`)
      );
      await confirmButton.click();
      const cancelledOrder = await (await cancelResponsePromise).json();

      // Order stays logged with status cancelled; deposit is refunded and no longer counted as revenue.
      expect(cancelledOrder.status).toBe('cancelled');
      expect(cancelledOrder.amountPaid).toBe(0);
      expect(cancelledOrder.cancellationReason).toBe('Client changed their mind');

      await expect(dialog).toBeHidden({ timeout: 15000 });
      await expect(orderCard.getByRole('button', { name: 'Annuler la commande' })).toHaveCount(0, { timeout: 15000 });
    } finally {
      if (createdOrderId) {
        const authHeaders = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('bakery_token'))}` };
        await page.request.delete(`/api/db/orders/${createdOrderId}`, { headers: authHeaders });
      }
    }
  });
});
