import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { FixedAssetDbRow } from '../types';
import { clsx } from 'clsx';
import { PAGE_SIZE } from '../constants';
import Pagination from '../components/Pagination';
import { authFetch, getAuthHeaders, parseJsonResponse, readApiErrorMessage } from '../lib/api-client';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const ASSET_CATEGORIES = ['oven', 'refrigeration', 'vehicle', 'it', 'furniture', 'other'] as const;
const ASSET_STATUSES = ['IN_SERVICE', 'IDLE', 'DISPOSED'] as const;

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

const AssetManagement: React.FC = () => {
  const { formatCurrency, isRTL, tf, t } = useLanguage();
  const [assets, setAssets] = useState<FixedAssetDbRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
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

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const res = await authFetch('/api/db/fixedAssets', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await parseJsonResponse<FixedAssetDbRow[]>(res);
      setAssets([...data].sort((a, b) => new Date(b.acquisitionDate).getTime() - new Date(a.acquisitionDate).getTime()));
    } catch (e) {
      console.error(e);
      toast.error(tf('payrollLoadFailed'));
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [tf]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    setAssetPage(1);
  }, [assetSearch]);

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
      category: ASSET_CATEGORIES.includes(a.category as any) ? (a.category as any) : 'other',
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
      status: ASSET_STATUSES.includes(a.status as any) ? (a.status as any) : 'IN_SERVICE',
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
      category: assetForm.category,
      location: assetForm.location.trim() || null,
      acquisitionDate: assetForm.acquisitionDate,
      acquisitionCost: cost,
      usefulLifeYears: Number(assetForm.usefulLifeYears) || 5,
      salvageValue: Number(assetForm.salvageValue) || 0,
      depreciationMethod: assetForm.depreciationMethod,
      notes: assetForm.notes.trim() || null,
      maintenanceNotes: assetForm.maintenanceNotes.trim() || null,
      status: assetForm.status,
      lastMaintenanceAt: assetForm.lastMaintenanceAt || null,
      nextMaintenanceAt: assetForm.nextMaintenanceAt || null,
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={clsx('relative flex-1 max-w-md', isRTL && 'ms-auto')}>
          <Search className={clsx('absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400', isRTL ? 'right-3' : 'left-3')} />
          <input
            type="text"
            placeholder={tf('searchAccounts')}
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
            className={clsx('w-full py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all', isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4')}
          />
        </div>
        <button type="button" onClick={openNewAsset} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20">
          <Plus className="w-5 h-5" />
          {tf('assetAdd')}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
        {assetsLoading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{tf('assetCode')}</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{tf('assetName')}</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{tf('assetCategory')}</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-end">{tf('assetAcquisitionCost')}</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-end">{tf('assetAnnualDepreciation')}</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{tf('assetStatus')}</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-end">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {paginatedAssets.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">{tf('searchNoResults')}</td></tr>
                  ) : (
                    paginatedAssets.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{a.name}</td>
                        <td className="px-4 py-3">{categoryTf(a.category)}</td>
                        <td className="px-4 py-3 text-end font-mono">{formatCurrency(a.acquisitionCost)}</td>
                        <td className="px-4 py-3 text-end font-mono text-slate-600 dark:text-slate-300">{formatCurrency(annualDepreciation(a.acquisitionCost, a.salvageValue, a.usefulLifeYears))}</td>
                        <td className="px-4 py-3 text-xs font-bold">{statusTf(a.status)}</td>
                        <td className="px-4 py-3 text-end">
                          <button type="button" onClick={() => openEditAsset(a)} className="p-2 text-slate-400 hover:text-primary-600 inline-flex" title={tf('assetEdit')}><Pencil className="w-4 h-4" /></button>
                          <button type="button" onClick={() => void deleteAsset(a)} className="p-2 text-slate-400 hover:text-rose-600 inline-flex" title={t('delete')}><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={safeAssetPage} totalPages={assetTotalPages} onPageChange={setAssetPage} />
          </>
        )}
      </div>

      {assetModalOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/10">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                {editingAsset ? tf('assetEdit') : tf('assetAdd')}
              </h3>
              <button type="button" onClick={() => setAssetModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input className="input w-full" placeholder={tf('assetName')} value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="input w-full" placeholder={tf('assetCode')} value={assetForm.code} onChange={(e) => setAssetForm((f) => ({ ...f, code: e.target.value }))} />
              <input className="input w-full" type="number" min={0} placeholder={tf('assetAcquisitionCost')} value={assetForm.acquisitionCost} onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionCost: e.target.value }))} />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setAssetModalOpen(false)}>{t('cancel')}</button>
                <button type="button" className="btn-primary" onClick={() => void saveAsset()}>{t('save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManagement;
