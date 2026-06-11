import { getSyncMeta } from '../db';

// All paths below mirror existing server.ts endpoints verbatim — see
// /api/auth/login, /api/db/products, /api/sale, /api/health (server.ts).

async function apiUrl(path: string): Promise<string> {
  const meta = await getSyncMeta();
  const base = meta.serverBaseUrl.replace(/\/$/, '');
  return `${base}${path}`;
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const meta = await getSyncMeta();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (meta.authToken) headers.set('Authorization', `Bearer ${meta.authToken}`);
  return fetch(await apiUrl(path), { ...init, headers });
}

export interface LoginResponse {
  user: { id: string; username: string; name: string; role: string };
  token: string;
  allowedPaths: string[];
}

// POST /api/auth/login (server.ts ~line 1239). `deviceLogin: true` issues a
// long-lived (30d) token for the background sync engine (server.ts change).
export async function login(username: string, password: string, deviceLogin = false): Promise<LoginResponse> {
  const res = await fetch(await apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, deviceLogin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

// GET /api/health (server.ts ~line 2960) — used as the reachability check.
export async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(await apiUrl('/api/health'), { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
