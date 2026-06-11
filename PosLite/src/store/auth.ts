import { create } from 'zustand';
import bcrypt from 'bcryptjs';
import { db, updateSyncMeta, getSyncMeta } from '../db';
import { login as apiLogin, checkHealth } from '../api/client';
import { refreshProductCache } from '../api/products';
import { refreshUserCache } from '../api/users';

interface CashierProfile {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthState {
  cashier: CashierProfile | null;
  error: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  cashier: null,
  error: null,
  loading: false,

  signIn: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const online = await checkHealth();

      if (online) {
        // Cashier login (normal expiry). A separate deviceLogin: true call
        // provisions sync_meta.authToken once during device setup.
        const result = await apiLogin(username, password, false);
        await updateSyncMeta({ authToken: result.token });
        set({
          cashier: {
            id: result.user.id,
            username: result.user.username,
            name: result.user.name,
            role: result.user.role,
          },
          loading: false,
        });
        await refreshProductCache().catch(() => {});
        await refreshUserCache().catch(() => {});
        return;
      }

      // Offline login (BRD §9): verify against locally cached
      // {username, password (bcrypt hash)}. KNOWN GAP (see api/users.ts):
      // the local cache currently has no `password`/`username` because no
      // existing endpoint returns them together, so this path cannot
      // succeed yet — surface that clearly instead of pretending it works.
      const cached = await db.users.where('username').equals(username).first();
      if (!cached || !cached.password) {
        set({
          loading: false,
          error:
            'Offline login unavailable: backend has no endpoint returning username + password hash for device provisioning (see api/users.ts).',
        });
        return;
      }

      const ok = bcrypt.compareSync(password, cached.password);
      if (!ok) {
        set({ loading: false, error: 'invalidCredentials' });
        return;
      }

      set({
        cashier: { id: cached.id, username: cached.username, name: cached.name, role: cached.role },
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  signOut: () => set({ cashier: null }),
}));

// Device provisioning: one-time long-lived token for background sync,
// independent of the cashier's UI session token.
export async function provisionDevice(username: string, password: string): Promise<void> {
  const result = await apiLogin(username, password, true);
  const meta = await getSyncMeta();
  await updateSyncMeta({ ...meta, authToken: result.token });
}
