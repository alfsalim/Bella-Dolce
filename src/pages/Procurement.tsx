import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Truck, 
  Plus, 
  Search, 
  ShoppingCart,
  History,
  Calendar,
  Package,
  TrendingDown,
  ChevronRight,
  Filter,
  Download,
  Building2,
  Tag,
  Hash,
  Scale,
  Activity,
  AlertCircle
} from 'lucide-react';
import { db, collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, where, orderBy, Timestamp, getDoc } from '../lib/firebase-compat';
import { Supplier, RawMaterial, Purchase } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Suppliers from './Suppliers';

const Procurement: React.FC = () => {
  const { t, isRTL, formatCurrency } = useLanguage();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const getDefaultExpiryDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().split('T')[0];
  };

  const [purchaseFormData, setPurchaseFormData] = useState({
    materialId: '',
    supplierId: '',
    quantity: 0,
    price: 0,
    brand: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: getDefaultExpiryDate()
  });

  useEffect(() => {
    const unsubMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)));
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    const purchasesQ = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const unsubPurchases = onSnapshot(purchasesQ, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
      setLoading(false);
    });

    return () => {
      unsubMaterials();
      unsubSuppliers();
      unsubPurchases();
    };
  }, []);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const material = materials.find(m => m.id === purchaseFormData.materialId);
      const supplier = suppliers.find(s => s.id === purchaseFormData.supplierId);

      if (!material || !supplier) {
        toast.error("Invalid material or supplier");
        return;
      }

      const token = localStorage.getItem('bakery_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      // 1. Create Purchase Record via API
      const purchaseData = {
        ...purchaseFormData,
        materialName: material.name,
        supplierName: supplier.name,
        unit: material.unit,
        createdAt: new Date().toISOString(),
        createdBy: profile.id
      };

      const purchaseResponse = await fetch('/api/db/purchases', {
        method: 'POST',
        headers,
        body: JSON.stringify(purchaseData)
      });

      if (!purchaseResponse.ok) {
        throw new Error('Failed to create purchase');
      }

      // 2. Update Inventory
      const newStock = (material.currentStock || 0) + Number(purchaseFormData.quantity);
      await fetch(`/api/db/rawMaterials/${material.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          currentStock: newStock,
          stock: newStock,
          brand: purchaseFormData.brand || material.brand,
          expiryDate: purchaseFormData.expiryDate || material.expiryDate
        })
      });

      toast.success(t('purchaseCreatedSuccessfully') || 'Purchase created successfully');
      setIsPurchaseModalOpen(false);
      setPurchaseFormData({
        materialId: '',
        supplierId: '',
        quantity: 0,
        price: 0,
        brand: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        expiryDate: getDefaultExpiryDate()
      });
    } catch (error) {
      console.error("Error creating purchase:", error);
      toast.error(t('errorSavingItem'));
    }
  };

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md">Only administrators and managers can access procurement management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Truck className="w-8 h-8 text-primary-600" />
            {t('procurement')}
          </h1>
          <p className="text-slate-500 mt-1">Manage purchases and supplier relationships</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('purchases')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'purchases' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500"
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            {t('purchases')}
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'suppliers' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500"
            )}
          >
            <Building2 className="w-4 h-4" />
            {t('suppliers')}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'purchases' ? (
          <motion.div
            key="purchases"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Purchase Actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={t('search')} 
                  className="input pl-12"
                />
              </div>
              <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                className="btn-primary gap-2"
              >
                <Plus className="w-5 h-5" />
                {t('newPurchase')}
              </button>
            </div>

            {/* Purchases List */}
            <div className="grid grid-cols-1 gap-4">
              {purchases.map((purchase) => (
                <div 
                  key={purchase.id}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl hover:shadow-primary-600/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600">
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tight">
                        {purchase.materialName}
                      </h3>
                      <div className="flex items-center gap-3 text-slate-500 text-sm mt-0.5">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {purchase.supplierName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono uppercase">
                          <Tag className="w-3.5 h-3.5" />
                          {purchase.brand || 'No Brand'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="text-center md:text-left">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('quantity')}</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {purchase.quantity} <span className="text-xs font-medium text-slate-500">{purchase.unit}</span>
                      </p>
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('purchasePrice')}</p>
                      <p className="text-lg font-bold text-primary-600">
                        {formatCurrency(purchase.price)}
                      </p>
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('purchaseDate')}</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                    {purchase.expiryDate && (
                      <div className="text-center md:text-left">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{t('expiryDate')}</p>
                        <p className="text-sm font-bold text-amber-600 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(purchase.expiryDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="suppliers"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <Suppliers />
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Purchase Modal */}
      <AnimatePresence>
        {isPurchaseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPurchaseModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/50">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-primary-600" />
                  {t('newPurchase')}
                </h2>
                <button 
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                >
                  <Plus className="w-6 h-6 text-slate-400 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleCreatePurchase} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('material')} <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={purchaseFormData.materialId}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, materialId: e.target.value})}
                      className="input"
                    >
                      <option value="">{t('selectMaterial')}</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('suppliers')} <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={purchaseFormData.supplierId}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, supplierId: e.target.value})}
                      className="input"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('quantity')} <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={purchaseFormData.quantity}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, quantity: Number(e.target.value)})}
                      className="input font-bold"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('purchasePrice')} <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={purchaseFormData.price}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, price: Number(e.target.value)})}
                      className="input font-bold text-primary-600"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('brandName')}</label>
                    <input
                      type="text"
                      value={purchaseFormData.brand}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, brand: e.target.value})}
                      className="input"
                      placeholder="Brand name..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('purchaseDate')} <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="date"
                      value={purchaseFormData.purchaseDate}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, purchaseDate: e.target.value})}
                      className="input"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('expiryDate')}</label>
                    <input
                      type="date"
                      value={purchaseFormData.expiryDate}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, expiryDate: e.target.value})}
                      className="input"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(false)}
                    className="btn-secondary"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="btn-primary px-10 shadow-lg shadow-primary-600/20"
                  >
                    {t('confirm')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Procurement;
