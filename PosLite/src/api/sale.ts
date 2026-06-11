import { authedFetch } from './client';
import type { LocalTransaction } from '../db/types';

// POST /api/sale (server.ts ~line 2343). Body shape mirrors what the live
// web POS sends (src/pages/POS.tsx handleCheckout), plus `clientTxnId` for
// idempotent dedupe (additive server.ts/schema.prisma change).
export async function pushSale(txn: LocalTransaction): Promise<{ id: string; cashierName?: string }> {
  const res = await authedFetch('/api/sale', {
    method: 'POST',
    body: JSON.stringify({
      customerId: txn.customerId,
      totalAmount: txn.totalAmount,
      amountPaid: txn.amountPaid,
      change: txn.change,
      paymentMethod: txn.paymentMethod,
      items: txn.items,
      comment: txn.comment,
      returnComment: txn.returnComment,
      clientTxnId: txn.clientTxnId,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);
  return data;
}
