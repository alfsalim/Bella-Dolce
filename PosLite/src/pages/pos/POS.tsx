import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, X, Settings as SettingsIcon } from 'lucide-react';
import clsx from 'clsx';
import { db } from '../../db';
import type { LocalProduct, LocalSaleItem, LocalTransaction } from '../../db/types';
import { useI18n } from '../../hooks/useI18n';
import { useAuthStore } from '../../store/auth';
import StatusDot from '../../components/StatusDot';
import FailedTxnPanel from '../../components/FailedTxnPanel';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import ReceiptPreview from '../../components/ReceiptPreview';

// Forked from src/pages/POS.tsx for visual parity. Differences:
// - reads `products` from Dexie (local cache) instead of Firestore onSnapshot
// - writes sales to the local `transactions` queue (Dexie) instead of
//   calling /api/sale directly — the sync engine pushes them later
// - no customers/promotions/recent-sales/cancel (out of scope for POS Lite,
//   BRD §2.2)

function getShopSellableStock(product: LocalProduct): number {
  if (typeof product.shopStock === 'number') return Math.max(0, product.shopStock);
  return Math.max(0, (product.stock || 0) - (product.freezerStock || 0) - (product.wasteQuantity || 0));
}

function handleProductImageError(e: React.SyntheticEvent<HTMLImageElement>, seed: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-size="20" font-family="Arial, sans-serif">${seed || 'Product'}</text></svg>`;
  const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
}

interface POSProps {
  onOpenSettings: () => void;
}

const POS: React.FC<POSProps> = ({ onOpenSettings }) => {
  const { t, isRTL, formatCurrency } = useI18n();
  const cashier = useAuthStore((s) => s.cashier);

  const products = useLiveQuery(() => db.products.toArray(), [], []);
  const online = useOnlineStatus();
  const pendingCount = useLiveQuery(
    () => db.transactions.where('syncStatus').anyOf('pending', 'syncing', 'failed').count(),
    [],
    0
  );

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<LocalSaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [showFailedPanel, setShowFailedPanel] = useState(false);
  const [completedTxn, setCompletedTxn] = useState<LocalTransaction | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  const filteredProducts = products.filter((p) => {
    if (p.disabled || p.status === 'frozen') return false;
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: LocalProduct) => {
    const maxStock = getShopSellableStock(product);
    if (maxStock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= maxStock) return prev;
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.sellingPrice }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const product = products.find((p) => p.id === productId);
        const maxStock = product ? getShopSellableStock(product) : item.quantity;
        return { ...item, quantity: Math.max(1, Math.min(maxStock, item.quantity + delta)) };
      })
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const amountPaidNum = parseFloat(amountPaid) || 0;

  const handleCheckout = async () => {
    if (cart.length === 0 || !cashier) return;
    setIsProcessing(true);

    const txn: LocalTransaction = {
      clientTxnId: crypto.randomUUID(),
      customerId: null,
      totalAmount: total,
      amountPaid: paymentMethod === 'cash' ? amountPaidNum : total,
      change: paymentMethod === 'cash' ? Math.max(0, amountPaidNum - total) : 0,
      paymentMethod,
      items: cart,
      comment: null,
      returnComment: null,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      syncAttempts: 0,
      lastSyncError: null,
      serverSaleId: null,
      cashierName: cashier.name,
    };

    // Local write is the source of truth at point of sale (BRD §5.1):
    // commit to IndexedDB before showing "Sale complete".
    await db.transactions.add(txn);

    chrome.runtime?.sendMessage?.({ type: 'pos-lite:sync-now' });

    setCart([]);
    setAmountPaid('');
    setIsCheckoutOpen(false);
    setCompletedTxn(txn);
    setReceiptNumber(txn.clientTxnId.slice(0, 8).toUpperCase());
    setIsProcessing(false);
  };

  // Server reachable + nothing left to sync: PosLite is an offline fallback
  // only — block new sales so the cashier uses the main POS instead of
  // creating two concurrent write paths.
  if (online && pendingCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full lg:h-[calc(100vh-32px)] p-4 gap-4 text-center">
        <StatusDot />
        <p className="text-lg font-bold text-slate-600 dark:text-slate-300 max-w-sm">
          {t('serverOnlineBlock')}
        </p>
        <button
          onClick={onOpenSettings}
          aria-label={t('settings')}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-full lg:h-[calc(100vh-32px)] p-4">
      <div className="flex-1 flex flex-col gap-3 lg:gap-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('pos')}</h1>
            <StatusDot />
            <button
              onClick={() => setShowFailedPanel(true)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white underline"
            >
              {t('failedSales')}
            </button>
            <button
              onClick={onOpenSettings}
              aria-label={t('settings')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder={t('search')}
              className="input pl-12 bg-white dark:bg-black border-slate-200 dark:border-[#2a1e17] shadow-sm w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setActiveCategory('All')}
            className={clsx(
              'px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all',
              activeCategory === 'All'
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                : 'bg-white dark:bg-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17]'
            )}
          >
            {t('allItems')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                'px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all',
                activeCategory === cat
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                  : 'bg-white dark:bg-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 no-scrollbar min-h-0 auto-rows-max content-start">
          {products.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 gap-4">
              <div className="w-10 h-10 border-4 border-primary-200 dark:border-primary-900 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin" />
              <p className="font-bold text-sm">{t('loading')}</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={getShopSellableStock(product) <= 0}
                className="card p-0 overflow-hidden group hover:shadow-xl transition-all duration-300 text-left border-slate-100 dark:border-[#2a1e17] flex flex-col disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <div className="aspect-square bg-slate-100 dark:bg-[#1a1512] relative shrink-0">
                  <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.name}/300/200`}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleProductImageError(e, product.name)}
                  />
                  <div
                    className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold text-white shadow-sm ${
                      getShopSellableStock(product) <= 0
                        ? 'bg-red-500'
                        : getShopSellableStock(product) < 5
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  >
                    {t('stock')}: {getShopSellableStock(product)}
                  </div>
                  <div className="absolute inset-0 bg-primary-600/0 group-hover:bg-primary-600/20 transition-all flex items-center justify-center">
                    <Plus className="text-white opacity-0 group-hover:opacity-100 w-8 h-8 drop-shadow-lg" />
                  </div>
                </div>
                <div className="p-2 sm:p-3 flex flex-col flex-1 justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base line-clamp-2" title={product.name}>
                    {product.name}
                  </h3>
                  <div className="flex items-baseline justify-between gap-2 mt-1.5">
                    <span className="text-xs sm:text-sm font-bold whitespace-nowrap text-primary-600 dark:text-primary-400">
                      {formatCurrency(product.sellingPrice)}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col gap-6">
        <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-2xl shadow-slate-200 dark:shadow-none border-slate-100 dark:border-[#2a1e17]">
          <div className="p-6 border-b border-slate-100 dark:border-[#2a1e17] flex items-center justify-between bg-slate-50/50 dark:bg-[#1a1512]/50">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              {t('cart')}
            </h2>
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{cashier?.name}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar max-h-[500px] lg:max-h-none">
            {cart.length > 0 ? (
              cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-[#0f0a07] rounded-xl border border-slate-100 dark:border-[#2a1e17]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{item.name}</h4>
                      <p className="text-sm font-bold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 bg-white dark:bg-black rounded-lg p-1.5 border border-slate-200 dark:border-[#2a1e17] shrink-0">
                        <button
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-[#1a1512] transition-all text-slate-700 dark:text-slate-300 font-bold text-lg"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="w-12 h-10 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-[#1a1512] transition-all text-slate-700 dark:text-slate-300 font-bold text-lg"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all font-bold shrink-0"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12 dark:text-white">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p className="font-bold">{t('cartEmpty')}</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-[#1a1512] border-t border-slate-100 dark:border-[#2a1e17] space-y-3">
            <div className="flex justify-between text-slate-900 dark:text-white text-lg font-bold">
              <span>{t('total')}</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <button
              onClick={() => setIsCheckoutOpen(true)}
              disabled={cart.length === 0}
              className="w-full btn-primary py-3 text-base font-bold rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
            >
              {t('checkout')}
            </button>
          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl relative overflow-hidden border-slate-100 dark:border-[#2a1e17]">
            <button
              onClick={() => {
                setIsCheckoutOpen(false);
                setAmountPaid('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-6 h-4" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('checkout')}</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4">
                  {t('paymentMethod')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setPaymentMethod('cash');
                      setAmountPaid('');
                    }}
                    className={clsx(
                      'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95',
                      paymentMethod === 'cash'
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-200 dark:border-[#2a1e17] hover:border-slate-300 dark:hover:border-[#3d2b1f] text-slate-700 dark:text-slate-400'
                    )}
                  >
                    <Banknote className="w-8 h-8" />
                    <span className="text-sm font-bold">{t('cash')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('card');
                      setAmountPaid('');
                    }}
                    className={clsx(
                      'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95',
                      paymentMethod === 'card'
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-200 dark:border-[#2a1e17] hover:border-slate-300 dark:hover:border-[#3d2b1f] text-slate-700 dark:text-slate-400'
                    )}
                  >
                    <CreditCard className="w-8 h-8" />
                    <span className="text-sm font-bold">{t('card')}</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">
                      {t('amountPaid')}
                    </label>
                    <input
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      placeholder={total.toString()}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="input w-full bg-white dark:bg-black border-slate-200 dark:border-[#2a1e17]"
                    />
                  </div>

                  {amountPaid && (
                    <div
                      className={clsx(
                        'p-4 rounded-xl font-bold text-center',
                        amountPaidNum >= total
                          ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      )}
                    >
                      {amountPaidNum >= total
                        ? `${t('changeDue')}: ${formatCurrency(amountPaidNum - total)}`
                        : `${t('shortBy')}: ${formatCurrency(total - amountPaidNum)}`}
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-slate-50 dark:bg-[#1a1512] rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">
                    {t('amountDue')}
                  </span>
                  <span className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full btn-primary py-5 text-xl font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isProcessing && <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isProcessing ? t('checkoutProcessing') : t('confirmPayment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {completedTxn && receiptNumber && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <ReceiptPreview
              txn={completedTxn}
              receiptNumber={receiptNumber}
              serverSaleId={completedTxn.serverSaleId}
              onClose={() => {
                setCompletedTxn(null);
                setReceiptNumber(null);
              }}
              autoCloseDelay={5000}
            />
          </div>
        </div>
      )}

      <FailedTxnPanel open={showFailedPanel} onClose={() => setShowFailedPanel(false)} />
    </div>
  );
};

export default POS;
