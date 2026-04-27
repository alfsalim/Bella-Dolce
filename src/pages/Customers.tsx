import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  ChevronRight,
  History,
  ShoppingBag
} from 'lucide-react';
import { db, collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, where, orderBy, handleFirestoreError, OperationType } from '../lib/firebase';
import { Customer, Order } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const Customers: React.FC = () => {
  const { t, isRTL, formatCurrency } = useLanguage();
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    type: 'b2c'
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'customers'));

    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      const q = query(
        collection(db, 'orders'),
        where('customerId', '==', selectedCustomer.id),
        orderBy('createdAt', 'desc')
      );
      const unsubOrders = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(data);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));
      return () => unsubOrders();
    } else {
      setOrders([]);
    }
  }, [selectedCustomer]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setIsEditing(true);
      setFormData(customer);
    } else {
      setIsEditing(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        type: 'b2c'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && formData.id) {
        await updateDoc(doc(db, 'customers', formData.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success(t('customerUpdated'));
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success(t('customerAdded'));
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Failed to save customer");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success(t('customerDeleted'));
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Failed to delete customer");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  if (!profile || !['admin', 'manager', 'cashier'].includes(profile.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mb-6">
          <Users className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md">Only authorized personnel can access the customer management section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-primary-600" />
            {t('customers')}
          </h1>
          <p className="text-slate-500 mt-1">Manage individual and business customer profiles</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn-primary gap-2"
        >
          <Plus className="w-5 h-5" />
          {t('addCustomer')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customers List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>

          <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 no-scrollbar">
            {filteredCustomers.map((customer) => (
              <motion.button
                key={customer.id}
                layoutId={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className={clsx(
                  "w-full text-left p-4 rounded-2xl border transition-all duration-200 group",
                  selectedCustomer?.id === customer.id
                    ? "bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/20"
                    : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-white/5 hover:border-primary-500 dark:hover:border-primary-500"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                      selectedCustomer?.id === customer.id ? "bg-white/20" : "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                    )}>
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold truncate max-w-[150px]">{customer.name}</h3>
                      <p className={clsx(
                        "text-xs",
                        selectedCustomer?.id === customer.id ? "text-white/70" : "text-slate-500"
                      )}>{customer.phone}</p>
                    </div>
                  </div>
                  <ChevronRight className={clsx(
                    "w-5 h-5 transition-transform",
                    selectedCustomer?.id === customer.id ? "translate-x-1" : "text-slate-300"
                  )} />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Detailed View */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedCustomer ? (
              <motion.div
                key={selectedCustomer.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden"
              >
                <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-3xl bg-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-primary-600/20">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</h2>
                        <div className="flex items-center gap-3 mt-2">
                           <span className={clsx(
                             "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                             selectedCustomer.type === 'b2b' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                           )}>
                             {selectedCustomer.type === 'b2b' ? 'Business' : 'Individual'}
                           </span>
                           <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-[10px] font-bold uppercase tracking-wider">Regular</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleOpenModal(selectedCustomer)}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-all font-bold"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(selectedCustomer.id)}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:text-red-600 transition-all font-bold"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Phone className="w-5 h-5 text-primary-600" />
                      {t('contactInfo')}
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t('phone')}</p>
                          <p className="text-slate-900 dark:text-white font-medium">{selectedCustomer.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t('email')}</p>
                          <p className="text-slate-900 dark:text-white font-medium">{selectedCustomer.email || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t('address')}</p>
                          <p className="text-slate-900 dark:text-white font-medium">{selectedCustomer.address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-primary-600" />
                      Recent Activity
                    </h3>
                    <div className="space-y-3">
                       <div className="p-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-500/20">
                          <p className="text-xs text-primary-600 dark:text-primary-400 font-bold uppercase tracking-widest mb-1">Total Purchases</p>
                          <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                            {formatCurrency(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
                          </p>
                       </div>
                       <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/20">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest mb-1">Active Orders</p>
                          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length}
                          </p>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-slate-100 dark:border-white/5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <History className="w-5 h-5 text-primary-600" />
                    Order History
                  </h3>
                  <div className="space-y-3">
                    {orders.length > 0 ? (
                      orders.slice(0, 5).map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                                 <ShoppingBag className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-slate-900 dark:text-white">Order #{order.id.slice(-6).toUpperCase()}</p>
                                 <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-sm font-bold text-primary-600">{formatCurrency(order.totalAmount || 0)}</p>
                              <span className={clsx(
                                "text-[10px] font-bold uppercase tracking-widest",
                                order.status === 'delivered' ? "text-green-600" : "text-amber-600"
                              )}>{order.status}</span>
                           </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 italic text-sm text-center py-8">No order history found.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[40px]">
                <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 rounded-full flex items-center justify-center text-slate-300 mb-6">
                  <Users className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select a Customer</h2>
                <p className="text-slate-500 max-w-xs">View detailed purchase history and manage profile information.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {isEditing ? t('editCustomer') : t('addCustomer')}
                </h2>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('name')}</label>
                  <input 
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="input"
                    placeholder="Enter customer name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('email')}</label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="input"
                    placeholder="customer@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('phone')}</label>
                  <input 
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="input"
                    placeholder="+213 5XX XX XX XX"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('address')}</label>
                  <input 
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="input"
                    placeholder="Street address, City"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="input"
                  >
                    <option value="b2c">Individual</option>
                    <option value="b2b">Business / Wholesale</option>
                  </select>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 btn-secondary"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary"
                  >
                    {t('save')}
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

export default Customers;
