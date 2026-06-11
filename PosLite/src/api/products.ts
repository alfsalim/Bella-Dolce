import { authedFetch } from './client';
import { db, updateSyncMeta } from '../db';
import type { LocalProduct } from '../db/types';

// GET /api/db/products (server.ts ~line 1660). Server already filters
// disabled:false; response fields are mirrored verbatim into LocalProduct.
export async function refreshProductCache(): Promise<void> {
  const res = await authedFetch('/api/db/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  const products: LocalProduct[] = await res.json();

  await db.transaction('rw', db.products, async () => {
    await db.products.clear();
    await db.products.bulkPut(products);
  });

  await updateSyncMeta({ lastProductSyncAt: new Date().toISOString() });
}
