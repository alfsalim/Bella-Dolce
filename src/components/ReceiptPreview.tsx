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

type PrintStatus = 'printing' | 'done' | 'error' | null;

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

  useEffect(() => {
    if (!saleId) return;

    const callPrintAPI = async () => {
      try {
        setPrintStatus('printing');
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

        if (res.ok) {
          setPrintStatus('done');
        } else {
          setPrintStatus('error');
        }
      } catch (error) {
        console.error('Print API error:', error);
        setPrintStatus('error');
      }
    };

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
        return 'bg-yellow-100 text-yellow-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
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
          <h2 className="font-bold text-lg">{storeName}</h2>
          <p className="text-sm">{storeAddress}</p>
        </div>

        <div className="text-center mb-4 text-xs">
          <p>Reçu n° {receiptNumber}</p>
        </div>

        <div className="text-xs mb-4 space-y-1">
          <div className="flex justify-between">
            <span>Caissier:</span>
            <span>{cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{formatDate(dateTime)}</span>
          </div>
          <div className="flex justify-between">
            <span>Heure:</span>
            <span>{formatTime(dateTime)}</span>
          </div>
        </div>

        <div className="border-t border-b border-gray-300 py-2 mb-4">
          <div className="text-xs space-y-1 mb-2">
            <div className="grid grid-cols-4 gap-1 font-semibold">
              <span>Article</span>
              <span className="text-right">Qté</span>
              <span className="text-right">P.U.</span>
              <span className="text-right">Total</span>
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
            <span>Montant total:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Mode de paiement:</span>
            <span>{paymentMethodLabel}</span>
          </div>
          {paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between text-xs">
                <span>Montant payé:</span>
                <span>{formatCurrency(amountPaid || 0)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Monnaie:</span>
                <span>{formatCurrency(change || 0)}</span>
              </div>
            </>
          )}
        </div>

        <div className="border-t pt-3 text-center text-xs italic text-gray-600">
          <p>{t('receiptFooter')}</p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="mt-4 w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm font-medium"
        aria-label="close"
      >
        Fermer
      </button>
    </div>
  );
};

export default ReceiptPreview;
