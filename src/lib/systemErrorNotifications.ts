const STORAGE_KEY = 'bd_system_error_events';
const MAX_EVENTS = 40;

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

function pushEvent(evt: SystemErrorEvent) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list: SystemErrorEvent[] = raw ? JSON.parse(raw) : [];
    list.unshift(evt);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_EVENTS)));
  } catch {
    /* ignore quota / private mode */
  }
  try {
    window.dispatchEvent(new CustomEvent('bd-system-notification'));
  } catch {
    /* non-browser */
  }
}

/** Record a backend / Firestore failure for the staff notification bell. Rate-limits identical bursts. */
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

  const id = `${now}_${Math.random().toString(36).slice(2, 9)}`;
  pushEvent({
    id,
    at: now,
    collection: detail.collection,
    operation: detail.operation,
    message: msg,
  });
}

export function readStaffSystemErrors(): SystemErrorEvent[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SystemErrorEvent[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
