import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Smartphone,
  CheckCircle2,
  X,
  User
} from 'lucide-react';
import { db, collection, onSnapshot, handleFirestoreError, OperationType, doc, getDoc, updateDoc } from '../lib/firebase-compat';
import { Product, SaleItem, Customer, Promotion } from '../types';
import { clsx } from 'clsx';
import { SELLABLE_CATEGORIES } from '../constants';
import { authFetch } from '../lib/api-client';
import { getActiveProductPromotion, getEffectiveSellingPrice } from '../lib/promotionPricing';

import { logActivity } from '../lib/logger';

const POS: React.FC = () => {
  const { t, isRTL, tProduct, tCategory, currencyUnit } = useLanguage();
  const { profile } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleProductImageError = (e: React.SyntheticEvent<HTMLImageElement>, seed: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-size="20" font-family="Arial, sans-serif">${seed || 'Product'}</text></svg>`;
    const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    if (e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'customers'));

    const unsubscribePromotions = onSnapshot(collection(db, 'promotions'), (snapshot) => {
      setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'promotions'));

    return () => {
      unsubscribe();
      unsubscribeCustomers();
      unsubscribePromotions();
    };
  }, []);

  const filteredProducts = products.filter(p => {
    if (p.status === 'frozen') return false;
    if ((p as any).disabled) return false;
    if (!SELLABLE_CATEGORIES.includes(p.category?.toLowerCase() as any)) return false;
    const matchesCategory = activeCategory === 'All' || p.category?.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    if ((product.shopStock || 0) <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId: product.id, quantity: 1, price: getEffectiveSellingPrice(product, promotions) }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        const maxStock = product?.shopStock || 0;
        const newQty = Math.max(1, Math.min(maxStock, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantity = (productId: string, value: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        const maxStock = product?.shopStock || 0;
        const newQty = Math.max(1, Math.min(maxStock, value));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const token = localStorage.getItem('bakery_token');
      const res = await authFetch('/api/sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          customerId: selectedCustomer || null,
          totalAmount: total,
          paymentMethod,
          items: cart
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Checkout failed');
      }

      // Deduct shopStock from Firestore for each sold item
      // stock = shopStock + freezerStock + wasteQuantity (invariant must hold)
      const saleItems = [...cart];
      for (const item of saleItems) {
        try {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const data = productSnap.data();
            const newShopStock = Math.max(0, (data.shopStock || 0) - item.quantity);
            const newStock = newShopStock + (data.freezerStock || 0) + (data.wasteQuantity || 0);
            await updateDoc(productRef, { shopStock: newShopStock, stock: newStock });
          }
        } catch (err) {
          console.error(`Error updating Firestore stock for product ${item.productId}:`, err);
        }
      }

      if (profile) {
        logActivity(profile.id, profile.name, 'Sale', `Completed sale of ${total} ${currencyUnit}`);
      }

      setIsSuccess(true);
      setCart([]);
      setSelectedCustomer('');
      setTimeout(() => {
        setIsSuccess(false);
        setIsCheckoutOpen(false);
      }, 2000);
    } catch (error: any) {
      console.error("Checkout error:", error);
      alert(error.message || 'Checkout failed. Please try again.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full lg:h-[calc(100vh-160px)]">
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('pos')}</h1>
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
            key="All"
            onClick={() => setActiveCategory('All')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
              activeCategory === 'All' 
                ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" 
                : "bg-white dark:bg-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17]"
            )}
          >
            {t('allItems')}
          </button>
          {SELLABLE_CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                "px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                activeCategory === cat 
                  ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" 
                  : "bg-white dark:bg-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17]"
              )}
            >
              {tCategory(cat)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 no-scrollbar min-h-[400px]">
          {filteredProducts.map((product) => (
            (() => {
              const activePromotion = getActiveProductPromotion(product.id, promotions);
              const effectivePrice = getEffectiveSellingPrice(product, promotions);
              return (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={(product.shopStock || 0) <= 0}
              className="card p-0 overflow-hidden group hover:shadow-xl transition-all duration-300 text-left border-slate-100 dark:border-[#2a1e17] flex flex-col h-full min-h-[320px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
                <div className="h-48 bg-slate-100 dark:bg-[#1a1512] relative shrink-0">
                  <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.name}/300/200`}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleProductImageError(e, product.name)}
                  />
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold text-white shadow-sm ${(product.shopStock || 0) <= 0 ? 'bg-red-500' : (product.shopStock || 0) < 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                    {t('stock')}: {product.shopStock || 0}
                  </div>
                  <div className="absolute inset-0 bg-primary-600/0 group-hover:bg-primary-600/20 transition-all flex items-center justify-center">
                    <Plus className="text-white opacity-0 group-hover:opacity-100 w-8 h-8 drop-shadow-lg" />
                  </div>
                </div>
              <div className="p-4 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2 line-clamp-2" title={tProduct(product)}>{tProduct(product)}</h3>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{tCategory(product.category)}</span>
                </div>
                <div className="flex items-end justify-between mt-4 gap-2">
                  <div className="flex flex-col min-w-0 overflow-hidden">
                    {activePromotion && (
                      <span className="text-xs line-through text-slate-400 dark:text-slate-500">
                        {product.sellingPrice.toLocaleString()} {currencyUnit}
                      </span>
                    )}
                    <span className={clsx(
                      "text-xl font-bold",
                      activePromotion ? "text-red-600 dark:text-red-400" : "text-primary-600 dark:text-primary-400"
                    )}>
                      {effectivePrice.toLocaleString()} {currencyUnit}
                    </span>
                    {activePromotion && (
                      <span className="text-[10px] font-bold text-red-600/90 dark:text-red-400/90 uppercase tracking-wider truncate">
                        {activePromotion.campaignName}
                      </span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary-600 dark:bg-primary-600 flex items-center justify-center text-white transition-all active:scale-90 shrink-0">
                    <Plus className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </button>
              );
            })()
          ))}
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col gap-6">
        <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-2xl shadow-slate-200 dark:shadow-none border-slate-100 dark:border-[#2a1e17]">
          <div className="p-6 border-b border-slate-100 dark:border-[#2a1e17] flex items-center justify-between bg-slate-50/50 dark:bg-[#1a1512]/50">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              {t('cart')}
            </h2>
            <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full text-xs font-bold">
              {cart.reduce((s, i) => s + i.quantity, 0)} {t('items')}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar max-h-[400px] lg:max-h-none">
            {cart.length > 0 ? cart.map((item) => {
              const product = products.find(p => p.id === item.productId);
              return (
                <div key={item.productId} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#0f0a07] rounded-xl border border-slate-100 dark:border-[#2a1e17]">
                  <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-[#1a1512] overflow-hidden flex-shrink-0">
                    <img
                      src={product?.imageUrl || `https://picsum.photos/seed/${product?.name}/100/100`}
                      alt={product?.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleProductImageError(e, product?.name || 'product')}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{product ? tProduct(product) : ''}</h4>
                    <p className="text-sm font-bold text-primary-600 dark:text-primary-400 mt-1 whitespace-nowrap">{(item.price * item.quantity).toLocaleString()} {currencyUnit}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-black rounded-lg p-1.5 border border-slate-200 dark:border-[#2a1e17] shrink-0">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-[#1a1512] transition-all text-slate-700 dark:text-slate-300 font-bold text-lg"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={product?.shopStock || 1}
                      value={item.quantity}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(next)) setQuantity(item.productId, next);
                      }}
                      className="w-12 h-10 text-center text-sm font-bold text-slate-900 dark:text-white bg-transparent rounded-md border border-slate-200 dark:border-[#2a1e17] focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      disabled={(product?.shopStock || 0) <= item.quantity}
                      className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-[#1a1512] transition-all text-slate-700 dark:text-slate-300 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed"
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
              );
            }) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12 dark:text-white">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p className="font-bold">{t('cartEmpty')}</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 dark:bg-[#1a1512] border-t border-slate-100 dark:border-[#2a1e17] space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                <span>{t('subtotal')}</span>
                <span>{total.toLocaleString()} {currencyUnit}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                <span>{t('tax')} (0%)</span>
                <span>0 {currencyUnit}</span>
              </div>
              <div className="flex justify-between text-slate-900 dark:text-white text-xl font-bold pt-2 border-t border-slate-200 dark:border-[#2a1e17]">
                <span>{t('total')}</span>
                <span>{total.toLocaleString()} {currencyUnit}</span>
              </div>
            </div>

            <button
              onClick={() => setIsCheckoutOpen(true)}
              disabled={cart.length === 0}
              className="w-full btn-primary py-5 text-xl font-bold rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
            >
              {t('checkout')}
            </button>
          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl relative overflow-hidden border-slate-100 dark:border-[#2a1e17]">
            {isSuccess ? (
              <div className="py-12 text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('paymentSuccess')}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">{t('transactionId')}: #SALE-{Math.random().toString(36).slice(-6).toUpperCase()}</p>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => setIsCheckoutOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('checkout')}</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">{t('customer')}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <select 
                        className="input pl-12"
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                      >
                        <option value="">{t('walkInCustomer')}</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4">{t('paymentMethod')}</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={clsx(
                          "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95",
                          paymentMethod === 'cash' ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 dark:border-[#2a1e17] hover:border-slate-300 dark:hover:border-[#3d2b1f] text-slate-700 dark:text-slate-400"
                        )}
                      >
                        <Banknote className="w-8 h-8" />
                        <span className="text-sm font-bold">{t('cash')}</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={clsx(
                          "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95",
                          paymentMethod === 'card' ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 dark:border-[#2a1e17] hover:border-slate-300 dark:hover:border-[#3d2b1f] text-slate-700 dark:text-slate-400"
                        )}
                      >
                        <CreditCard className="w-8 h-8" />
                        <span className="text-sm font-bold">{t('card')}</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('mobile')}
                        className={clsx(
                          "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95",
                          paymentMethod === 'mobile' ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 dark:border-[#2a1e17] hover:border-slate-300 dark:hover:border-[#3d2b1f] text-slate-700 dark:text-slate-400"
                        )}
                      >
                        <Smartphone className="w-8 h-8" />
                        <span className="text-sm font-bold">{t('mobile')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-[#1a1512] rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">{t('amountDue')}</span>
                      <span className="text-2xl font-display font-bold text-slate-900 dark:text-white">{total.toLocaleString()} {currencyUnit}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="w-full btn-primary py-5 text-xl font-bold rounded-xl active:scale-95 transition-transform"
                  >
                    {t('confirmPayment')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
