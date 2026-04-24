import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { db, collection, addDoc, handleFirestoreError, OperationType, doc, getDoc, updateDoc } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { ShoppingBag, User, Phone, MapPin, CreditCard, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { CURRENCY } from '../constants';

const Checkout: React.FC = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: '',
    address: '',
    type: 'b2c' as 'b2b' | 'b2c',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (cart.length === 0 && !isSuccess) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const orderData = {
        customerId: user?.uid || 'anonymous',
        customerInfo: {
          name: formData.name,
          phone: formData.phone,
          address: formData.address
        },
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.sellingPrice
        })),
        totalAmount: cartTotal,
        status: 'pending',
        type: formData.type,
        createdAt: new Date().toISOString(),
        notes: formData.notes
      };

      await addDoc(collection(db, 'orders'), orderData);

      // Deduct stock for each item
      for (const item of cart) {
        try {
          const productRef = doc(db, 'products', item.id);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            await updateDoc(productRef, {
              stock: Math.max(0, currentStock - item.quantity)
            });
          }
        } catch (err) {
          console.error(`Error updating stock for product ${item.id}:`, err);
        }
      }

      if (user) {
        await logActivity(
          user.uid,
          profile?.name || 'Customer',
          'Place Order',
          `Placed ${formData.type.toUpperCase()} order via checkout form. Total: ${cartTotal} ${CURRENCY}`
        );
      }

      setIsSuccess(true);
      clearCart();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 max-w-md w-full text-center p-12 space-y-6"
        >
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Commande Reçue !</h2>
          <p className="text-slate-500 dark:text-zinc-400">Merci pour votre confiance. Notre équipe prépare déjà vos délices artisanaux.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20"
          >
            Retour à la Boutique
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black pt-24 pb-12 px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12">
        {/* Left Column: Form */}
        <div className="space-y-8">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-500 dark:text-zinc-500 font-bold hover:text-amber-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Retour à la boutique
          </button>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-8 md:p-12">
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-8">Informations de Livraison</h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Nom Complet</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                    <input 
                      required
                      type="text"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                    <input 
                      required
                      type="tel"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700"
                      placeholder="05XX XX XX XX"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Adresse de Livraison</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <textarea 
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700 min-h-[100px]"
                    placeholder="Votre adresse complète..."
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Type de Commande</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'b2c' })}
                    className={clsx(
                      "py-4 rounded-2xl font-bold border-2 transition-all",
                      formData.type === 'b2c' 
                        ? "border-amber-600 bg-amber-600/10 text-amber-500" 
                        : "border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black text-slate-400 dark:text-zinc-500 hover:border-slate-200 dark:hover:border-white/10"
                    )}
                  >
                    Particulier (B2C)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'b2b' })}
                    className={clsx(
                      "py-4 rounded-2xl font-bold border-2 transition-all",
                      formData.type === 'b2b' 
                        ? "border-amber-600 bg-amber-600/10 text-amber-500" 
                        : "border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black text-slate-400 dark:text-zinc-500 hover:border-slate-200 dark:hover:border-white/10"
                    )}
                  >
                    Professionnel (B2B)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Notes (Optionnel)</label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700"
                  placeholder="Instructions spéciales..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-5 bg-amber-600 text-white font-bold rounded-2xl shadow-xl shadow-amber-600/20 hover:bg-amber-500 transition-all text-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Traitement...' : 'Confirmer et Payer à la Livraison'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Summary */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-500" />
              Résumé de la Commande
            </h2>
            
            <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-white/5 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-black rounded-xl flex items-center justify-center font-bold text-slate-400 dark:text-zinc-600 border border-slate-100 dark:border-white/5">
                      {item.quantity}x
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-500 font-medium">{item.sellingPrice.toLocaleString()} {CURRENCY}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {(item.sellingPrice * item.quantity).toLocaleString()} {CURRENCY}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/10">
              <div className="flex justify-between text-slate-500 dark:text-zinc-400 font-medium">
                <span>Sous-total</span>
                <span>{cartTotal.toLocaleString()} {CURRENCY}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400 font-medium">
                <span>Livraison</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-bold uppercase tracking-widest text-xs">Gratuit</span>
              </div>
              <div className="flex justify-between text-2xl font-display font-extrabold text-slate-900 dark:text-white pt-4">
                <span>Total</span>
                <span className="text-amber-600 dark:text-amber-500">{cartTotal.toLocaleString()} {CURRENCY}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/20">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Paiement Sécurisé</h3>
            </div>
            <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed">
              Nous acceptons uniquement le paiement à la livraison pour le moment. Veuillez préparer le montant exact pour faciliter la transaction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
