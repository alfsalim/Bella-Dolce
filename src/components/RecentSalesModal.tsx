import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../lib/api-client';
import ReceiptPreview from './ReceiptPreview';

interface Sale {
  id: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
}

interface RecentSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierId: string;
}

export default function RecentSalesModal({ isOpen, onClose, cashierId }: RecentSalesModalProps) {
  const { t } = useLanguage();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);
    setSales([]);

    const today = new Date().toISOString().split('T')[0];

    (async () => {
      try {
        const token = localStorage.getItem('bakery_token');
        const url = `/api/sales?date=${today}&limit=20&sort=desc`;

        const response = await authFetch(
          url,
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
    switch (method) {
      case 'CASH':
        return t('cash') || 'Espèces';
      case 'CARD':
        return t('card') || 'Carte';
      case 'TRANSFER':
        return t('transfer') || 'Virement';
      default:
        return method;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('recentSales')}</h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

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
            <div className="overflow-y-auto flex-1 -mx-6 px-6">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                      {t('time') || 'Time'}
                    </th>
                    <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                      {t('amount') || 'Amount'}
                    </th>
                    <th className="text-left p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                      {t('paymentMethod') || 'Payment'}
                    </th>
                    <th className="text-center p-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest">
                      {t('reprint')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-3 text-slate-900 dark:text-white">
                        {new Date(sale.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {sale.totalAmount.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {getPaymentMethodLabel(sale.paymentMethod)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedSaleForReceipt(sale)}
                          className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                          title={t('reprint')}
                          aria-label={`${t('reprint')} ${sale.id}`}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedSaleForReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <ReceiptPreview
              receiptNumber={`${new Date(selectedSaleForReceipt.createdAt).toISOString().split('T')[0].replace(/-/g, '')}-001`}
              storeName="Boulangerie Bella-Dolce"
              storeAddress="SIDI-ABDELLAH ALGER"
              items={[]}
              totalAmount={selectedSaleForReceipt.totalAmount}
              paymentMethod={selectedSaleForReceipt.paymentMethod.toLowerCase() as 'cash' | 'card' | 'transfer'}
              amountPaid={0}
              change={0}
              cashierName={cashierId}
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
