import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useI18n } from '../hooks/useI18n';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// Top-header indicator next to the cashier profile: 🟢 online / 🔴 offline,
// with a pending-count badge when transactions are queued.
const StatusDot: React.FC = () => {
  const { t } = useI18n();
  const online = useOnlineStatus();

  const pendingCount = useLiveQuery(
    () => db.transactions.where('syncStatus').anyOf('pending', 'syncing', 'failed').count(),
    [],
    0
  );

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17]">
      <span
        className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`}
        aria-label={online ? t('online') : t('offline')}
      />
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
        {online ? t('online') : t('offline')}
      </span>
      {pendingCount > 0 && (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white">
          {pendingCount} {t('queued')}
        </span>
      )}
    </div>
  );
};

export default StatusDot;
