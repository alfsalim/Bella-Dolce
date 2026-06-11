import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../hooks/useI18n';
import { isPrintAgentAvailable, printReceipt } from '../api/printAgent';
import type { LocalTransaction } from '../db/types';

// Ported from src/components/ReceiptPreview.tsx for visual parity, but
// printing goes directly to the local PrintAgent (api/printAgent.ts)
// instead of POST /api/print-receipt, since the server's PrintAgent URL
// only resolves on the server's own network. Tablets (no printAgentUrl
// configured) silently skip printing — on-screen receipt only (BRD §10.5).

type PrintStatus = 'printing' | 'done' | 'skipped' | 'error' | null;

interface Props {
  txn: LocalTransaction;
  receiptNumber: string;
  serverSaleId: string | null;
  onClose: () => void;
  autoCloseDelay?: number;
}

const ReceiptPreview: React.FC<Props> = ({ txn, receiptNumber, serverSaleId, onClose, autoCloseDelay = 5000 }) => {
  const { t, formatCurrency, isRTL } = useI18n();
  const [printStatus, setPrintStatus] = useState<PrintStatus>(null);
  const printedRef = useRef(false);

  const items = txn.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    lineTotal: item.price * item.quantity,
  }));

  const attemptPrint = async () => {
    setPrintStatus('printing');
    try {
      const available = await isPrintAgentAvailable();
      if (!available) {
        setPrintStatus('skipped');
        return;
      }
      await printReceipt(txn, receiptNumber, serverSaleId || txn.clientTxnId);
      setPrintStatus('done');
    } catch {
      setPrintStatus('error');
    }
  };

  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    attemptPrint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (printStatus === 'done' || printStatus === 'skipped' || printStatus === null) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [printStatus, autoCloseDelay, onClose]);

  const statusColor =
    printStatus === 'done'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : printStatus === 'error'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      : printStatus === 'printing'
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      : '';

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {printStatus && printStatus !== 'skipped' && (
        <div className={`mb-2 p-2 rounded text-center text-sm font-medium ${statusColor}`}>
          {printStatus === 'printing' ? '...' : printStatus === 'done' ? '✓' : '!'}
        </div>
      )}
      <div role="region" aria-label="receipt" className="flex-1 overflow-y-auto max-h-64 p-4 text-sm">
        <div className="text-center mb-4">
          <h2 className="font-bold text-lg">Boulangerie Bella-Dolce</h2>
          <p className="text-sm">SIDI-ABDELLAH ALGER</p>
        </div>

        <div className="text-center mb-4 text-xs">
          <p>{t('receiptNo')} {receiptNumber}</p>
        </div>

        <div className={`text-xs mb-4 space-y-1 ${isRTL ? 'text-right' : ''}`}>
          <div className="flex justify-between">
            <span>{t('cashier')}:</span>
            <span>{txn.cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('date')}:</span>
            <span>{new Date(txn.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('time')}:</span>
            <span>{new Date(txn.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="border-t border-b border-gray-300 dark:border-gray-600 py-2 mb-4">
          <div className="text-xs space-y-1 mb-2">
            <div className={`grid grid-cols-4 gap-1 font-semibold ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className={isRTL ? 'text-left' : ''}>{t('invoiceItem')}</span>
              <span className={isRTL ? 'text-left' : 'text-right'}>{t('qtyAbbrev')}</span>
              <span className={isRTL ? 'text-left' : 'text-right'}>{t('unitPrice')}</span>
              <span className={isRTL ? 'text-left' : 'text-right'}>{t('total')}</span>
            </div>
          </div>
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-4 gap-1 text-xs mb-1">
              <span className={`truncate ${isRTL ? 'text-left' : ''}`}>{item.name}</span>
              <span className={isRTL ? 'text-left' : 'text-right'}>{item.quantity}</span>
              <span className={isRTL ? 'text-left' : 'text-right'}>{item.unitPrice}</span>
              <span className={isRTL ? 'text-left' : 'text-right'}>{item.lineTotal}</span>
            </div>
          ))}
        </div>

        <div className={`mb-4 space-y-1 text-sm ${isRTL ? 'text-right' : ''}`}>
          <div className="flex justify-between font-semibold">
            <span>{t('totalAmount')}:</span>
            <span>{formatCurrency(txn.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>{t('paymentMethod')}:</span>
            <span>{txn.paymentMethod === 'cash' ? t('cash') : t('card')}</span>
          </div>
          {txn.paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between text-xs">
                <span>{t('amountPaid')}:</span>
                <span>{formatCurrency(txn.amountPaid)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>{t('changeDue')}:</span>
                <span>{formatCurrency(txn.change)}</span>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-300 dark:border-gray-600 pt-3 text-center text-xs italic text-gray-600 dark:text-gray-400">
          <p>{t('receiptFooter')}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {printStatus === 'error' && (
          <button
            onClick={attemptPrint}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm font-medium transition-colors"
          >
            {t('retry')}
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded text-sm font-medium transition-colors"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
};

export default ReceiptPreview;
