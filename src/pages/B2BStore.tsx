import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  db, 
  auth, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { 
  ChefHat, 
  Package, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  ChevronRight,
  Building2,
  FileText,
  History,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Filter,
  ShoppingBag
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { Product } from '../types';
import { CURRENCY } from '../constants';
import Pagination from '../components/Pagination';

interface CartItem extends Product {
  quantity: number;
}

const B2BStore: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;
  const { t } = useLanguage();

  const B2B_DISCOUNT = 0.20; // 20% discount for B2B
  const MIN_ORDER_QTY = 10;

  useEffect(() => {
    const fetchCounts = async () => {
      const snapshot = await getCountFromServer(collection(db, 'products'));
      setTotalPages(Math.ceil(snapshot.data().count / pageSize));
    };
    fetchCounts();

    const q = query(collection(db, 'products'), orderBy('name'), limit(pageSize * currentPage));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      const startIndex = (currentPage - 1) * pageSize;
      setProducts(allProducts.slice(startIndex, startIndex + pageSize));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    return () => unsubscribe();
  }, [currentPage]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + MIN_ORDER_QTY }
            : item
        );
      }
      return [...prev, { ...product, quantity: MIN_ORDER_QTY }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const getDiscountedPrice = (price: number) => price * (1 - B2B_DISCOUNT);
  
  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const discountAmount = subtotal * B2B_DISCOUNT;
  const total = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (!auth.currentUser) {
      alert('Please login to place an order');
      return;
    }

    try {
      await addDoc(collection(db, 'orders'), {
        customerId: auth.currentUser.uid,
        userName: auth.currentUser.displayName,
        createdBy: auth.currentUser.displayName || 'B2B Customer',
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: getDiscountedPrice(item.sellingPrice)
        })),
        totalAmount: total,
        subtotal,
        discount: discountAmount,
        status: 'pending',
        type: 'b2b',
        createdAt: new Date().toISOString()
      });

      setCart([]);
      setIsCartOpen(false);
      alert('Wholesale order placed successfully!');
    } catch (error) {
      console.error('Error placing B2B order:', error);
      alert('Failed to place order');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Wholesale Header */}
      <header className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-8 shadow-sm dark:shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold text-xs uppercase tracking-widest mb-2">
              <Building2 className="w-4 h-4" />
              Portail Grossiste Exclusif
            </div>
            <h1 className="font-display font-extrabold text-4xl tracking-tight text-slate-900 dark:text-white">Commandes en Gros</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-emerald-100 dark:border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Compte Vérifié
            </div>
            <button className="p-3 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all relative">
              <History className="w-5 h-5 text-slate-400 dark:text-zinc-400" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Product Catalog Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Rechercher un produit ou une catégorie..." 
                className="w-full pl-12 pr-4 py-2 bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500 transition-all text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="p-2 text-slate-400 dark:text-zinc-500 hover:text-amber-500 transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-100 dark:border-white/10 hover:border-amber-500/50 transition-all flex gap-4 group">
                <div className="w-24 h-24 bg-slate-50 dark:bg-black rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
                  <img 
                    src={product.imageUrl || `https://picsum.photos/seed/${product.name}/200/200`} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{product.name}</h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">{product.category}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <span className="text-xs text-slate-400 dark:text-zinc-600 line-through block">{product.sellingPrice} {CURRENCY}</span>
                      <span className="text-lg font-display font-extrabold text-amber-600 dark:text-amber-500">
                        {getDiscountedPrice(product.sellingPrice).toLocaleString()} {CURRENCY}
                      </span>
                    </div>
                    <button 
                      onClick={() => addToCart(product)}
                      className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-500 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter (x{MIN_ORDER_QTY})
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>

        {/* Order Summary / Batch Builder */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 shadow-xl overflow-hidden sticky top-24">
            <div className="p-6 border-b border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
              <h2 className="font-display font-bold text-xl flex items-center gap-2 text-slate-900 dark:text-white">
                <Package className="w-6 h-6 text-amber-500" />
                Récapitulatif de Commande
              </h2>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[10px] font-bold rounded-full uppercase tracking-widest">
                {cart.length} Articles
              </span>
            </div>

            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4 no-scrollbar">
              {cart.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-black rounded-full flex items-center justify-center mx-auto border border-slate-100 dark:border-white/5">
                    <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-zinc-700" />
                  </div>
                  <p className="text-sm text-slate-400 dark:text-zinc-500 font-medium">Votre panier de gros est vide.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</h4>
                      <p className="text-xs text-amber-600 dark:text-amber-500 font-bold">{getDiscountedPrice(item.sellingPrice).toLocaleString()} {CURRENCY} / unité</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg p-1 border border-slate-100 dark:border-white/10">
                      <button 
                        onClick={() => updateQuantity(item.id, -MIN_ORDER_QTY)}
                        className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded transition-colors text-slate-600 dark:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, MIN_ORDER_QTY)}
                        className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded transition-colors text-slate-600 dark:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-slate-50 dark:bg-black text-slate-900 dark:text-white space-y-4 border-t border-slate-100 dark:border-white/10">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                    <span>Sous-total</span>
                    <span>{subtotal.toLocaleString()} {CURRENCY}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Remise Grossiste (20%)</span>
                    <span>-{discountAmount.toLocaleString()} {CURRENCY}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xl font-display font-extrabold pt-4 border-t border-slate-100 dark:border-white/10">
                  <span>Total HT</span>
                  <span className="text-amber-600 dark:text-amber-500">{total.toLocaleString()} {CURRENCY}</span>
                </div>
                <button 
                  onClick={handleCheckout}
                  className="w-full py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                >
                  Confirmer la Commande Batch
                  <ChevronRight className="w-5 h-5" />
                </button>
                <p className="text-[10px] text-center text-slate-400 dark:text-zinc-600 uppercase tracking-widest font-bold">
                  Livraison prévue : Demain avant 8h
                </p>
              </div>
            )}
          </div>

          <div className="bg-amber-50 dark:bg-amber-500/5 rounded-2xl p-6 border border-amber-100 dark:border-amber-500/10">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Politique de Commande</h4>
                <p className="text-xs text-amber-700/70 dark:text-amber-200/70 leading-relaxed">
                  Les commandes B2B doivent être passées par multiples de {MIN_ORDER_QTY}. La remise de {B2B_DISCOUNT * 100}% est appliquée automatiquement sur l'ensemble du catalogue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default B2BStore;
