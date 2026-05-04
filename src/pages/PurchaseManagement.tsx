import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  AlertCircle,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { authFetch, readApiErrorMessage } from '../lib/api-client';
import { buildPurchasesListUrl } from '../lib/purchaseListQuery';
import { PAGE_SIZE, QUERY_MAX_ITEMS } from '../constants';
import Pagination from '../components/Pagination';

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
  createdAt: string;
  createdBy: string;
}

/** Whole-number quantities for purchases; dozen (eggs) is always an integer. */
function roundPurchaseQuantity(unit: string, quantity: number): number {
  const q = Number(quantity);
  if (!Number.isFinite(q)) return 0;
  const u = (unit || '').toLowerCase();
  if (u === 'dozen' || u.includes('dozen')) {
    return Math.max(1, Math.round(q));
  }
  return Math.max(0, Math.round(q));
}

function scaleTotalPrice(originalQty: number, newQty: number, totalPrice: number): number {
  if (originalQty <= 0 || !Number.isFinite(totalPrice)) {
    return Math.round(Number(totalPrice) * 100) / 100;
  }
  const scaled = (totalPrice / originalQty) * newQty;
  return Math.round(scaled * 100) / 100;
}

interface RawMaterial {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
}

const PurchaseManagement: React.FC = () => {
  const { t, formatCurrency } = useLanguage();
  const tx = (key: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), t(key));
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [sortCol, setSortCol] = useState<'date' | 'supplier' | 'total'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const getDefaultExpiryDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().split('T')[0];
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

  const fetchMaterials = async () => {
    try {
      const token = localStorage.getItem('bakery_token');
      const response = await authFetch('/api/db/rawMaterials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch materials');
      const data = await response.json();
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  /** Sets each raw material to sum(purchases) − consumption(completed batches × recipes); refreshes batch ingredient snapshots. */
  const reconcileInventoryWithProduction = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('bakery_token');
      const res = await authFetch('/api/admin/reconcile-raw-inventory', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (res.ok) await fetchMaterials();
    } catch {
      /* server may be older than this route */
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('bakery_token');
      const response = await authFetch('/api/db/suppliers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      const data = await response.json();
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  useEffect(() => {
    void fetchMaterials();
    void fetchSuppliers();
  }, []);

  useEffect(() => {
    void fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    setPurchasesPage(1);
  }, [searchTerm, purchaseTimeScope, sortCol, sortDir]);

  const updateInventory = async (
    materialId: string,
    quantityChange: number,
    operation: 'add' | 'subtract'
  ) => {
    try {
      const token = localStorage.getItem('bakery_token');

      // Fetch fresh material data instead of using stale state
      const freshResponse = await authFetch(`/api/db/rawMaterials/${materialId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!freshResponse.ok) {
        console.warn(`Material not found: ${materialId}`);
        return;
      }
      const freshMaterial = await freshResponse.json();
      const currentStock = freshMaterial.currentStock || 0;

      const newStock = operation === 'add'
        ? currentStock + quantityChange
        : currentStock - quantityChange;

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
        toast.error(tx('inventoryUpdateFailed', { msg: String(errorData.error ?? '') }));
        return;
      }

      // Update local materials list
      setMaterials(materials.map(m =>
        m.id === materialId
          ? { ...m, currentStock: newStock }
          : m
      ));
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.error(tx('inventorySyncError', { msg: String(error) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const material = materials.find(m => m.id === formData.materialId);
    if (!material) {
      toast.error(t('purchaseSelectMaterial'));
      return;
    }

    if (!formData.supplierId) {
      toast.error(t('purchaseSelectSupplier'));
      return;
    }

    const quantity = roundPurchaseQuantity(material.unit, formData.quantity);
    const price = scaleTotalPrice(formData.quantity, quantity, formData.price);
    if (quantity !== formData.quantity) {
      toast(tx('purchaseQuantityAdjusted', { qty: String(quantity), unit: material.unit }), { icon: 'ℹ️' });
    }

    const token = localStorage.getItem('bakery_token');

    try {
      // Upload PDF if provided
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
        // UPDATE: Calculate quantity difference
        const quantityDifference = quantity - editingPurchase.quantity;

        const supplier = suppliers.find(s => s.id === formData.supplierId);
        const response = await authFetch(`/api/db/purchases/${editingPurchase.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            quantity,
            price,
            materialName: material.name,
            supplierName: supplier?.name || t('unknownSupplier'),
            unit: material.unit,
            totalAmount: price,
            ...(pdfPath && { invoicePdfPath: pdfPath }),
            updatedAt: new Date().toISOString()
          })
        });

        if (!response.ok) throw new Error('Failed to update purchase');

        // Update inventory if quantity changed (don't fail if it errors)
        if (quantityDifference !== 0) {
          try {
            if (quantityDifference > 0) {
              await updateInventory(formData.materialId, quantityDifference, 'add');
            } else {
              await updateInventory(formData.materialId, Math.abs(quantityDifference), 'subtract');
            }
          } catch (invError) {
            console.error('Inventory sync warning:', invError);
            // Don't fail the purchase update if inventory sync fails
          }
        }

        toast.success(t('purchaseUpdatedSuccess'));
      } else {
        // CREATE: Add to inventory
        const supplier = suppliers.find(s => s.id === formData.supplierId);
        const purchaseData = {
          ...formData,
          quantity,
          price,
          materialName: material.name,
          supplierName: supplier?.name || t('unknownSupplier'),
          unit: material.unit,
          totalAmount: price,
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

        // Update inventory (don't fail if it errors)
        try {
          const material = materials.find(m => m.id === formData.materialId);
          if (material) {
            const previousStock = material.currentStock || 0;
            await updateInventory(formData.materialId, quantity, 'add');
            const newStock = previousStock + quantity;

            // Create stock movement record
            await authFetch('/api/db/stockMovements', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                itemId: formData.materialId,
                itemName: material.name,
                itemType: 'material',
                type: 'in',
                quantity,
                previousStock: previousStock,
                newStock: newStock,
                location: 'none',
                reason: 'purchase',
                userId: profile?.id || 'unknown',
                userName: profile?.name || t('unknownUser'),
                timestamp: new Date().toISOString()
              })
            });
          }
        } catch (invError) {
          console.error('Inventory sync warning:', invError);
          // Don't fail the purchase creation if inventory sync fails
        }

        toast.success(t('purchaseCreatedSuccess'));
      }

      setIsModalOpen(false);
      setEditingPurchase(null);
      setPdfFile(null);
      resetForm();
      void fetchPurchases();
      await reconcileInventoryWithProduction();
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast.error(t('purchaseSaveFailed'));
    }
  };

  const handleSyncToInventory = async (purchase: Purchase) => {
    try {
      const material = materials.find(m => m.id === purchase.materialId);
      if (!material) {
        toast.error(tx('materialNotFound', { id: purchase.materialId }));
        return;
      }

      const newStock = (material.currentStock || 0) + purchase.quantity;
      const token = localStorage.getItem('bakery_token');

      const response = await authFetch(`/api/db/rawMaterials/${purchase.materialId}`, {
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
        toast.error(tx('syncFailedWithReason', { msg: String(errorData.error || response.statusText) }));
        return;
      }

      // Create stock movement record
      try {
        const movementResponse = await authFetch('/api/db/stockMovements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            itemId: purchase.materialId,
            itemName: purchase.materialName,
            itemType: 'material',
            type: 'in',
            quantity: purchase.quantity,
            previousStock: material.currentStock || 0,
            newStock: newStock,
            location: 'none',
            reason: 'purchase',
            userId: profile?.id || 'unknown',
            userName: profile?.name || t('unknownUser'),
            timestamp: new Date().toISOString()
          })
        });
        if (!movementResponse.ok) {
          console.warn('Failed to create stock movement');
        }
      } catch (movementError) {
        console.warn('Error creating stock movement:', movementError);
      }

      toast.success(tx('purchaseSyncedToInventory', { qty: String(purchase.quantity), unit: purchase.unit }));
      fetchMaterials();
    } catch (error) {
      toast.error(tx('syncErrorGeneric', { msg: (error as Error).message }));
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

      toast.success(t('purchaseDeletedSuccess'));
      void fetchPurchases();
      await fetchMaterials();
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
    setIsModalOpen(true);
  };

  const filteredPurchases = purchases.filter(p =>
    (p.materialName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const purchasesTotalPages = Math.ceil(filteredPurchases.length / PAGE_SIZE) || 1;
  const safePurchasesPage = Math.min(purchasesPage, purchasesTotalPages);
  const paginatedPurchases = filteredPurchases.slice(
    (safePurchasesPage - 1) * PAGE_SIZE,
    safePurchasesPage * PAGE_SIZE
  );

  if (profile && profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('accessDeniedTitle')}</h1>
        <p className="text-slate-500 max-w-md">{t('purchaseManagementAccessDenied')}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('purchaseManagementTitle')}</h1>
          <p className="text-slate-500 mt-1">{t('purchaseManagementSubtitle')}</p>
        </div>
        <button
          onClick={() => {
            setEditingPurchase(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary gap-2 inline-flex"
        >
          <Plus className="w-5 h-5" />
          {t('newPurchase')}
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
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
            className="input py-2 text-sm min-w-[8rem]"
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
      </div>

      {/* Purchases Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/5">
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">{t('colMaterial')}</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                  <button onClick={() => handleSort('supplier')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    {t('colSupplier')}
                    {sortCol === 'supplier' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                  </button>
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">{t('quantity')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">{t('price')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">
                  <button onClick={() => handleSort('total')} className="flex items-center gap-1 ml-auto hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    {t('colTotal')}
                    {sortCol === 'total' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                  <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    {t('colDate')}
                    {sortCol === 'date' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                  </button>
                </th>
                <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">{t('colInvoice')}</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{purchase.materialName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{purchase.supplierName}</td>
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
                    {(purchase as any).invoicePdfPath ? (
                      <a
                        href={(purchase as any).invoicePdfPath}
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
                        onClick={() => handleSyncToInventory(purchase)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                        title={t('titleSyncToInventory')}
                      >
                        ⤴️
                      </button>
                      <button
                        onClick={() => handleEdit(purchase)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title={t('titleEditPurchase')}
                      >
                        <Edit2 className="w-4 h-4" />
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
              ))}
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

      {/* Modal */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('colMaterial')} <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={formData.materialId}
                      onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">{t('selectMaterial')}</option>
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
                      className="input w-full"
                    >
                      <option value="">{t('selectSupplier')}</option>
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
                      min={1}
                      step={1}
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('price')} <span className="text-red-600">*</span>
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

                  <div className="md:col-span-2">
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
                            return;
                          }
                          setPdfFile(file);
                        }
                      }}
                      className="input w-full"
                    />
                    {pdfFile && (
                      <p className="text-sm text-slate-500 mt-1">{tx('selectedFileLabel', { name: pdfFile.name })}</p>
                    )}
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
                    className="btn-primary"
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

export default PurchaseManagement;
