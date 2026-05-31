import React, { useState, useEffect } from 'react';
import { Printer, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch, getAuthHeaders } from '../lib/api-client';
import { generateTransactionId } from '../lib/transactionId';
import ReceiptPreview from './ReceiptPreview';

const PAGE_SIZE = 15;

interface Sale {
  id: string;
  cashierId: string;
  createdAt: string;
  totalAmount: number;
  amountPaid?: number;
  change?: number;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
  items?: string;
  cashierName?: string;
  comment?: string;
  returnComment?: string;
  status?: string;
}

interface RecentSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierId: string;
  userRole?: string;
}

export default function RecentSalesModal({ isOpen, onClose, cashierId, userRole }: RecentSalesModalProps) {
  const { t, isRTL } = useLanguage();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [page, setPage] = useState(1);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);
    setSales([]);
    setPage(1);

    const today = new Date().toISOString().split('T')[0];

    (async () => {
      try {
        const token = localStorage.getItem('bakery_token');
        const response = await authFetch(
          `/api/sales?date=${today}&limit=500&sort=desc`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          }
        );

        if (!response.ok) {
          setError('Failed to load sales');
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setSales(data.sales || []);
        setIsLoading(false);
      } catch (err) {
        setError('Error fetching sales');
        setIsLoading(false);
      }
    })();
  }, [isOpen, cashierId]);

  const getPaymentMethodLabel = (method: string) => {
    const upperMethod = method?.toUpperCase() || '';
    switch (upperMethod) {
      case 'CASH': return t('cash');
      case 'CARD': return t('card');
      case 'TRANSFER': return t('transfer');
      default: return method;
    }
  };

  const canCancel = (sale: Sale) => {
    if (sale.status === 'cancelled') return false;
    if (userRole === 'cashier') return sale.cashierId === cashierId;
    return true;
  };

  const handleCancelClick = (saleId: string) => {
    setCancellingId(saleId);
    setCancelReason('');
    setCancelError(null);
  };

  const handleCancelConfirm = async () => {
    if (!cancellingId) return;
    setCancelError(null);
    try {
      const res = await authFetch(`/api/sale/${cancellingId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCancelError(data.error || 'Failed to cancel');
        return;
      }
      setSales(prev => prev.map(s => s.id === cancellingId ? { ...s, status: 'cancelled' } : s));
      setCancellingId(null);
      setCancelReason('');
      setSuccessMessage(t('transactionCancelled'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setCancelError('Network error');
    }
  };

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sales.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('recentSales')}</h2>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
              aria-label={t('close')}
            >
              <X className="w-4 h-4" />
              <span>{t('close')}</span>
            </button>
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
              {t('noSalesToday')}
            </div>
          )}

          {!isLoading && !error && sales.length > 0 && (
            <>
              <div className="overflow-y-auto flex-1 -mx-6 px-6 overflow-x-hidden">
                <table className="w-full text-sm table-fixed">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('transactionId') || 'Transaction ID'}
                      </th>
                      <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('time')}
                      </th>
                      <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('products') || 'Products'}
                      </th>
                      <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('amount')}
                      </th>
                      <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('paymentMethod')}
                      </th>
                      <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('comment') || 'Comment'}
                      </th>
                      <th className="text-center p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('reprint')}
                      </th>
                      <th className="text-center p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                        {t('status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr
                          className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${
                            sale.status === 'cancelled'
                              ? 'opacity-60 bg-red-50/40 dark:bg-red-900/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="p-3 text-slate-900 dark:text-white font-mono text-xs font-bold">
                            {generateTransactionId(sale.createdAt)}
                          </td>
                          <td className="p-3 text-slate-900 dark:text-white">
                            {new Date(sale.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 text-xs max-w-xs">
                            {sale.items ? (() => {
                              try {
                                const items = JSON.parse(sale.items);
                                return items.slice(0, 2).map((item: any) =>
                                  `${item.name || `Product ${item.productId}`} (${item.quantity})`
                                ).join(', ') + (items.length > 2 ? '...' : '');
                              } catch {
                                return t('noProducts') || 'No products';
                              }
                            })() : t('noProducts') || 'No products'}
                          </td>
                          <td className={`p-3 font-bold ${sale.status === 'cancelled' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {sale.totalAmount.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {getPaymentMethodLabel(sale.paymentMethod)}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 text-xs font-medium">
                            {sale.comment || '—'}
                          </td>
                          <td className="p-3 text-center">
                            {sale.status !== 'cancelled' && (
                              <button
                                onClick={() => setSelectedSaleForReceipt(sale)}
                                className="p-2.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                title={t('reprint')}
                                aria-label={`${t('reprint')} ${sale.id}`}
                              >
                                <Printer className="w-5 h-5" />
                              </button>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {sale.status === 'cancelled' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                {t('cancelled')}
                              </span>
                            ) : canCancel(sale) ? (
                              <button
                                onClick={() => handleCancelClick(sale.id)}
                                className="px-2 py-0.5 text-xs font-semibold rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                aria-label={`${t('cancelTransaction')} ${sale.id}`}
                              >
                                {t('cancel')}
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>

                        {cancellingId === sale.id && (
                          <tr className="bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                                  {t('cancelConfirm')}
                                </p>
                                <input
                                  type="text"
                                  value={cancelReason}
                                  onChange={e => setCancelReason(e.target.value)}
                                  placeholder={t('cancelReason')}
                                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400"
                                />
                                {cancelError && (
                                  <p className="text-xs text-red-600 dark:text-red-400">{cancelError}</p>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleCancelConfirm}
                                    className="px-4 py-1.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                  >
                                    {t('confirm') || 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => { setCancellingId(null); setCancelError(null); }}
                                    className="px-4 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  >
                                    {t('close')}
                                  </button>
                                </div>
                              </div>
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
                    onClick={() => setPage(p => Math.max(1, p - 1))}
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
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

      {selectedSaleForReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <ReceiptPreview
              receiptNumber={generateTransactionId(selectedSaleForReceipt.createdAt)}
              storeName="Boulangerie Bella-Dolce"
              storeAddress="SIDI-ABDELLAH ALGER"
              items={selectedSaleForReceipt.items ? JSON.parse(selectedSaleForReceipt.items).map((item: any) => ({
                name: item.name || `Product ${item.productId}`,
                quantity: item.quantity,
                unitPrice: item.price || item.unitPrice || 0,
                lineTotal: (item.price || item.unitPrice || 0) * item.quantity
              })) : []}
              totalAmount={selectedSaleForReceipt.totalAmount}
              paymentMethod={selectedSaleForReceipt.paymentMethod.toLowerCase() as 'cash' | 'card' | 'transfer'}
              amountPaid={selectedSaleForReceipt.amountPaid || selectedSaleForReceipt.totalAmount}
              change={selectedSaleForReceipt.change || 0}
              cashierName={selectedSaleForReceipt.cashierName || cashierId}
              dateTime={new Date(selectedSaleForReceipt.createdAt)}
              saleId={selectedSaleForReceipt.id}
              onClose={() => setSelectedSaleForReceipt(null)}
              autoCloseDelay={5000}
            />
          </div>
        </div>
      )}
    </>
  );
}
