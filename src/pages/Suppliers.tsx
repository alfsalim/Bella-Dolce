import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Package, 
  FileText, 
  Edit2, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  History,
  Info
} from 'lucide-react';
import { db, collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, where, orderBy } from '../lib/firebase';
import { Supplier, RawMaterial, SupplierInvoice } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const Suppliers: React.FC = () => {
  const { t, isRTL, formatCurrency } = useLanguage();
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    contact: '',
    phone: '',
    email: '',
    address: '',
    materials: []
  });

  useEffect(() => {
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
      setLoading(false);
    });

    const unsubMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial));
      setMaterials(data);
    });

    return () => {
      unsubSuppliers();
      unsubMaterials();
    };
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      const q = query(
        collection(db, 'supplierInvoices'),
        where('supplierId', '==', selectedSupplier.id),
        orderBy('date', 'desc')
      );
      const unsubInvoices = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierInvoice));
        setInvoices(data);
      });
      return () => unsubInvoices();
    } else {
      setInvoices([]);
    }
  }, [selectedSupplier]);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setIsEditing(true);
      setFormData(supplier);
    } else {
      setIsEditing(false);
      setFormData({
        name: '',
        contact: '',
        phone: '',
        email: '',
        address: '',
        materials: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && formData.id) {
        await updateDoc(doc(db, 'suppliers', formData.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success(t('supplierUpdated'));
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success(t('supplierAdded'));
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Failed to save supplier");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      toast.success(t('supplierDeleted'));
      if (selectedSupplier?.id === id) setSelectedSupplier(null);
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast.error("Failed to delete supplier");
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMaterialNames = (materialIds?: string[]) => {
    if (!materialIds) return [];
    return materials
      .filter(m => materialIds.includes(m.id))
      .map(m => m.name);
  };

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mb-6">
          <Truck className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md">Only administrators and managers can access the supplier management section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Truck className="w-8 h-8 text-primary-600" />
            {t('suppliers')}
          </h1>
          <p className="text-slate-500 mt-1">Manage your supply chain and raw material providers</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn-primary gap-2"
        >
          <Plus className="w-5 h-5" />
          {t('addSupplier')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Suppliers List */}
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

          <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {filteredSuppliers.map((supplier) => (
              <motion.button
                key={supplier.id}
                layoutId={supplier.id}
                onClick={() => setSelectedSupplier(supplier)}
                className={clsx(
                  "w-full text-left p-4 rounded-2xl border transition-all duration-200 group",
                  selectedSupplier?.id === supplier.id
                    ? "bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/20"
                    : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-white/5 hover:border-primary-500 dark:hover:border-primary-500"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                      selectedSupplier?.id === supplier.id ? "bg-white/20" : "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                    )}>
                      {supplier.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold truncate max-w-[150px]">{supplier.name}</h3>
                      <p className={clsx(
                        "text-xs",
                        selectedSupplier?.id === supplier.id ? "text-white/70" : "text-slate-500"
                      )}>{supplier.contact}</p>
                    </div>
                  </div>
                  <ChevronRight className={clsx(
                    "w-5 h-5 transition-transform",
                    selectedSupplier?.id === supplier.id ? "translate-x-1" : "text-slate-300"
                  )} />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Detailed View */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedSupplier ? (
              <motion.div
                key={selectedSupplier.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden"
              >
                {/* Supplier Header */}
                <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-3xl bg-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-primary-600/20">
                        {selectedSupplier.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedSupplier.name}</h2>
                        <p className="text-slate-500 font-medium">{selectedSupplier.contact}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 text-xs font-bold uppercase tracking-wider">
                            Active Supplier
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleOpenModal(selectedSupplier)}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-all"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(selectedSupplier.id)}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Contact Info */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Info className="w-5 h-5 text-primary-600" />
                      {t('contactInfo')}
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t('phone')}</p>
                          <p className="text-slate-900 dark:text-white font-medium">{selectedSupplier.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t('email')}</p>
                          <p className="text-slate-900 dark:text-white font-medium">{selectedSupplier.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t('address')}</p>
                          <p className="text-slate-900 dark:text-white font-medium">{selectedSupplier.address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Associated Materials */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary-600" />
                      {t('associatedMaterials')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedSupplier.materials && selectedSupplier.materials.length > 0 ? (
                        getMaterialNames(selectedSupplier.materials).map((name, idx) => (
                          <span key={idx} className="px-4 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium text-sm border border-primary-100 dark:border-primary-500/20">
                            {name}
                          </span>
                        ))
                      ) : (
                        <p className="text-slate-500 italic text-sm">No materials associated yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoice History */}
                <div className="p-8 border-t border-slate-100 dark:border-white/5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <History className="w-5 h-5 text-primary-600" />
                    {t('invoiceHistory')}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase font-bold tracking-wider border-b border-slate-100 dark:border-white/5">
                          <th className="pb-4 px-4">Invoice #</th>
                          <th className="pb-4 px-4">Date</th>
                          <th className="pb-4 px-4">Amount</th>
                          <th className="pb-4 px-4">Status</th>
                          <th className="pb-4 px-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {invoices.length > 0 ? (
                          invoices.map((invoice) => (
                            <tr key={invoice.id} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all">
                              <td className="py-4 px-4 font-mono text-sm text-slate-600 dark:text-slate-400">{invoice.invoiceNumber}</td>
                              <td className="py-4 px-4 text-slate-900 dark:text-white font-medium">{new Date(invoice.date).toLocaleDateString()}</td>
                              <td className="py-4 px-4 text-slate-900 dark:text-white font-bold">{formatCurrency(invoice.totalAmount)}</td>
                              <td className="py-4 px-4">
                                <span className={clsx(
                                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                  invoice.status === 'PAYÉ' ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                                )}>
                                  {invoice.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <button className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-slate-400 hover:text-primary-600 transition-all">
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500 italic">No invoice history found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[40px]">
                <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 rounded-full flex items-center justify-center text-slate-300 mb-6">
                  <Truck className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select a Supplier</h2>
                <p className="text-slate-500 max-w-xs">Choose a supplier from the list to view their full profile, materials, and financial history.</p>
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
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {isEditing ? t('editSupplier') : t('addSupplier')}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                >
                  <Trash2 className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('supplierName')}</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="input"
                      placeholder="e.g. Grands Moulins de Paris"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Contact Person</label>
                    <input 
                      required
                      type="text"
                      value={formData.contact}
                      onChange={(e) => setFormData({...formData, contact: e.target.value})}
                      className="input"
                      placeholder="e.g. Jean Dupont"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('phone')}</label>
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
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('email')}</label>
                    <input 
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="input"
                      placeholder="contact@supplier.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('address')}</label>
                  <textarea 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="input min-h-[100px] py-4"
                    placeholder="Full business address..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('associatedMaterials')}</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
                    {materials.map((material) => (
                      <label key={material.id} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={formData.materials?.includes(material.id)}
                          onChange={(e) => {
                            const current = formData.materials || [];
                            if (e.target.checked) {
                              setFormData({...formData, materials: [...current, material.id]});
                            } else {
                              setFormData({...formData, materials: current.filter(id => id !== material.id)});
                            }
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-all">
                          {material.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-secondary"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="btn-primary px-8"
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

export default Suppliers;
