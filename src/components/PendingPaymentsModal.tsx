import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Search, Wallet, X } from 'lucide-react';
import { PAGE_SIZE } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch, getAuthHeaders, parseJsonResponse, readApiErrorMessage } from '../lib/api-client';
import { generateTransactionId } from '../lib/transactionId';

interface Sale {
  id: string;
  cashierId: string;
  createdAt: string;
  totalAmount: number;
  amountPaid?: number | null;
  discount?: number | null;
  comment?: string | null;
  status?: string | null;
}

interface PendingPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierId: string;
  userRole?: string;
  onSettled?: (sale: Sale) => void;
}

interface PendingPaymentsResponse {
  sales: Sale[];
  total: number;
  page: number;
  pageSize: number;
}

export default function PendingPaymentsModal({ isOpen, onClose, onSettled }: PendingPaymentsModalProps) {
  const { t, isRTL, formatCurrency } = useLanguage();
  const [remainingFilter, setRemainingFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [additionalAmount, setAdditionalAmount] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const safePage = Math.min(page, totalPages);
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (!isOpen) return;
    const timeout = window.setTimeout(() => {
      setDebouncedFilter(remainingFilter.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [remainingFilter, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedFilter) params.set('remaining', debouncedFilter);

    (async () => {
      try {
        const response = await authFetch(`/api/sales/pending-payments?${params.toString()}`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response));
        }

        const data = await parseJsonResponse<PendingPaymentsResponse>(response);
        if (cancelled) return;
        setSales(data.sales || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error fetching pending payments');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, page, debouncedFilter]);

  useEffect(() => {
    if (!isOpen) {
      setRemainingFilter('');
      setDebouncedFilter('');
      setSales([]);
      setPage(1);
      setTotal(0);
      setError(null);
      setSuccessMessage(null);
      setSettlingId(null);
      setAdditionalAmount('');
      setSettleError(null);
      setIsSettling(false);
    }
  }, [isOpen]);

  const openSettleForm = (sale: Sale) => {
    setSettlingId(sale.id);
    setAdditionalAmount(String(sale.discount ?? ''));
    setSettleError(null);
  };

  const handleSettle = async (sale: Sale) => {
    const value = Number(additionalAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setSettleError(t('overpaymentError'));
      return;
    }
    if (value > Number(sale.discount ?? 0)) {
      setSettleError(t('overpaymentError'));
      return;
    }

    setIsSettling(true);
    setSettleError(null);
    try {
      const response = await authFetch(`/api/sale/${sale.id}/settle-payment`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ additionalAmountPaid: value }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response));
      }

      const updated = await response.json() as Sale;
      setSales(prev => prev.filter(item => item.id !== sale.id));
      setTotal(prev => Math.max(0, prev - 1));
      setSettlingId(null);
      setAdditionalAmount('');
      setSuccessMessage(t('paymentSettled'));
      window.setTimeout(() => setSuccessMessage(null), 3000);
      onSettled?.(updated);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsSettling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            {t('pendingPayments')}
          </h2>
          <button
            onClick={onClose}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
            <span>{t('close')}</span>
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
            {t('remainingAmount')}
          </label>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              inputMode="decimal"
              value={remainingFilter}
              onChange={event => setRemainingFilter(event.target.value)}
              placeholder={t('filterByRemainingAmount')}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {successMessage && (
          <div className="mb-3 text-green-700 dark:text-green-400 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-sm font-medium">
            {successMessage}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && sales.length === 0 && (
          <div className="text-slate-500 dark:text-slate-400 text-center py-8 text-sm">
            {t('noPendingPayments')}
          </div>
        )}

        {!isLoading && !error && sales.length > 0 && (
          <>
            <div className="overflow-y-auto flex-1 -mx-6 px-6 overflow-x-hidden">
              <table className="w-full text-[11px] table-fixed">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="w-[18%] text-left p-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('transactionId')}</th>
                    <th className="w-[13%] text-left p-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('time')}</th>
                    <th className="w-[12%] text-right p-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('total')}</th>
                    <th className="w-[13%] text-right p-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('amountPaid')}</th>
                    <th className="w-[14%] text-right p-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('remainingAmount')}</th>
                    <th className="w-[18%] text-left p-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('comment')}</th>
                    <th className="w-[12%] text-center p-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <React.Fragment key={sale.id}>
                      <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-2 text-slate-900 dark:text-white font-mono font-bold truncate">
                          {generateTransactionId(sale.createdAt)}
                        </td>
                        <td className="p-2 text-slate-900 dark:text-white truncate">
                          {new Date(sale.createdAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-2 text-right font-bold text-slate-900 dark:text-white truncate">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="p-2 text-right text-slate-700 dark:text-slate-300 truncate">
                          {formatCurrency(Number(sale.amountPaid ?? 0))}
                        </td>
                        <td className="p-2 text-right font-bold text-amber-700 dark:text-amber-400 truncate">
                          {formatCurrency(Number(sale.discount ?? 0))}
                        </td>
                        <td className="p-2 text-slate-600 dark:text-slate-400 truncate">
                          {sale.comment || '—'}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => openSettleForm(sale)}
                            className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                            title={t('settlePayment')}
                            aria-label={t('settlePayment')}
                          >
                            <Wallet className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {settlingId === sale.id && (
                        <tr className="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="w-44 max-w-full">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2">
                                  {t('amountReceived')} <span className="text-red-600">*</span>
                                </label>
                                <input
                                  autoFocus
                                  required
                                  type="number"
                                  inputMode="decimal"
                                  value={additionalAmount}
                                  onChange={event => setAdditionalAmount(event.target.value)}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                              </div>
                              <button
                                onClick={() => handleSettle(sale)}
                                disabled={isSettling}
                                className="h-10 px-4 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                              >
                                {!isSettling && <Check className="w-4 h-4" />}
                                <span>{isSettling ? t('loading') : t('confirm')}</span>
                              </button>
                            </div>
                            {settleError && (
                              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{settleError}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setPage(value => Math.max(1, value - 1))}
                  disabled={safePage === 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <PrevIcon className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(value => Math.min(totalPages, value + 1))}
                  disabled={safePage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <NextIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
