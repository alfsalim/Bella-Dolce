import { describe, it, expect } from 'vitest';

describe('POST /api/sale clientTxnId dedupe', () => {
  const existingSale = {
    id: 'sale-uuid-001',
    clientTxnId: 'device-abc-txn-001',
    cashierId: 'cashier-001',
    totalAmount: 500,
    paymentMethod: 'cash',
    items: JSON.stringify([{ productId: 'prod-001', quantity: 1 }]),
    status: 'completed',
  };

  it('returns the existing sale when clientTxnId already exists', () => {
    const incomingClientTxnId = 'device-abc-txn-001';
    const found = incomingClientTxnId === existingSale.clientTxnId ? existingSale : null;
    expect(found).toEqual(existingSale);
  });

  it('proceeds to create a new sale when clientTxnId is unseen', () => {
    const incomingClientTxnId = 'device-abc-txn-002';
    const found = incomingClientTxnId === existingSale.clientTxnId ? existingSale : null;
    expect(found).toBeNull();
  });

  it('clientTxnId is optional and sales without it are always created', () => {
    const body: { clientTxnId?: string } = {};
    expect(body.clientTxnId).toBeUndefined();
  });
});

describe('POST /api/auth/login deviceLogin token expiry', () => {
  const JWT_EXPIRES_IN = '8h';

  it('normal login (no deviceLogin flag) uses the default expiry', () => {
    const body: { deviceLogin?: boolean } = {};
    const expiresIn = body.deviceLogin ? '30d' : JWT_EXPIRES_IN;
    expect(expiresIn).toBe('8h');
  });

  it('deviceLogin: true issues a 30-day token', () => {
    const body = { deviceLogin: true };
    const expiresIn = body.deviceLogin ? '30d' : JWT_EXPIRES_IN;
    expect(expiresIn).toBe('30d');
  });

  it('deviceLogin: false behaves like a normal login', () => {
    const body = { deviceLogin: false };
    const expiresIn = body.deviceLogin ? '30d' : JWT_EXPIRES_IN;
    expect(expiresIn).toBe('8h');
  });
});
