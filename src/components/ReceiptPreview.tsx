import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../lib/api-client';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface ReceiptPreviewProps {
  receiptNumber: string;
  storeName: string;
  storeAddress: string;
  items: ReceiptItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'card';
  amountPaid?: number;
  change?: number;
  cashierName: string;
  dateTime: Date;
  autoCloseDelay?: number;
  onClose: () => void;
  saleId?: string;
}

export type PrintStatus = 'printing' | 'done' | 'error' | 'printer_unavailable' | null;
export interface PrintError {
  status: string;
  message?: string;
}

const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  receiptNumber,
  storeName,
  storeAddress,
  items,
  totalAmount,
  paymentMethod,
  amountPaid,
  change,
  cashierName,
  dateTime,
  autoCloseDelay = 5000,
  onClose,
  saleId,
}) => {
  const { t, formatCurrency } = useLanguage();
  const [printStatus, setPrintStatus] = useState<PrintStatus>(saleId ? 'printing' : null);
  const [printError, setPrintError] = useState<PrintError | null>(null);

  const callPrintAPI = async () => {
    if (!saleId) return;

    try {
      setPrintStatus('printing');
      setPrintError(null);
      const token = localStorage.getItem('bakery_token');
      const res = await authFetch('/api/print-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          saleId,
          items,
          total: totalAmount,
          amountPaid,
          paymentMethod,
          receiptNumber
        })
      });

      if (!res.ok) {
        setPrintStatus('error');
        setPrintError({ status: 'error', message: 'unknown' });
        return;
      }

      const data = await res.json();

      if (data.status === 'error') {
        setPrintStatus('printer_unavailable');
        setPrintError(data);
      } else if (data.status === 'queued') {
        setPrintStatus('done');
      } else {
        setPrintStatus('error');
        setPrintError(data);
      }
    } catch (error) {
      console.error('Print API error:', error);
      setPrintStatus('error');
      setPrintError({ status: 'error', message: 'unknown' });
    }
  };

  useEffect(() => {
    if (!saleId) return;
    callPrintAPI();
  }, [saleId, items, totalAmount, amountPaid, paymentMethod, receiptNumber]);

  useEffect(() => {
    if (printStatus === 'done' || !saleId) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [printStatus, autoCloseDelay, onClose, saleId]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const paymentMethodLabel = paymentMethod === 'cash' ? t('cashPayment') : t('cardPayment');

  const getPrintStatusColor = () => {
    switch (printStatus) {
      case 'printing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'done':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'error':
      case 'printer_unavailable':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return '';
    }
  };

  const getPrintStatusLabel = () => {
    switch (printStatus) {
      case 'printing':
        return t('printingReceipt');
      case 'done':
        return t('printingDone');
      case 'printer_unavailable':
        return t('printerUnavailable');
      case 'error':
        return t('printingError');
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {printStatus && (
        <div className={`mb-2 p-2 rounded text-center text-sm font-medium ${getPrintStatusColor()}`}>
          {getPrintStatusLabel()}
        </div>
      )}
      <div role="region" aria-label="receipt" className="flex-1 overflow-y-auto max-h-64 p-4">
        <div className="text-center mb-4">
          <h2 className="font-bold text-lg">{t('storeName') || storeName}</h2>
          <p className="text-sm">{t('storeAddress') || storeAddress}</p>
        </div>

        <div className="text-center mb-4 text-xs">
          <p>{t('receiptNo')} {receiptNumber}</p>
        </div>

        <div className="text-xs mb-4 space-y-1">
          <div className="flex justify-between">
            <span>{t('cashier')}:</span>
            <span>{cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('date')}:</span>
            <span>{formatDate(dateTime)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('time')}:</span>
            <span>{formatTime(dateTime)}</span>
          </div>
        </div>

        <div className="border-t border-b border-gray-300 py-2 mb-4">
          <div className="text-xs space-y-1 mb-2">
            <div className="grid grid-cols-4 gap-1 font-semibold">
              <span>{t('invoiceItem')}</span>
              <span className="text-right">{t('qtyAbbrev')}</span>
              <span className="text-right">{t('unitPrice')}</span>
              <span className="text-right">{t('total')}</span>
            </div>
          </div>
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-4 gap-1 text-xs mb-1">
              <span className="truncate">{item.name}</span>
              <span className="text-right">{item.quantity}</span>
              <span className="text-right">{item.unitPrice}</span>
              <span className="text-right">{item.lineTotal}</span>
            </div>
          ))}
        </div>

        <div className="mb-4 space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>{t('totalAmount')}:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>{t('paymentMethod')}:</span>
            <span>{paymentMethodLabel}</span>
          </div>
          {paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between text-xs">
                <span>{t('amountPaid')}:</span>
                <span>{formatCurrency(amountPaid || 0)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>{t('changeDue')}:</span>
                <span>{formatCurrency(change || 0)}</span>
              </div>
            </>
          )}
        </div>

        <div className="border-t pt-3 text-center text-xs italic text-gray-600">
          <p>{t('receiptFooter')}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {printStatus === 'printer_unavailable' && (
          <button
            onClick={callPrintAPI}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm font-medium transition-colors"
            aria-label="retry print"
          >
            {t('retryPrint')}
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded text-sm font-medium transition-colors"
          aria-label="close"
        >
          {t('close') || 'Fermer'}
        </button>
      </div>
    </div>
  );
};

export default ReceiptPreview;
