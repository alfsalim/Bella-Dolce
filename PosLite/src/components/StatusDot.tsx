import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { db } from '../db';
import { useI18n } from '../hooks/useI18n';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// Top-header indicator next to the cashier profile: 🟢 online / 🔴 offline,
// sync progress (synced / syncing X% / N queued), and a manual sync button.
const StatusDot: React.FC = () => {
  const { t } = useI18n();
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  const pendingCount = useLiveQuery(
    () => db.transactions.where('syncStatus').anyOf('pending', 'syncing', 'failed').count(),
    [],
    0
  );

  const meta = useLiveQuery(() => db.sync_meta.get('singleton'), [], undefined);

  const inProgress = meta?.syncInProgress ?? false;
  const batchTotal = meta?.syncBatchTotal ?? 0;
  const progressPct = inProgress && batchTotal > 0
    ? Math.round(((batchTotal - pendingCount) / batchTotal) * 100)
    : 0;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await chrome.runtime?.sendMessage?.({ type: 'pos-lite:sync-now' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17]">
      <span
        className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`}
        aria-label={online ? t('online') : t('offline')}
      />
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
        {online ? t('online') : t('offline')}
      </span>

      {online && pendingCount === 0 && (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-emerald-500 text-white">
          {t('fullySynced')}
        </span>
      )}

      {pendingCount > 0 && inProgress && (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white">
          {t('syncing')} {progressPct}%
        </span>
      )}

      {pendingCount > 0 && !inProgress && (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white">
          {pendingCount} {t('queued')}
        </span>
      )}

      {online && pendingCount > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing}
          aria-label={t('syncNow')}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
};

export default StatusDot;
