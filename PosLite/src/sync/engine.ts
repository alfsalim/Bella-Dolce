import { db, updateSyncMeta } from '../db';
import { checkHealth } from '../api/client';
import { pushSale } from '../api/sale';
import { refreshProductCache } from '../api/products';
import { refreshUserCache } from '../api/users';

// Backoff schedule per BRD §7.3: 30s, 1m, 5m, 15m, capped.
const BACKOFF_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000];

function backoffFor(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
}

// BRD §7.2 sync flow. Triggered by online event, alarm tick, or manual sync.
// One-way push: on success the local row is purged immediately (no archive),
// per the user's "always clear after sync" requirement.
export async function runSyncCycle(): Promise<{ online: boolean; synced: number; failed: number }> {
  const online = await checkHealth();
  if (!online) return { online: false, synced: 0, failed: 0 };

  const pending = await db.transactions
    .where('syncStatus')
    .anyOf('pending', 'failed')
    .sortBy('createdAt');

  let synced = 0;
  let failed = 0;

  if (pending.length === 0) {
    await updateSyncMeta({ syncInProgress: false, syncBatchTotal: 0 });
    return { online: true, synced: 0, failed: 0 };
  }

  await updateSyncMeta({ syncInProgress: true, syncBatchTotal: pending.length });

  for (const txn of pending) {
    if (txn.syncStatus === 'failed') {
      const dueAt = new Date(txn.createdAt).getTime() + backoffFor(txn.syncAttempts);
      if (Date.now() < dueAt) continue;
    }

    await db.transactions.update(txn.clientTxnId, { syncStatus: 'syncing' });

    try {
      const result = await pushSale(txn);
      await db.transactions.delete(txn.clientTxnId);
      synced++;
      void result;
    } catch (err) {
      await db.transactions.update(txn.clientTxnId, {
        syncStatus: 'failed',
        syncAttempts: txn.syncAttempts + 1,
        lastSyncError: (err as Error).message,
      });
      failed++;
    }
  }

  const remaining = await db.transactions.where('syncStatus').anyOf('pending', 'syncing', 'failed').count();
  await updateSyncMeta({
    lastTxnPushAt: new Date().toISOString(),
    syncInProgress: remaining > 0,
    syncBatchTotal: remaining > 0 ? Math.max(pending.length, remaining) : 0,
  });

  // Refresh users cache after every successful sync cycle (in addition to
  // the slow alarm), per the "always sync again to refresh" requirement.
  if (synced > 0) {
    await refreshUserCache().catch(() => {});
  }

  return { online: true, synced, failed };
}

// BRD §7.4: refresh product cache when online (app open + slow alarm).
export async function refreshCachesIfOnline(): Promise<void> {
  const online = await checkHealth();
  if (!online) return;
  await refreshProductCache().catch(() => {});
  await refreshUserCache().catch(() => {});
}

// Retry a single failed transaction immediately (failed-txn panel "Retry").
export async function retryTransaction(clientTxnId: string): Promise<void> {
  const txn = await db.transactions.get(clientTxnId);
  if (!txn) return;
  await db.transactions.update(clientTxnId, { syncStatus: 'pending' });
  await runSyncCycle();
}
