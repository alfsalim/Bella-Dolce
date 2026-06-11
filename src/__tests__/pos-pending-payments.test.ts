import { describe, expect, it } from 'vitest';

type Role = 'cashier' | 'manager' | 'admin';

interface TestSale {
  id: string;
  cashierId: string;
  createdAt: string;
  totalAmount: number;
  amountPaid?: number | null;
  discount?: number | null;
  comment?: string | null;
  status?: string;
}

const sales: TestSale[] = [
  {
    id: 'commented-newer',
    cashierId: 'cashier-001',
    createdAt: '2026-06-11T10:00:00.000Z',
    totalAmount: 500,
    amountPaid: 450,
    discount: 50,
    comment: 'Customer will return',
    status: 'completed',
  },
  {
    id: 'other-cashier',
    cashierId: 'cashier-002',
    createdAt: '2026-06-11T11:00:00.000Z',
    totalAmount: 800,
    amountPaid: 700,
    discount: 100,
    status: 'completed',
  },
  {
    id: 'settled-sale',
    cashierId: 'cashier-001',
    createdAt: '2026-06-11T12:00:00.000Z',
    totalAmount: 400,
    amountPaid: 400,
    discount: 0,
    status: 'settled',
  },
  {
    id: 'cancelled-sale',
    cashierId: 'cashier-001',
    createdAt: '2026-06-11T13:00:00.000Z',
    totalAmount: 300,
    amountPaid: 200,
    discount: 100,
    status: 'cancelled',
  },
];

function getPendingSales(input: TestSale[], user: { id: string; role: Role }, remaining?: number) {
  const canSeeAll = user.role === 'admin' || user.role === 'manager';
  return input
    .filter(sale => Number(sale.discount ?? 0) > 0)
    .filter(sale => sale.status !== 'settled' && sale.status !== 'cancelled')
    .filter(sale => canSeeAll || sale.cashierId === user.id)
    .filter(sale => remaining === undefined || sale.discount === remaining)
    .sort((a, b) => {
      const aHasComment = Boolean(a.comment?.trim());
      const bHasComment = Boolean(b.comment?.trim());
      if (aHasComment !== bHasComment) return aHasComment ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function settleSale(sale: TestSale, additionalAmountPaid: number, noteDate = '2026-06-11T12:00:00.000Z') {
  if (!Number.isFinite(additionalAmountPaid) || additionalAmountPaid <= 0) {
    throw new Error('additionalAmountPaid must be greater than 0');
  }
  if (sale.status === 'cancelled') throw new Error('Transaction is cancelled');
  if (sale.status === 'settled') throw new Error('Transaction is already settled');

  const newAmountPaid = Number(sale.amountPaid ?? 0) + additionalAmountPaid;
  if (newAmountPaid > sale.totalAmount) {
    throw new Error('The amount exceeds the remaining balance');
  }

  const newDiscount = Math.max(0, sale.totalAmount - newAmountPaid);
  const paymentNote = `+${additionalAmountPaid.toFixed(0)} DA paid on ${noteDate}`;
  const existingComment = sale.comment?.trim();

  return {
    ...sale,
    amountPaid: newAmountPaid,
    discount: newDiscount > 0 ? newDiscount : 0,
    status: newAmountPaid >= sale.totalAmount ? 'settled' : sale.status,
    comment: existingComment ? `${existingComment}\n${paymentNote}` : paymentNote,
  };
}

describe('POS pending payments', () => {
  it('excludes settled and cancelled sales from the pending list', () => {
    const pending = getPendingSales(sales, { id: 'manager-001', role: 'manager' });
    expect(pending.map(sale => sale.id)).toEqual(['commented-newer', 'other-cashier']);
  });

  it('filters by exact remaining amount', () => {
    const pending = getPendingSales(sales, { id: 'manager-001', role: 'manager' }, 50);
    expect(pending.map(sale => sale.id)).toEqual(['commented-newer']);
  });

  it('limits cashiers to their own pending sales', () => {
    const pending = getPendingSales(sales, { id: 'cashier-001', role: 'cashier' });
    expect(pending.map(sale => sale.id)).toEqual(['commented-newer']);
  });

  it('allows managers and admins to see all pending sales', () => {
    const managerPending = getPendingSales(sales, { id: 'manager-001', role: 'manager' });
    const adminPending = getPendingSales(sales, { id: 'admin-001', role: 'admin' });
    expect(managerPending.map(sale => sale.id)).toEqual(['commented-newer', 'other-cashier']);
    expect(adminPending.map(sale => sale.id)).toEqual(['commented-newer', 'other-cashier']);
  });

  it('settles a fully paid sale by updating paid amount, discount, and status', () => {
    const updated = settleSale(sales[0], 50);
    expect(updated.amountPaid).toBe(500);
    expect(updated.discount).toBe(0);
    expect(updated.status).toBe('settled');
  });

  it('rejects overpayment and non-positive payments', () => {
    expect(() => settleSale(sales[0], 51)).toThrow('The amount exceeds the remaining balance');
    expect(() => settleSale(sales[0], 0)).toThrow('additionalAmountPaid must be greater than 0');
  });

  it('appends settlement notes while preserving existing comments', () => {
    const updated = settleSale(sales[0], 50);
    expect(updated.comment).toContain('Customer will return');
    expect(updated.comment).toContain('+50 DA paid on 2026-06-11T12:00:00.000Z');
  });
});
