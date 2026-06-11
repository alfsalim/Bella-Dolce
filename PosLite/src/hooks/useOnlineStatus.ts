import { useEffect, useState } from 'react';
import { checkHealth } from '../api/client';

// Reachability of the backend (GET /api/health), polled every 30s and on
// browser online/offline events. Shared by StatusDot and the POS screen's
// "server is online, use the main POS" guard.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const reachable = await checkHealth();
      if (!cancelled) setOnline(reachable);
    };
    poll();
    const interval = setInterval(poll, 30_000);
    window.addEventListener('online', poll);
    window.addEventListener('offline', () => setOnline(false));
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', poll);
    };
  }, []);

  return online;
}
