import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query,
  where,
  limit,
  getCountFromServer,
  db, 
  auth, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { 
  ChefHat, 
  ShoppingBag, 
  Search, 
  Filter, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  ChevronRight,
  Star,
  Clock,
  Truck,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { logActivity } from '../lib/logger';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { Product, Promotion } from '../types';
import { CURRENCY } from '../constants';
import Pagination from '../components/Pagination';

const PublicStore: React.FC = () => {
  console.log('PublicStore rendering');
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity, cartTotal } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;
  const { t } = useLanguage();

  useEffect(() => {
    const fetchCounts = async () => {
      const q = query(collection(db, 'products'), where('category', '!=', 'raw_material'));
      const snapshot = await getCountFromServer(q);
      setTotalPages(Math.ceil(snapshot.data().count / pageSize));
    };
    fetchCounts();

    const q = query(collection(db, 'products'), where('stock', '>', 0), limit(pageSize * currentPage));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allProducts = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
      
      // Filter out raw materials for the public store
      const publicProducts = allProducts.filter(p => p.category !== 'raw_material');
      
      const startIndex = (currentPage - 1) * pageSize;
      setProducts(publicProducts.slice(startIndex, startIndex + pageSize));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    const promoQ = query(collection(db, 'promotions'), where('active', '==', true));
    const promoUnsubscribe = onSnapshot(promoQ, (snapshot) => {
      const now = new Date().toISOString();
      const promoData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Promotion))
        .filter(p => p.expiryDate > now);
      setPromotions(promoData);
    });

    return () => {
      unsubscribe();
      promoUnsubscribe();
    };
  }, [currentPage]);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const handleCheckout = () => {
    setIsCartOpen(false);
    navigate('/checkout');
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans text-slate-900 dark:text-white transition-colors duration-300">
      {/* Hero Section */}
      <header className="pt-20 pb-20 px-6 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 rounded-full text-xs font-bold uppercase tracking-widest">
            <Star className="w-4 h-4 fill-amber-500" />
            Élu Meilleur Artisan 2024
          </div>
          <h1 className="font-display font-extrabold text-6xl md:text-7xl leading-[0.9] tracking-tighter text-slate-900 dark:text-white">
            L'Art du Pain <br />
            <span className="text-amber-600 dark:text-amber-500">Réinventé.</span>
          </h1>
          <p className="text-slate-600 dark:text-zinc-400 text-lg max-w-md leading-relaxed">
            Découvrez nos créations artisanales, pétries avec passion et cuites au feu de bois chaque matin.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
            >
              Commander Maintenant
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-white dark:bg-black border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all shadow-sm dark:shadow-none"
            >
              Voir le Menu
            </button>
          </div>
          <div className="flex items-center gap-8 pt-4 border-t border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              <span className="text-sm font-bold text-slate-500 dark:text-zinc-400">Prêt en 15 min</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              <span className="text-sm font-bold text-slate-500 dark:text-zinc-400">Livraison Gratuite</span>
            </div>
          </div>
        </div>
        <div className="relative group">
          <div className="absolute inset-0 bg-amber-500/10 rounded-[40px] rotate-6 scale-95 blur-2xl"></div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <img 
              src={promotions[0]?.imageUrl || "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1000"} 
              alt={promotions[0]?.title || "Artisanal Bread"} 
              className="w-full aspect-square object-cover rounded-[40px] shadow-2xl border border-slate-100 dark:border-white/10 transition-transform duration-700 group-hover:scale-[1.02]"
              referrerPolicy="no-referrer"
            />
            
            {promotions[0] && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-8 left-8 right-8 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] shadow-2xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-2 py-0.5 bg-amber-500 text-black text-[10px] font-black uppercase tracking-tighter rounded-md">
                    PROMO
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{promotions[0].title}</h3>
                </div>
                <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">
                  {promotions[0].description}
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </header>

      {/* Product Grid Section */}
      <section id="menu" className="bg-white dark:bg-zinc-900/50 py-24 px-6 border-y border-slate-100 dark:border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div>
              <h2 className="font-display font-extrabold text-4xl text-slate-900 dark:text-white mb-4 tracking-tight">Nos Créations</h2>
              <p className="text-slate-500 dark:text-zinc-400 max-w-md">Chaque produit est unique, fabriqué à partir de farines locales et de levain naturel.</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={clsx(
                    "px-6 py-3 rounded-xl text-sm font-bold transition-all",
                    selectedCategory === cat 
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
                      : "bg-slate-50 dark:bg-black text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {cat === 'All' ? 'Tous' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredProducts.map(product => (
              <motion.div 
                layout
                key={product.id}
                className="group bg-slate-50 dark:bg-black rounded-[32px] p-4 border border-slate-200 dark:border-white/10 hover:shadow-2xl hover:shadow-amber-600/10 transition-all duration-500"
              >
                <div className="relative aspect-square overflow-hidden rounded-[24px] mb-6 border border-slate-100 dark:border-white/5">
                  <img 
                    src={product.imageUrl || `https://picsum.photos/seed/${product.name}/400/400`} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 border border-slate-100 dark:border-white/10">
                    {product.category}
                  </div>
                </div>
                <div className="px-2">
                  <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-2">{product.name}</h3>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-2xl font-display font-extrabold text-amber-600 dark:text-amber-500">
                      {product.sellingPrice.toLocaleString()} {CURRENCY}
                    </span>
                    <button 
                      onClick={() => {
                        addToCart(product);
                        setIsCartOpen(true);
                      }}
                      className="w-12 h-12 bg-amber-600 text-white rounded-2xl flex items-center justify-center hover:bg-amber-500 hover:scale-110 active:scale-95 transition-all shadow-lg shadow-amber-600/20"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </section>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-black z-[70] shadow-2xl flex flex-col border-l border-slate-100 dark:border-white/10"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                  <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">Votre Panier</h2>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition-colors text-slate-900 dark:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-slate-100 dark:border-white/5">
                      <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-zinc-700" />
                    </div>
                    <p className="text-slate-500 dark:text-zinc-500 font-medium">Votre panier est vide.</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="text-amber-600 dark:text-amber-500 font-bold hover:underline"
                    >
                      Continuer mes achats
                    </button>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-4">
                      <img 
                        src={item.imageUrl || `https://picsum.photos/seed/${item.name}/100/100`} 
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-2xl border border-slate-100 dark:border-white/5"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 dark:text-white">{item.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-zinc-500 mb-2">{item.sellingPrice.toLocaleString()} {CURRENCY}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-slate-50 dark:bg-zinc-900 rounded-lg p-1 border border-slate-200 dark:border-white/5">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 hover:bg-white dark:hover:bg-black rounded-md transition-colors text-slate-900 dark:text-white"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-1 hover:bg-white dark:hover:bg-black rounded-md transition-colors text-slate-900 dark:text-white"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button 
                            onClick={() => updateQuantity(item.id, -item.quantity)}
                            className="text-red-500 dark:text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-lg font-bold text-slate-900 dark:text-white">
                    <span>Total</span>
                    <span className="text-amber-600 dark:text-amber-500">{cartTotal.toLocaleString()} {CURRENCY}</span>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="w-full py-4 bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    Confirmer la Commande
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicStore;
