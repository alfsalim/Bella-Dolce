import { authedFetch } from './client';
import { db, updateSyncMeta } from '../db';

// KNOWN BACKEND GAP (BRD §15): no existing endpoint returns username +
// password hash together. GET /api/db/users strips `password` via
// sanitizeUser() (server.ts ~line 1732), and GET /api/cashiers returns only
// {id, name, role}. Until the backend exposes a credentials-bearing
// endpoint for device provisioning, the local `users` cache cannot be
// populated and offline login cannot be implemented as specified.
//
// This function is a placeholder that surfaces the gap loudly rather than
// silently producing a non-functional offline login.
export async function refreshUserCache(): Promise<void> {
  const res = await authedFetch('/api/cashiers');
  if (!res.ok) throw new Error('Failed to fetch cashiers');
  const cashiers: Array<{ id: string; name: string; role: string }> = await res.json();

  // Cannot populate `password` — offline login will be unavailable until
  // the backend gap above is resolved. We still cache id/name/role so the
  // UI can show "logged in as" info when online.
  await db.transaction('rw', db.users, async () => {
    await db.users.clear();
    await db.users.bulkPut(
      cashiers.map((c) => ({ id: c.id, username: '', name: c.name, role: c.role, password: '' }))
    );
  });

  await updateSyncMeta({ lastUserSyncAt: new Date().toISOString() });
}
