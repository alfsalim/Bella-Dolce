import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Store, 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { Supplier, Customer } from '../types';
import { clsx } from 'clsx';

const Management: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'customers'>('suppliers');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'suppliers'));

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'customers'));

    return () => {
      unsubscribeSuppliers();
      unsubscribeCustomers();
    };
  }, []);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const [formData, setFormData] = useState({ name: '', contact: '', email: '', phone: '', address: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const collectionName = activeTab === 'suppliers' ? 'suppliers' : 'customers';
      await addDoc(collection(db, collectionName), {
        ...formData,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({ name: '', contact: '', email: '', phone: '', address: '' });
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('management')}</h1>
          <p className="text-slate-500 dark:text-zinc-400 font-medium">{t('managementDesc')}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="px-6 py-3 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          {activeTab === 'suppliers' ? t('addSupplier') : t('addCustomer')}
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-white dark:bg-zinc-900 rounded-2xl w-fit border border-slate-200 dark:border-white/10">
        <button 
          onClick={() => setActiveTab('suppliers')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'suppliers' 
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
              : "text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800"
          )}
        >
          {t('suppliers')}
        </button>
        <button 
          onClick={() => setActiveTab('customers')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'customers' 
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
              : "text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800"
          )}
        >
          {t('customers')}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('search')} 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'suppliers' ? (
          filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-6 group hover:border-amber-500/50 transition-all duration-300">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <Store className="w-6 h-6" />
                </div>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-amber-500 transition-colors">{supplier.name}</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500 font-medium mb-6">{supplier.contact}</p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                  <Phone className="w-4 h-4 text-amber-500/50" />
                  <span className="text-sm font-semibold">{supplier.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                  <Mail className="w-4 h-4 text-amber-500/50" />
                  <span className="text-sm font-semibold truncate">{supplier.email}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex gap-2">
                <button className="flex-1 px-4 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-white/5">
                  {t('viewOrders')}
                </button>
                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-400 dark:text-zinc-400 hover:text-amber-500 transition-all border border-slate-200 dark:border-white/5">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-6 group hover:border-amber-500/50 transition-all duration-300">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-amber-500 transition-colors">{customer.name}</h3>
              <div className="flex items-center gap-2 mb-6">
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[10px] font-bold uppercase tracking-widest border border-amber-500/20">{t('regular')}</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                  <Phone className="w-4 h-4 text-amber-500/50" />
                  <span className="text-sm font-semibold">{customer.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                  <MapPin className="w-4 h-4 text-amber-500/50" />
                  <span className="text-sm font-semibold truncate">{customer.address}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex gap-2">
                <button className="flex-1 px-4 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-white/5">
                  {t('purchaseHistory')}
                </button>
                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-400 dark:text-zinc-400 hover:text-amber-500 transition-all border border-slate-200 dark:border-white/5">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-white/10 w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              {activeTab === 'suppliers' ? t('addSupplier') : t('addCustomer')}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('name')}</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                  placeholder={t('fullName')} 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('email')}</label>
                <input 
                  type="email" 
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                  placeholder="email@example.com" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              {activeTab === 'suppliers' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('contactPerson')}</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                    placeholder={t('contactName')} 
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('address')}</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                    placeholder={t('streetAddress')} 
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('phone')}</label>
                <input 
                  type="tel" 
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                  placeholder="+33 1 23 45 67 89" 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all border border-slate-200 dark:border-white/5"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
