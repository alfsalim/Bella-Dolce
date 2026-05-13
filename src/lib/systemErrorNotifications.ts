import { authFetch } from './api-client';

export type SystemErrorEvent = {
  id: string;
  at: number;
  collection?: string;
  operation?: string;
  message: string;
};

let lastDedupeSig = '';
let lastDedupeAt = 0;
const DEDUPE_MS = 20_000;

/** Record a backend failure for the staff notification bell. Rate-limits identical bursts. */
export function recordStaffSystemError(detail: {
  collection?: string;
  operation?: string;
  message: string;
}) {
  const msg = (detail.message || 'Error').slice(0, 400);
  const sig = `${detail.collection ?? ''}:${msg}`;
  const now = Date.now();
  if (sig === lastDedupeSig && now - lastDedupeAt < DEDUPE_MS) return;
  lastDedupeSig = sig;
  lastDedupeAt = now;

  // Fire-and-forget — do not block the caller
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('bakery_token') : null;
  authFetch('/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      type: 'system_error',
      message: msg,
      collection: detail.collection,
      operation: detail.operation,
    }),
  }).catch(() => { /* ignore — we're already handling an error */ });

  try {
    window.dispatchEvent(new CustomEvent('bd-system-notification'));
  } catch {
    /* non-browser */
  }
}

export async function readStaffSystemErrors(): Promise<SystemErrorEvent[]> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('bakery_token') : null;
    if (!token) return [];
    const res = await authFetch('/api/events', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const events = await res.json();
    if (!Array.isArray(events)) return [];
    return events.map((e: any) => ({
      id: e.id,
      at: new Date(e.createdAt).getTime(),
      collection: e.collection ?? undefined,
      operation: e.operation ?? undefined,
      message: e.message,
    }));
  } catch {
    return [];
  }
}

export async function clearStaffSystemErrors(): Promise<void> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('bakery_token') : null;
    if (!token) return;
    await authFetch('/api/events', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* ignore */
  }
}
