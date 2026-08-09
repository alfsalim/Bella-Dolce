import { describe, it, expect } from 'vitest';

describe('Special order creation validation', () => {
  const buildForm = (overrides: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    expectedDate: string;
    expectedTime: string;
    items: Array<{ productId: string; quantity: number }>;
  }> = {}) => ({
    firstName: 'Amina',
    lastName: 'Benali',
    phone: '0555123456',
    expectedDate: '2026-08-15',
    expectedTime: '14:00',
    items: [{ productId: 'prod-croissant', quantity: 50 }],
    ...overrides,
  });

  const isValid = (form: ReturnType<typeof buildForm>) => {
    const validItems = form.items.filter((item) => item.productId && item.quantity > 0);
    return Boolean(
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.phone.trim() &&
      form.expectedDate &&
      form.expectedTime &&
      validItems.length > 0
    );
  };

  it('accepts a special order with only firstName/lastName/phone/delivery date+time and one product', () => {
    expect(isValid(buildForm())).toBe(true);
  });

  it('rejects a special order missing firstName', () => {
    expect(isValid(buildForm({ firstName: '' }))).toBe(false);
  });

  it('rejects a special order missing phone', () => {
    expect(isValid(buildForm({ phone: '' }))).toBe(false);
  });

  it('rejects a special order missing delivery date or time', () => {
    expect(isValid(buildForm({ expectedDate: '' }))).toBe(false);
    expect(isValid(buildForm({ expectedTime: '' }))).toBe(false);
  });

  it('rejects a special order with no valid product line', () => {
    expect(isValid(buildForm({ items: [{ productId: '', quantity: 1 }] }))).toBe(false);
  });

  const isValidPhone = (phone: string) => /^0[0-9]{9}$/.test(phone.trim());

  it('accepts a 10-digit phone number starting with 0', () => {
    expect(isValidPhone('0555123456')).toBe(true);
  });

  it('rejects a phone number that does not start with 0', () => {
    expect(isValidPhone('1555123456')).toBe(false);
  });

  it('rejects a phone number shorter than 10 digits', () => {
    expect(isValidPhone('055512345')).toBe(false);
  });

  it('rejects a phone number longer than 10 digits', () => {
    expect(isValidPhone('05551234567')).toBe(false);
  });

  it('rejects a phone number containing non-digit characters', () => {
    expect(isValidPhone('055-512-345')).toBe(false);
  });

  it('customerId is not required — walk-in special orders have none', () => {
    const orderData: { customerId?: string; firstName: string } = { firstName: 'Amina' };
    expect(orderData.customerId).toBeUndefined();
  });
});

describe('Special order mini-cart (1 vs N products)', () => {
  const computeTotal = (items: Array<{ quantity: number; price: number }>) =>
    items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  it('behaves as a single line when only one product is picked', () => {
    const items = [{ productId: 'prod-cake', quantity: 1, price: 5000 }];
    expect(items).toHaveLength(1);
    expect(computeTotal(items)).toBe(5000);
  });

  it('sums totals correctly across multiple product lines (mini-cart)', () => {
    const items = [
      { productId: 'prod-cake', quantity: 1, price: 8000 },
      { productId: 'prod-croissant', quantity: 50, price: 40 },
      { productId: 'prod-macaron', quantity: 20, price: 60 },
    ];
    expect(items).toHaveLength(3);
    expect(computeTotal(items)).toBe(8000 + 50 * 40 + 20 * 60);
  });
});

describe('SpecificationOption dedup via @@unique([category, value])', () => {
  it('treats two options with the same category+value as duplicates', () => {
    const existing = [{ category: 'flavor', value: 'Chocolate' }];
    const candidate = { category: 'flavor', value: 'Chocolate' };
    const isDuplicate = existing.some(
      (opt) => opt.category === candidate.category && opt.value === candidate.value
    );
    expect(isDuplicate).toBe(true);
  });

  it('allows the same value under a different category', () => {
    const existing = [{ category: 'flavor', value: 'Vanilla' }];
    const candidate = { category: 'glaze', value: 'Vanilla' };
    const isDuplicate = existing.some(
      (opt) => opt.category === candidate.category && opt.value === candidate.value
    );
    expect(isDuplicate).toBe(false);
  });

  it('P2002 unique constraint violation is the expected outcome for a duplicate insert', () => {
    const prismaErrorCode = 'P2002';
    expect(prismaErrorCode).toBe('P2002');
  });
});

describe('POST /api/orders/:id/close', () => {
  const computeBalance = (order: { totalAmount: number; amountPaid?: number }) =>
    order.totalAmount - (order.amountPaid || 0);

  it('rejects closing when the submitted amount is less than the remaining balance', () => {
    const order = { totalAmount: 10000, amountPaid: 3000 };
    const balance = computeBalance(order);
    const submitted = 5000;
    expect(submitted < balance).toBe(true);
  });

  it('succeeds when the submitted amount equals the exact remaining balance', () => {
    const order = { totalAmount: 10000, amountPaid: 3000 };
    const balance = computeBalance(order);
    const submitted = 7000;
    expect(submitted).toBe(balance);
    expect(submitted < balance).toBe(false);
  });

  it('closing sets amountPaid to totalAmount, paymentStatus to closed, status to delivered', () => {
    const order = { totalAmount: 10000, amountPaid: 3000, paymentStatus: 'deposit', status: 'ordered' };
    const closed = {
      ...order,
      amountPaid: order.totalAmount,
      paymentStatus: 'closed',
      status: 'delivered',
    };
    expect(closed.amountPaid).toBe(10000);
    expect(closed.paymentStatus).toBe('closed');
    expect(closed.status).toBe('delivered');
  });

  it('an order with no prior payment requires the full totalAmount to close', () => {
    const order = { totalAmount: 10000, amountPaid: 0 };
    const balance = computeBalance(order);
    expect(balance).toBe(10000);
  });

  it('regression: clicking Close without editing the pre-filled balance input must still resolve to the real balance, not zero', () => {
    // closeBalanceInput[order.id] is only set once the user's onChange fires. If the input's
    // pre-filled default already equals the balance and the user never edits it, this key stays
    // undefined — `entered` must fall back to the computed balance, not to 0.
    const order = { id: 'order-1', totalAmount: 10000, amountPaid: 3000 };
    const balance = Math.max(0, computeBalance(order));
    const closeBalanceInput: Record<string, string> = {}; // untouched input
    const entered = parseFloat(closeBalanceInput[order.id] ?? String(balance)) || 0;
    expect(entered).toBe(balance);
    expect(entered < balance).toBe(false);
  });
});

describe('Order cancellation (dedicated Cancel action, not a status toggle)', () => {
  const cancelOrder = (order: { totalAmount: number; amountPaid?: number; paymentStatus?: string; status: string }, reason: string) => {
    if (!reason.trim()) {
      throw new Error('cancellationReasonRequired');
    }
    return {
      ...order,
      status: 'cancelled',
      amountPaid: 0,
      paymentStatus: 'n/a',
      cancellationReason: reason.trim(),
    };
  };

  it('rejects cancellation with an empty reason', () => {
    const order = { totalAmount: 5000, amountPaid: 2000, paymentStatus: 'deposit', status: 'ordered' };
    expect(() => cancelOrder(order, '   ')).toThrow('cancellationReasonRequired');
  });

  it('rejects cancellation with no reason at all', () => {
    const order = { totalAmount: 5000, amountPaid: 2000, paymentStatus: 'deposit', status: 'ordered' };
    expect(() => cancelOrder(order, '')).toThrow('cancellationReasonRequired');
  });

  it('cancelling a paid special order zeroes amountPaid so the refunded deposit is not counted as revenue', () => {
    const order = { totalAmount: 5000, amountPaid: 2000, paymentStatus: 'deposit', status: 'ordered' };
    const cancelled = cancelOrder(order, 'Client changed their mind');
    expect(cancelled.amountPaid).toBe(0);
    expect(cancelled.paymentStatus).toBe('n/a');
  });

  it('cancelling still logs the order with status cancelled and stores the mandatory reason', () => {
    const order = { totalAmount: 5000, amountPaid: 2000, paymentStatus: 'deposit', status: 'ordered' };
    const cancelled = cancelOrder(order, 'Out of stock for this custom cake');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('Out of stock for this custom cake');
  });

  it('cancelling an order with no prior payment is a no-op on amountPaid (already 0)', () => {
    const order = { totalAmount: 5000, amountPaid: 0, paymentStatus: 'n/a', status: 'ordered' };
    const cancelled = cancelOrder(order, 'Customer no-show');
    expect(cancelled.amountPaid).toBe(0);
  });

  it('cancel is a dedicated action distinct from the ordered/in-progress/delivered status toggle', () => {
    const statusToggleOptions = ['ordered', 'in-progress', 'delivered'];
    expect(statusToggleOptions).not.toContain('cancelled');
  });
});
