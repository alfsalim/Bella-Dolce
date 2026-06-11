import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { retryTransaction } from '../sync/engine';
import { useI18n } from '../hooks/useI18n';

// BRD §10.4: the only reporting surface — exists for data integrity, not analytics.
const FailedTxnPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t, formatCurrency } = useI18n();
  const failed = useLiveQuery(() => db.transactions.where('syncStatus').equals('failed').toArray(), [], []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-black/40">
      <div className="w-full max-w-sm h-full bg-white dark:bg-black border-l border-slate-200 dark:border-[#2a1e17] p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('failedSales')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
        </div>
        {failed.length === 0 ? (
          <p className="text-sm text-slate-400">{t('noFailedSales')}</p>
        ) : (
          <div className="space-y-3">
            {failed.map((txn) => (
              <div key={txn.clientTxnId} className="p-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10">
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                  <span>{formatCurrency(txn.totalAmount)}</span>
                  <span>{new Date(txn.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">{txn.lastSyncError}</p>
                <button
                  onClick={() => retryTransaction(txn.clientTxnId)}
                  className="mt-2 w-full py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {t('retry')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FailedTxnPanel;
