import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  AlertCircle,
  AlertTriangle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Suppliers from './Suppliers';
import { authFetch, readApiErrorMessage } from '../lib/api-client';
import { buildPurchasesListUrl } from '../lib/purchaseListQuery';
import { PAGE_SIZE, QUERY_MAX_ITEMS } from '../constants';
import Pagination from '../components/Pagination';
import Alert from '../components/Alert';

interface Purchase {
  id: string;
  invoiceNumber: string;
  materialId: string;
  materialName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  price: number;
  brand: string;
  purchaseDate: string;
  expiryDate: string;
  unit: string;
  totalAmount: number;
  invoicePdfPath?: string;
}

interface RawMaterial {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  disabled?: boolean;
}

const Procurement: React.FC = () => {
  const { t, formatCurrency } = useLanguage();
  const tx = (key: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), t(key));
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [sortCol, setSortCol] = useState<'date' | 'supplier' | 'total'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [formFeedback, setFormFeedback] = useState<{type: 'error'|'success'; message: string} | null>(null);
  /** `all` = no date filter (still limited to QUERY_MAX_ITEMS on the server). */
  const [purchaseTimeScope, setPurchaseTimeScope] = useState<number | 'all'>('all');
  const firstPurchasesLoad = useRef(true);

  const handleSort = (col: 'date' | 'supplier' | 'total') => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
    setPurchasesPage(1);
  };

  const [formData, setFormData] = useState({
    materialId: '',
    supplierId: '',
    quantity: 0,
    price: 0,
    brand: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: ''
  });

  const getDefaultExpiryDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().split('T')[0];
  };

  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
      setMaterialsError(null);
      const token = localStorage.getItem('bakery_token');
      const response = await authFetch(`/api/db/rawMaterials?orderBy=${encodeURIComponent(JSON.stringify({ name: 'asc' }))}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response));
      const data = await response.json();
      setMaterials((data || []).filter((m: RawMaterial) => !m.disabled));
    } catch (error) {
      console.error('Error fetching materials:', error);
      const message = error instanceof Error ? error.message : 'Failed to load raw materials';
      setMaterialsError(message);
      toast.error(`${t('purchaseLoadFailed') || 'Load failed'}: ${message}`);
    } finally {
      setMaterialsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      setSuppliersError(null);
      const token = localStorage.getItem('bakery_token');
      const response = await authFetch('/api/db/suppliers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response));
      const data = await response.json();
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      const message = error instanceof Error ? error.message : 'Failed to load suppliers';
      setSuppliersError(message);
      toast.error(`${t('purchaseLoadFailed') || 'Load failed'}: ${message}`);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const fetchPurchases = useCallback(async () => {
    const showSpinner = firstPurchasesLoad.current;
    try {
      if (showSpinner) setLoading(true);
      const token = localStorage.getItem('bakery_token');
      const end = new Date();
      const path =
        purchaseTimeScope === 'all'
          ? buildPurchasesListUrl({ scope: 'all', sortCol, sortDir })
          : (() => {
              const start = new Date(end);
              start.setDate(start.getDate() - purchaseTimeScope);
              return buildPurchasesListUrl({
                scope: 'window',
                sortCol,
                sortDir,
                dateFromYmd: start.toISOString().slice(0, 10),
                dateToYmd: end.toISOString().slice(0, 10),
              });
            })();
      const response = await authFetch(path, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response));
      const data = await response.json();
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error(t('purchaseLoadFailed'));
    } finally {
      if (showSpinner) {
        setLoading(false);
        firstPurchasesLoad.current = false;
      }
    }
  }, [purchaseTimeScope, sortCol, sortDir]);

  useEffect(() => {
    void fetchMaterials();
    void fetchSuppliers();
  }, []);

  useEffect(() => {
    void fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    setPurchasesPage(1);
  }, [searchTerm, showMissingOnly, purchaseTimeScope, sortCol, sortDir]);

  const updateInventory = async (
    materialId: string,
    quantityChange: number,
    operation: 'add' | 'subtract'
  ) => {
    try {
      const material = materials.find(m => m.id === materialId);
      if (!material) {
        console.warn(`Material not found: ${materialId}`);
        return;
      }

      const newStock = operation === 'add'
        ? (material.currentStock || 0) + quantityChange
        : (material.currentStock || 0) - quantityChange;

      const token = localStorage.getItem('bakery_token');
      const response = await authFetch(`/api/db/rawMaterials/${materialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentStock: newStock,
          stock: newStock
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Inventory update error:', errorData);
        return;
      }

      setMaterials(materials.map(m =>
        m.id === materialId
          ? { ...m, currentStock: newStock }
          : m
      ));
    } catch (error) {
      console.error('Error updating inventory:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const material = materials.find(m => m.id === formData.materialId);
    if (!material) {
      setFormFeedback({type: 'error', message: t('purchaseSelectMaterial')});
      return;
    }

    if (!formData.supplierId) {
      setFormFeedback({type: 'error', message: t('purchaseSelectSupplier')});
      return;
    }

    const token = localStorage.getItem('bakery_token');

    try {
      let pdfPath: string | undefined;
      if (pdfFile) {
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              const uploadRes = await authFetch('/api/upload/invoice', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ file: base64 })
              });
              if (!uploadRes.ok) throw new Error(t('pdfUploadFailed'));
              const uploadData = await uploadRes.json();
              pdfPath = uploadData.path;
              resolve(null);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error(t('fileReadFailed')));
          reader.readAsDataURL(pdfFile);
        });
      }

      if (editingPurchase) {
        const quantityDifference = formData.quantity - editingPurchase.quantity;
        const supplier = suppliers.find(s => s.id === formData.supplierId);

        const response = await authFetch(`/api/db/purchases/${editingPurchase.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            materialName: material.name,
            supplierName: supplier?.name || t('unknownSupplier'),
            unit: material.unit,
            totalAmount: formData.price,
            ...(pdfPath && { invoicePdfPath: pdfPath }),
            updatedAt: new Date().toISOString()
          })
        });

        if (!response.ok) throw new Error('Failed to update purchase');

        if (quantityDifference !== 0) {
          try {
            if (quantityDifference > 0) {
              await updateInventory(formData.materialId, quantityDifference, 'add');
            } else {
              await updateInventory(formData.materialId, Math.abs(quantityDifference), 'subtract');
            }
          } catch (invError) {
            console.error('Inventory sync warning:', invError);
          }
        }

        setFormFeedback({type: 'success', message: t('purchaseUpdatedSuccess')});
      } else {
        const supplier = suppliers.find(s => s.id === formData.supplierId);
        const purchaseData = {
          ...formData,
          materialName: material.name,
          supplierName: supplier?.name || t('unknownSupplier'),
          unit: material.unit,
          totalAmount: formData.price,
          ...(pdfPath && { invoicePdfPath: pdfPath }),
          createdAt: new Date().toISOString(),
          createdBy: profile?.id
        };

        const response = await authFetch('/api/db/purchases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(purchaseData)
        });

        if (!response.ok) throw new Error('Failed to create purchase');

        try {
          await updateInventory(formData.materialId, formData.quantity, 'add');
        } catch (invError) {
          console.error('Inventory sync warning:', invError);
        }

        setFormFeedback({type: 'success', message: t('purchaseCreatedSuccess')});
      }

      setIsModalOpen(false);
      setEditingPurchase(null);
      setPdfFile(null);
      resetForm();
      void fetchPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      setFormFeedback({type: 'error', message: t('purchaseSaveFailed')});
    }
  };

  const canDeletePurchase = (purchase: Purchase) => {
    const m = materials.find(x => x.id === purchase.materialId);
    const stock = m?.currentStock ?? 0;
    return stock >= (Number(purchase.quantity) || 0) - 1e-9;
  };

  const handleDelete = async (purchase: Purchase) => {
    if (!canDeletePurchase(purchase)) return;
    if (!confirm(t('purchaseDeleteConfirm'))) {
      return;
    }

    const token = localStorage.getItem('bakery_token');

    try {
      const response = await authFetch(`/api/db/purchases/${purchase.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        toast.error(await readApiErrorMessage(response));
        return;
      }

      setMaterials(ms =>
        ms.map(m =>
          m.id === purchase.materialId
            ? { ...m, currentStock: Math.max(0, (m.currentStock || 0) - (Number(purchase.quantity) || 0)) }
            : m
        )
      );
      toast.success(t('purchaseDeletedSuccess'));
      void fetchPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast.error(t('purchaseDeleteFailed'));
    }
  };

  const resetForm = () => {
    setFormData({
      materialId: '',
      supplierId: '',
      quantity: 0,
      price: 0,
      brand: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: getDefaultExpiryDate()
    });
  };

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormData({
      materialId: purchase.materialId,
      supplierId: purchase.supplierId,
      quantity: purchase.quantity,
      price: purchase.price,
      brand: purchase.brand,
      purchaseDate: purchase.purchaseDate,
      expiryDate: purchase.expiryDate
    });
    setFormFeedback(null);
    setIsModalOpen(true);
  };

  const missingSupplierCount = purchases.filter(p => !p.supplierId && !p.supplierName).length;

  const filteredPurchases = purchases.filter(p => {
      const matchesSearch =
        (p.materialName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()));
      const isMissing = !p.supplierId && !p.supplierName;
      return matchesSearch && (!showMissingOnly || isMissing);
    });
  const purchaseDependenciesLoading = materialsLoading || suppliersLoading;
  const purchaseDependenciesError = materialsError || suppliersError;
  const purchaseSubmitDisabled = purchaseDependenciesLoading || !!purchaseDependenciesError;

  const purchasesTotalPages = Math.ceil(filteredPurchases.length / PAGE_SIZE) || 1;
  const safePurchasesPage = Math.min(purchasesPage, purchasesTotalPages);
  const paginatedPurchases = filteredPurchases.slice(
    (safePurchasesPage - 1) * PAGE_SIZE,
    safePurchasesPage * PAGE_SIZE
  );

  if (loading && activeTab === 'purchases') {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Truck className="w-8 h-8 text-primary-600" />
            {t('procurementPurchasesTitle')}
          </h1>
          <p className="text-slate-500 mt-1">{t('procurementSubtitle')}</p>
        </div>

        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('purchases')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'purchases' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500"
            )}
          >
            <Plus className="w-4 h-4" />
            {t('procurementTabPurchases')}
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
            {/* Missing supplier warning banner */}
            {missingSupplierCount > 0 && (
              <div className="flex items-center justify-between gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-3 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-semibold">
                    {tx('procurementMissingSupplierBanner', { count: String(missingSupplierCount) })}
                  </span>
                </div>
                <button
                  onClick={() => setShowMissingOnly(prev => !prev)}
                  className={clsx(
                    'text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0',
                    showMissingOnly
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700/50'
                  )}
                >
                  {showMissingOnly ? t('showAll') : t('showIncompleteOnly')}
                </button>
              </div>
            )}

            {/* Search and Add Button */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('searchPurchasesPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-12 w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 shrink-0">
                <span className="font-bold whitespace-nowrap">{t('showPurchases')}</span>
                <select
                  className="input py-2 text-sm"
                  value={purchaseTimeScope === 'all' ? 'all' : String(purchaseTimeScope)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPurchaseTimeScope(v === 'all' ? 'all' : Number(v));
                  }}
                >
                  <option value="all">{tx('purchaseTimeAll', { max: String(QUERY_MAX_ITEMS) })}</option>
                  <option value={30}>{t('purchaseTimeLast30')}</option>
                  <option value={90}>{t('purchaseTimeLast90')}</option>
                  <option value={180}>{t('purchaseTimeLast180')}</option>
                  <option value={365}>{t('purchaseTimeLast365')}</option>
                </select>
                <span className="text-xs text-slate-400">
                  {purchaseTimeScope === 'all'
                    ? t('purchaseListSortedNewest')
                    : t('purchaseListByInvoiceDate')}
                </span>
              </label>
              <button
                onClick={() => {
                  setEditingPurchase(null);
                  resetForm();
                  setFormFeedback(null);
                  setIsModalOpen(true);
                }}
                className="btn-primary gap-2 inline-flex"
              >
                <Plus className="w-5 h-5" />
                {t('newPurchase')}
              </button>
            </div>

            {/* Purchases Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/5">
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">{t('colMaterial')}</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                        <button type="button" onClick={() => handleSort('supplier')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                          {t('colSupplier')}
                          {sortCol === 'supplier' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                        </button>
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">{t('quantity')}</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">{t('price')}</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">
                        <button type="button" onClick={() => handleSort('total')} className="flex items-center gap-1 ml-auto hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                          {t('colTotal')}
                          {sortCol === 'total' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                        <button type="button" onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                          {t('colDate')}
                          {sortCol === 'date' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                        </button>
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">{t('colInvoice')}</th>
                      <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPurchases.map((purchase) => {
                      const missingSupplier = !purchase.supplierId && !purchase.supplierName;
                      return (
                      <tr key={purchase.id} className={clsx(
                        "border-b border-slate-100 dark:border-white/5 transition-colors",
                        missingSupplier
                          ? "bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          : "hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                      )}>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{purchase.materialName}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {missingSupplier ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {t('noSupplierLabel')}
                            </span>
                          ) : purchase.supplierName}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-slate-900 dark:text-white">
                          {purchase.quantity} {purchase.unit}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-slate-900 dark:text-white">
                          {formatCurrency(purchase.price)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-primary-600">
                          {formatCurrency(purchase.totalAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {purchase.purchaseDate ? new Date(purchase.purchaseDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {purchase.invoicePdfPath ? (
                            <a
                              href={purchase.invoicePdfPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:underline text-sm font-medium"
                            >
                              📄 {t('invoiceView')}
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(purchase)}
                              className={clsx(
                                "p-2 rounded-lg transition-all",
                                missingSupplier
                                  ? "text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                  : "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              )}
                              title={missingSupplier ? t('titleAssignSupplier') : t('titleEditPurchase')}
                            >
                              {missingSupplier ? <AlertTriangle className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(purchase)}
                              disabled={!canDeletePurchase(purchase)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-35 disabled:pointer-events-none"
                              title={
                                canDeletePurchase(purchase)
                                  ? t('titleDeletePurchase')
                                  : t('titleDeletePurchaseDisabled')
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredPurchases.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500">{t('noPurchasesFound')}</p>
                </div>
              )}
              <Pagination
                currentPage={safePurchasesPage}
                totalPages={Math.ceil(filteredPurchases.length / PAGE_SIZE)}
                onPageChange={setPurchasesPage}
              />
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

      {/* Purchase Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/50">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {editingPurchase ? t('purchaseModalEdit') : t('newPurchase')}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {purchaseDependenciesError && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-bold">{t('purchaseLoadFailed') || 'Failed to load purchase data'}</p>
                      <p>{purchaseDependenciesError}</p>
                      <p className="mt-1 text-xs opacity-80">
                        Use the full app server with npm run dev so /api/db routes are available.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('colMaterial')} <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={formData.materialId}
                      onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                      disabled={materialsLoading || !!materialsError}
                      className="input w-full"
                    >
                      <option value="">
                        {materialsLoading
                          ? t('loading') || 'Loading...'
                          : materialsError
                            ? t('purchaseLoadFailed') || 'Failed to load materials'
                            : t('selectMaterial')}
                      </option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('colSupplier')} <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      disabled={suppliersLoading || !!suppliersError}
                      className="input w-full"
                    >
                      <option value="">
                        {suppliersLoading
                          ? t('loading') || 'Loading...'
                          : suppliersError
                            ? t('purchaseLoadFailed') || 'Failed to load suppliers'
                            : t('selectSupplier')}
                      </option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('quantity')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('priceTotalField')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('brand')}
                    </label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('purchaseDate')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('expiryDate')}
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('invoicePdfLabel')}
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error(t('pdfMaxSizeError'));
                            e.target.value = '';
                            return;
                          }
                          setPdfFile(file);
                        }
                      }}
                      className="input w-full"
                    />
                  </div>
                </div>

                {formFeedback && <Alert type={formFeedback.type} message={formFeedback.message} onDismiss={() => setFormFeedback(null)} />}
                <div className="flex justify-end gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingPurchase(null);
                      setPdfFile(null);
                      resetForm();
                      setFormFeedback(null);
                    }}
                    className="btn-secondary"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={purchaseSubmitDisabled}
                    className="btn-primary px-10 shadow-lg shadow-primary-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingPurchase ? t('purchaseSubmitUpdate') : t('purchaseSubmitCreate')}
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
