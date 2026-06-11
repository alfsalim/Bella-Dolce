import Dexie, { type EntityTable } from 'dexie';
import type { LocalProduct, LocalTransaction, LocalUser, SyncMeta } from './types';

export const db = new Dexie('pos-lite') as Dexie & {
  transactions: EntityTable<LocalTransaction, 'clientTxnId'>;
  products: EntityTable<LocalProduct, 'id'>;
  users: EntityTable<LocalUser, 'id'>;
  sync_meta: EntityTable<SyncMeta, 'id'>;
};

db.version(1).stores({
  transactions: 'clientTxnId, syncStatus, createdAt',
  products: 'id, category',
  users: 'id, username',
  sync_meta: 'id',
});

export async function getSyncMeta(): Promise<SyncMeta> {
  const existing = await db.sync_meta.get('singleton');
  if (existing) return existing;
  const fresh: SyncMeta = {
    id: 'singleton',
    serverBaseUrl: 'http://localhost:3100',
    authToken: null,
    deviceId: crypto.randomUUID(),
    printAgentUrl: 'http://localhost:5555',
    lastProductSyncAt: null,
    lastUserSyncAt: null,
    lastTxnPushAt: null,
    theme: 'dark',
    lang: 'fr',
  };
  await db.sync_meta.put(fresh);
  return fresh;
}

export async function updateSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  const current = await getSyncMeta();
  await db.sync_meta.put({ ...current, ...patch });
}

export type { LocalProduct, LocalTransaction, LocalUser, SyncMeta };
