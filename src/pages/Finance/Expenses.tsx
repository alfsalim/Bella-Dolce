import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Link2, ExternalLink, Truck, FileText, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { FixedAssetDbRow, FixedAssetMaintenanceRow } from '../../types';
import { clsx } from 'clsx';
import { PAGE_SIZE } from '../../constants';
import Pagination from '../../components/Pagination';
import { authFetch, getAuthHeaders, parseJsonResponse, readApiErrorMessage } from '../../lib/api-client';
import { toast } from 'react-hot-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { db, collection, onSnapshot } from '../../lib/db';
import { useAuth } from '../../contexts/AuthContext';

type PurchaseExpenseRow = {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName?: string | null;
  date: string;
  dueDate?: string | null;
  amountHT?: string | null;
  tvaAmount?: number | null;
  totalAmount: number;
  amountPaid?: number;
  status: string;
};

function parsePurchaseDetails(amountHT: string | null | undefined): {
  materialName?: string;
  materialId?: string;
  quantity?: number;
  unit?: string;
} {
  if (amountHT == null || typeof amountHT !== 'string') return {};
  try {
    const j = JSON.parse(amountHT) as Record<string, unknown>;
    return {
      materialName: typeof j.materialName === 'string' ? j.materialName : undefined,
      materialId: typeof j.materialId === 'string' ? j.materialId : undefined,
      quantity: typeof j.quantity === 'number' ? j.quantity : undefined,
      unit: typeof j.unit === 'string' ? j.unit : undefined,
    };
  } catch {
    return {};
  }
}

function formatApiDate(d: string | Date | null | undefined): string {
  if (d == null) return '—';
  try {
    const x = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(x.getTime())) return '—';
    return format(x, 'yyyy-MM-dd');
  } catch {
    return '—';
  }
}

const ASSET_CATEGORIES = ['oven', 'refrigeration', 'vehicle', 'it', 'furniture', 'other'] as const;
const ASSET_STATUSES = ['IN_SERVICE', 'IDLE', 'DISPOSED'] as const;

const Expenses: React.FC = () => {
  const { formatCurrency, isRTL, tf, t } = useLanguage();
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'assets'>('invoices');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePeriodFrom, setInvoicePeriodFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [invoicePeriodTo, setInvoicePeriodTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [purchaseRows, setPurchaseRows] = useState<PurchaseExpenseRow[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  const [assets, setAssets] = useState<FixedAssetDbRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [materialCategoryById, setMaterialCategoryById] = useState<Record<string, string>>({});
  const [assetPage, setAssetPage] = useState(1);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAssetDbRow | null>(null);
  const [assetForm, setAssetForm] = useState({
    code: '',
    name: '',
    category: 'other',
    location: '',
    acquisitionDate: format(new Date(), 'yyyy-MM-dd'),
    acquisitionCost: '' as string | number,
    usefulLifeYears: 5,
    salvageValue: 0,
    depreciationMethod: 'LINEAR',
    notes: '',
    lastMaintenanceAt: '',
    nextMaintenanceAt: '',
    maintenanceNotes: '',
    status: 'IN_SERVICE',
  });

  const [assetMaintFrom, setAssetMaintFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [assetMaintTo, setAssetMaintTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [assetMaintenancesPeriod, setAssetMaintenancesPeriod] = useState<FixedAssetMaintenanceRow[]>([]);

  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const res = await authFetch('/api/db/purchases', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await parseJsonResponse<PurchaseExpenseRow[]>(res);
      const sorted = [...data].sort((a, b) => {
        const ta = new Date(a.date).getTime();
        const tb = new Date(b.date).getTime();
        return tb - ta;
      });
      setPurchaseRows(sorted);
    } catch (e) {
      console.error(e);
      toast.error(tf('payrollLoadFailed'));
      setPurchaseRows([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, [tf]);

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const res = await authFetch('/api/db/fixedAssets', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await parseJsonResponse<FixedAssetDbRow[]>(res);
      setAssets(
        [...data].sort((a, b) => new Date(b.acquisitionDate).getTime() - new Date(a.acquisitionDate).getTime())
      );
    } catch (e) {
      console.error(e);
      toast.error(tf('payrollLoadFailed'));
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [tf]);

  const fetchAssetMaintenancesPeriod = useCallback(async () => {
    if (activeSubTab !== 'assets') return;
    try {
      const where = {
        AND: [
          { date: { gte: `${assetMaintFrom}T00:00:00.000Z` } },
          { date: { lte: `${assetMaintTo}T23:59:59.999Z` } },
        ],
      };
      const res = await authFetch(
        `/api/db/fixedAssetMaintenances?where=${encodeURIComponent(JSON.stringify(where))}&take=5000`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await parseJsonResponse<FixedAssetMaintenanceRow[]>(res);
      setAssetMaintenancesPeriod(data);
    } catch (e) {
      console.error(e);
      setAssetMaintenancesPeriod([]);
    }
  }, [activeSubTab, assetMaintFrom, assetMaintTo]);

  useEffect(() => {
    void fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      const next: Record<string, string> = {};
      snapshot.docs.forEach((row) => {
        const data = row.data() as any;
        next[row.id] = String(data.category || '').toLowerCase();
      });
      setMaterialCategoryById(next);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'assets') void fetchAssets();
  }, [activeSubTab, fetchAssets]);

  useEffect(() => {
    void fetchAssetMaintenancesPeriod();
  }, [fetchAssetMaintenancesPeriod]);

  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceSearch, invoicePeriodFrom, invoicePeriodTo]);

  useEffect(() => {
    setAssetPage(1);
  }, [assetSearch]);

  const filteredPurchases = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    const fromTs = invoicePeriodFrom ? new Date(`${invoicePeriodFrom}T00:00:00.000Z`).getTime() : null;
    const toTs = invoicePeriodTo ? new Date(`${invoicePeriodTo}T23:59:59.999Z`).getTime() : null;
    return purchaseRows.filter((row) => {
      const rowTs = new Date(row.date).getTime();
      if (fromTs != null && rowTs < fromTs) return false;
      if (toTs != null && rowTs > toTs) return false;
      if (!q) return true;
      const det = parsePurchaseDetails(row.amountHT);
      return (
        (row.supplierName ?? '').toLowerCase().includes(q) ||
        row.invoiceNumber.toLowerCase().includes(q) ||
        (det.materialName ?? '').toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q)
      );
    });
  }, [purchaseRows, invoiceSearch, invoicePeriodFrom, invoicePeriodTo]);

  const invoiceTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE));
  const safeInvoicePage = Math.min(invoicePage, invoiceTotalPages);
  const paginatedInvoices = filteredPurchases.slice(
    (safeInvoicePage - 1) * PAGE_SIZE,
    safeInvoicePage * PAGE_SIZE
  );

  const purchaseBuckets = useMemo(() => {
    return filteredPurchases.reduce(
      (acc, row) => {
        const details = parsePurchaseDetails(row.amountHT);
        const category = details.materialId ? materialCategoryById[details.materialId] : '';
        if (category === 'kitchen') acc.rawMaterial += Number(row.totalAmount || 0);
        else acc.consumable += Number(row.totalAmount || 0);
        return acc;
      },
      { rawMaterial: 0, consumable: 0 }
    );
  }, [filteredPurchases, materialCategoryById]);

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.location ?? '').toLowerCase().includes(q)
    );
  }, [assets, assetSearch]);

  const assetTotalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const safeAssetPage = Math.min(assetPage, assetTotalPages);
  const paginatedAssets = filteredAssets.slice((safeAssetPage - 1) * PAGE_SIZE, safeAssetPage * PAGE_SIZE);

  const assetFinanceTotals = useMemo(() => {
    let annual = 0;
    for (const a of filteredAssets) {
      const y = Math.max(1, a.usefulLifeYears || 1);
      annual += Math.max(0, (Number(a.acquisitionCost) - Number(a.salvageValue ?? 0)) / y);
    }
    const maint = assetMaintenancesPeriod.reduce((s, m) => s + Number(m.cost || 0), 0);
    return { annual, monthly: annual / 12, maint };
  }, [filteredAssets, assetMaintenancesPeriod]);

  const maintSpendByAssetCode = useMemo(() => {
    const idToCode = new Map(assets.map((a) => [a.id, a.code]));
    const m = new Map<string, number>();
    for (const row of assetMaintenancesPeriod) {
      const code = idToCode.get(row.fixedAssetId) ?? row.fixedAssetId;
      m.set(code, (m.get(code) ?? 0) + Number(row.cost || 0));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [assetMaintenancesPeriod, assets]);

  const categoryTf = (c: string) => {
    const m: Record<string, string> = {
      oven: 'assetCatOven',
      refrigeration: 'assetCatRefrigeration',
      vehicle: 'assetCatVehicle',
      it: 'assetCatIt',
      furniture: 'assetCatFurniture',
      other: 'assetCatOther',
    };
    return tf(m[c] ?? 'assetCatOther');
  };

  const statusTf = (s: string) => {
    if (s === 'IN_SERVICE') return tf('assetStatusInService');
    if (s === 'IDLE') return tf('assetStatusIdle');
    if (s === 'DISPOSED') return tf('assetStatusDisposed');
    return s;
  };

  const annualDepreciation = (cost: number, salvage: number, years: number) => {
    const y = Math.max(1, years || 1);
    return Math.max(0, (Number(cost) - Number(salvage)) / y);
  };

  const openNewAsset = () => {
    setEditingAsset(null);
    setAssetForm({
      code: '',
      name: '',
      category: 'other',
      location: '',
      acquisitionDate: format(new Date(), 'yyyy-MM-dd'),
      acquisitionCost: '',
      usefulLifeYears: 5,
      salvageValue: 0,
      depreciationMethod: 'LINEAR',
      notes: '',
      lastMaintenanceAt: '',
      nextMaintenanceAt: '',
      maintenanceNotes: '',
      status: 'IN_SERVICE',
    });
    setAssetModalOpen(true);
  };

  const openEditAsset = (a: FixedAssetDbRow) => {
    setEditingAsset(a);
    setAssetForm({
      code: a.code,
      name: a.name,
      category: ASSET_CATEGORIES.includes(a.category as (typeof ASSET_CATEGORIES)[number]) ? (a.category as typeof ASSET_CATEGORIES[number]) : 'other',
      location: a.location ?? '',
      acquisitionDate: formatApiDate(a.acquisitionDate) === '—' ? format(new Date(), 'yyyy-MM-dd') : formatApiDate(a.acquisitionDate),
      acquisitionCost: a.acquisitionCost,
      usefulLifeYears: a.usefulLifeYears ?? 5,
      salvageValue: a.salvageValue ?? 0,
      depreciationMethod: a.depreciationMethod ?? 'LINEAR',
      notes: a.notes ?? '',
      lastMaintenanceAt: a.lastMaintenanceAt ? formatApiDate(a.lastMaintenanceAt) : '',
      nextMaintenanceAt: a.nextMaintenanceAt ? formatApiDate(a.nextMaintenanceAt) : '',
      maintenanceNotes: a.maintenanceNotes ?? '',
      status: ASSET_STATUSES.includes(a.status as (typeof ASSET_STATUSES)[number])
        ? (a.status as typeof ASSET_STATUSES[number])
        : 'IN_SERVICE',
    });
    setAssetModalOpen(true);
  };

  const saveAsset = async () => {
    const cost = Number(assetForm.acquisitionCost);
    if (!assetForm.name.trim() || !Number.isFinite(cost) || cost < 0) {
      toast.error(t('requiredFieldsMissing') || 'Invalid');
      return;
    }
    const code = assetForm.code.trim() || `AST-${Date.now().toString(36).toUpperCase()}`;
    const payload: Record<string, unknown> = {
      code,
      name: assetForm.name.trim(),
      acquisitionDate: assetForm.acquisitionDate,
      acquisitionCost: cost,
      usefulLifeYears: Number(assetForm.usefulLifeYears) || 5,
    };

    try {
      if (editingAsset) {
        const res = await authFetch(`/api/db/fixedAssets/${editingAsset.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
      } else {
        const res = await authFetch('/api/db/fixedAssets', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
      }
      toast.success(tf('assetSaved'));
      setAssetModalOpen(false);
      void fetchAssets();
    } catch (e) {
      console.error(e);
      toast.error(t('errorAddingCategory') || 'Error');
    }
  };

  const deleteAsset = async (a: FixedAssetDbRow) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const res = await authFetch(`/api/db/fixedAssets/${a.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      toast.success(tf('assetDeleted'));
      void fetchAssets();
    } catch (e) {
      console.error(e);
      toast.error(t('purchaseSaveFailed') || 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveSubTab('invoices')}
          className={clsx(
            'pb-3 text-sm font-bold transition-all relative',
            activeSubTab === 'invoices'
              ? 'text-primary-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <BilingualLabel tKey="supplierInvoices" tf />
          {activeSubTab === 'invoices' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('assets')}
          className={clsx(
            'pb-3 text-sm font-bold transition-all relative',
            activeSubTab === 'assets'
              ? 'text-primary-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <BilingualLabel tKey="fixedAssets" tf />
          {activeSubTab === 'assets' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-sm text-amber-950 dark:text-amber-100/90">
            <p className="font-bold flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4" />
              {tf('expensesLinkedPurchasesIntro')}
            </p>
            <p className="text-amber-900/80 dark:text-amber-200/80 mb-3">{tf('expensesAttachHint')}</p>
            <Link
              to="/procurement"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {tf('expensesGoToProcurement')}
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className={clsx('relative flex-1 max-w-md', isRTL && 'ms-auto')}>
              <Search
                className={clsx(
                  'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400',
                  isRTL ? 'right-3' : 'left-3'
                )}
              />
              <input
                type="text"
                placeholder={tf('searchInvoices')}
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className={clsx(
                  'w-full py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all',
                  isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                )}
              />
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block">{tf('assetFinancePeriodFrom')}</label>
                <input
                  type="date"
                  value={invoicePeriodFrom}
                  onChange={(e) => setInvoicePeriodFrom(e.target.value)}
                  className="input py-1.5 text-sm mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block">{tf('assetFinancePeriodTo')}</label>
                <input
                  type="date"
                  value={invoicePeriodTo}
                  onChange={(e) => setInvoicePeriodTo(e.target.value)}
                  className="input py-1.5 text-sm mt-0.5"
                />
              </div>
              <button
                type="button"
                onClick={() => void fetchPurchases()}
                className="text-sm font-bold text-primary-600 hover:text-primary-700"
              >
                {t('sync')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
              <p className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">{t('rawMaterial')}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(purchaseBuckets.rawMaterial)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
              <p className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">{t('consumable')}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(purchaseBuckets.consumable)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            {purchasesLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <BilingualLabel tKey="supplier" tf />
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {tf('expensesColumnMaterial')}
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <BilingualLabel tKey="invoiceNumber" tf />
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <BilingualLabel tKey="date" tf />
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <BilingualLabel tKey="status" tf />
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                          <BilingualLabel tKey="totalAmount" tf />
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                          {t('actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {paginatedInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                            {tf('searchNoResults')}
                          </td>
                        </tr>
                      ) : (
                        paginatedInvoices.map((invoice) => {
                          const det = parsePurchaseDetails(invoice.amountHT);
                          const matLabel =
                            det.materialName ??
                            (typeof invoice.amountHT === 'string' && invoice.amountHT && !det.materialName
                              ? '—'
                              : '—');
                          return (
                            <tr
                              key={invoice.id}
                              className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-slate-500">
                                    <Truck className="w-4 h-4" />
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {invoice.supplierName ?? '—'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                {matLabel}
                                {det.quantity != null && det.unit != null && (
                                  <span className="text-slate-400 text-xs block">
                                    {det.quantity} {det.unit}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                                  {invoice.invoiceNumber}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm text-slate-900 dark:text-white font-medium">
                                    {formatApiDate(invoice.date)}
                                  </span>
                                  {invoice.dueDate && (
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                                      {tf('invoiceDuePrefix')} {formatApiDate(invoice.dueDate)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={clsx(
                                    'text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest',
                                    invoice.status === 'APPROUVÉ'
                                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                      : invoice.status === 'EN_ATTENTE_VALIDATION'
                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                        : 'bg-slate-50 dark:bg-zinc-800 text-slate-500'
                                  )}
                                >
                                  {invoice.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {formatCurrency(Number(invoice.totalAmount))}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Link
                                  to="/procurement"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  {tf('expensesGoToProcurement')}
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={safeInvoicePage}
                  totalPages={invoiceTotalPages}
                  onPageChange={setInvoicePage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'assets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className={clsx('relative flex-1 max-w-md', isRTL && 'ms-auto')}>
              <Search
                className={clsx(
                  'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400',
                  isRTL ? 'right-3' : 'left-3'
                )}
              />
              <input
                type="text"
                placeholder={tf('searchAccounts')}
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className={clsx(
                  'w-full py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all',
                  isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                )}
              />
            </div>
            {profile?.role === 'admin' && (
              <Link
                to="/administration?tab=assets"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
                aria-label={tf('administration')}
                title={tf('administration')}
              >
                <ExternalLink className="w-5 h-5" />
                {tf('administration')}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{tf('assetFinanceDepreciationTotalAnnual')}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(assetFinanceTotals.annual)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{tf('assetFinanceDepreciationMonthlyAccrual')}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(assetFinanceTotals.monthly)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm sm:col-span-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{tf('assetFinanceMaintenanceSpend')}</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block">{tf('assetFinancePeriodFrom')}</label>
                  <input
                    type="date"
                    value={assetMaintFrom}
                    onChange={(e) => setAssetMaintFrom(e.target.value)}
                    className="input py-1.5 text-sm mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block">{tf('assetFinancePeriodTo')}</label>
                  <input
                    type="date"
                    value={assetMaintTo}
                    onChange={(e) => setAssetMaintTo(e.target.value)}
                    className="input py-1.5 text-sm mt-0.5"
                  />
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white pb-0.5">{formatCurrency(assetFinanceTotals.maint)}</p>
              </div>
            </div>
          </div>

          {maintSpendByAssetCode.length > 0 && (
            <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{tf('assetFinanceMaintenanceSpend')} — par actif</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {maintSpendByAssetCode.map(([code, amt]) => (
                      <tr key={code} className="border-b border-slate-50 dark:border-white/5 last:border-0">
                        <td className="py-2 font-mono text-xs">{code}</td>
                        <td className="py-2 text-end font-mono">{formatCurrency(amt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
            {tf('assetDepreciationLinear')} — {tf('assetAnnualDepreciation')}.
          </p>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            {assetsLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {tf('assetCode')}
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {tf('assetName')}
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {tf('assetCategory')}
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-end">
                          {tf('assetAcquisitionCost')}
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-end">
                          {tf('assetAnnualDepreciation')}
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {tf('assetNextMaintenance')}
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {tf('assetStatus')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {paginatedAssets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                            {tf('searchNoResults')}
                          </td>
                        </tr>
                      ) : (
                        paginatedAssets.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{a.name}</td>
                            <td className="px-4 py-3">{categoryTf(a.category)}</td>
                            <td className="px-4 py-3 text-end font-mono">{formatCurrency(a.acquisitionCost)}</td>
                            <td className="px-4 py-3 text-end font-mono text-slate-600 dark:text-slate-300">
                              {formatCurrency(annualDepreciation(a.acquisitionCost, a.salvageValue, a.usefulLifeYears))}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {a.nextMaintenanceAt ? formatApiDate(a.nextMaintenanceAt) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold">{statusTf(a.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={safeAssetPage}
                  totalPages={assetTotalPages}
                  onPageChange={setAssetPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {assetModalOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/10">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                {editingAsset ? tf('assetEdit') : tf('assetAdd')}
              </h3>
              <button
                type="button"
                onClick={() => setAssetModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetCode')}
                  </label>
                  <input
                    className="input w-full mt-1"
                    value={assetForm.code}
                    onChange={(e) => setAssetForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="AST-…"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetCategory')}
                  </label>
                  <select
                    className="input w-full mt-1"
                    value={assetForm.category}
                    onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {ASSET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryTf(c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {tf('assetName')}
                </label>
                <input
                  className="input w-full mt-1"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {tf('assetLocation')}
                </label>
                <input
                  className="input w-full mt-1"
                  value={assetForm.location}
                  onChange={(e) => setAssetForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder={tf('stockLocationShop')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetAcquisitionDate')}
                  </label>
                  <input
                    type="date"
                    className="input w-full mt-1"
                    value={assetForm.acquisitionDate}
                    onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetStatus')}
                  </label>
                  <select
                    className="input w-full mt-1"
                    value={assetForm.status}
                    onChange={(e) => setAssetForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {ASSET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusTf(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetAcquisitionCost')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="input w-full mt-1"
                    value={assetForm.acquisitionCost}
                    onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionCost: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetSalvageValue')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="input w-full mt-1"
                    value={assetForm.salvageValue}
                    onChange={(e) =>
                      setAssetForm((f) => ({ ...f, salvageValue: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetUsefulLifeYears')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="input w-full mt-1"
                    value={assetForm.usefulLifeYears}
                    onChange={(e) =>
                      setAssetForm((f) => ({ ...f, usefulLifeYears: Number(e.target.value) || 5 }))
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetDepreciationMethod')}
                  </label>
                  <select
                    className="input w-full mt-1"
                    value={assetForm.depreciationMethod}
                    onChange={(e) => setAssetForm((f) => ({ ...f, depreciationMethod: e.target.value }))}
                  >
                    <option value="LINEAR">{tf('assetDepreciationLinear')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetLastMaintenance')}
                  </label>
                  <input
                    type="date"
                    className="input w-full mt-1"
                    value={assetForm.lastMaintenanceAt}
                    onChange={(e) => setAssetForm((f) => ({ ...f, lastMaintenanceAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {tf('assetNextMaintenance')}
                  </label>
                  <input
                    type="date"
                    className="input w-full mt-1"
                    value={assetForm.nextMaintenanceAt}
                    onChange={(e) => setAssetForm((f) => ({ ...f, nextMaintenanceAt: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {tf('assetMaintenanceNotes')}
                </label>
                <textarea
                  className="input w-full mt-1 min-h-[72px]"
                  value={assetForm.maintenanceNotes}
                  onChange={(e) => setAssetForm((f) => ({ ...f, maintenanceNotes: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {tf('assetNotes')}
                </label>
                <textarea
                  className="input w-full mt-1 min-h-[56px]"
                  value={assetForm.notes}
                  onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <button type="button" onClick={() => void saveAsset()} className="btn-primary w-full py-3 font-bold">
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
