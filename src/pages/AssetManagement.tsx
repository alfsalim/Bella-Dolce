import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, FileText, Download, Upload, Wrench } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { FixedAssetDbRow, FixedAssetMaintenanceRow } from '../types';
import { clsx } from 'clsx';
import { PAGE_SIZE } from '../constants';
import Pagination from '../components/Pagination';
import { authFetch, getAuthHeaders, parseJsonResponse, readApiErrorMessage } from '../lib/api-client';
import { toast } from 'react-hot-toast';
import { addDays, format } from 'date-fns';
import {
  downloadFixedAssetsXlsx,
  exportFixedAssetsWorkbook,
  parseFixedAssetsImportWorkbook,
} from '../lib/fixedAssetsExcel';

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

function toDateInputValue(d: string | Date | null | undefined): string {
  if (d == null) return '';
  try {
    if (typeof d === 'string') {
      // Keep "YYYY-MM-DD" as-is (avoid timezone shifts from `new Date('YYYY-MM-DD')`).
      const s = d.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
      return '';
    }
    return format(d, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function normalizeCategory(c: string | undefined): string {
  const x = (c ?? 'other').toLowerCase().trim();
  return ASSET_CATEGORIES.includes(x as (typeof ASSET_CATEGORIES)[number]) ? x : 'other';
}

function normalizeStatus(s: string | undefined): string {
  const x = (s ?? 'IN_SERVICE').toUpperCase().trim();
  return ASSET_STATUSES.includes(x as (typeof ASSET_STATUSES)[number]) ? x : 'IN_SERVICE';
}

const AssetManagement: React.FC = () => {
  const { formatCurrency, isRTL, tf, t } = useLanguage();
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
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
    salvageValue: 0 as string | number,
    depreciationMethod: 'LINEAR',
    notes: '',
    status: 'IN_SERVICE',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [maintenanceAsset, setMaintenanceAsset] = useState<FixedAssetDbRow | null>(null);
  const [maintenances, setMaintenances] = useState<FixedAssetMaintenanceRow[]>([]);
  const [maintenancesLoading, setMaintenancesLoading] = useState(false);
  const [editingMaint, setEditingMaint] = useState<FixedAssetMaintenanceRow | null>(null);
  const defaultNextDue = useMemo(() => format(addDays(new Date(), 90), 'yyyy-MM-dd'), []);
  const [maintForm, setMaintForm] = useState({
    date: today,
    description: '',
    cost: '' as string | number,
    nextDueDate: defaultNextDue,
  });

  // Some browsers / locales can display an empty date input unless the state is explicitly populated.
  // Keep it always set for "new maintenance" mode.
  useEffect(() => {
    if (!maintenanceAsset) return;
    if (editingMaint) return;
    if (!maintForm.date) setMaintForm((f) => ({ ...f, date: today }));
  }, [maintenanceAsset, editingMaint, maintForm.date, today]);

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

  const syncAssetMaintenanceSnapshot = useCallback(async (assetId: string) => {
    try {
      const where = encodeURIComponent(JSON.stringify({ fixedAssetId: assetId }));
      const orderBy = encodeURIComponent(JSON.stringify({ date: 'desc' }));
      const res = await authFetch(`/api/db/fixedAssetMaintenances?where=${where}&orderBy=${orderBy}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const list = await parseJsonResponse<FixedAssetMaintenanceRow[]>(res);
      const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const last = sorted[0]?.date;
      const nextDue = sorted.find((x) => x.nextDueDate)?.nextDueDate;
      const body: Record<string, unknown> = {};
      if (last) {
        body.lastMaintenanceAt = String(last).slice(0, 10);
      } else {
        body.lastMaintenanceAt = null;
      }
      if (nextDue) {
        body.nextMaintenanceAt = String(nextDue).slice(0, 10);
      } else {
        body.nextMaintenanceAt = null;
      }
      const put = await authFetch(`/api/db/fixedAssets/${assetId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!put.ok) throw new Error(await readApiErrorMessage(put));
      void fetchAssets();
    } catch (e) {
      console.error(e);
    }
  }, [fetchAssets]);

  const loadMaintenances = useCallback(async (asset: FixedAssetDbRow) => {
    setMaintenanceAsset(asset);
    setMaintenancesLoading(true);
    setEditingMaint(null);
    setMaintForm({
      date: today,
      description: '',
      cost: '',
      nextDueDate: defaultNextDue,
    });
    try {
      const where = encodeURIComponent(JSON.stringify({ fixedAssetId: asset.id }));
      const orderBy = encodeURIComponent(JSON.stringify({ date: 'desc' }));
      const res = await authFetch(`/api/db/fixedAssetMaintenances?where=${where}&orderBy=${orderBy}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await parseJsonResponse<FixedAssetMaintenanceRow[]>(res);
      setMaintenances(data);
    } catch (e) {
      console.error(e);
      toast.error(tf('payrollLoadFailed'));
      setMaintenances([]);
    } finally {
      setMaintenancesLoading(false);
    }
  }, [tf, today, defaultNextDue]);

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
      status: 'IN_SERVICE',
    });
    setAssetModalOpen(true);
  };

  const openEditAsset = (a: FixedAssetDbRow) => {
    setEditingAsset(a);
    setAssetForm({
      code: a.code,
      name: a.name,
      category: normalizeCategory(a.category),
      location: a.location ?? '',
      acquisitionDate:
        formatApiDate(a.acquisitionDate) === '—' ? format(new Date(), 'yyyy-MM-dd') : formatApiDate(a.acquisitionDate),
      acquisitionCost: a.acquisitionCost,
      usefulLifeYears: a.usefulLifeYears ?? 5,
      salvageValue: a.salvageValue ?? 0,
      depreciationMethod: a.depreciationMethod ?? 'LINEAR',
      notes: a.notes ?? '',
      status: normalizeStatus(a.status),
    });
    setAssetModalOpen(true);
  };

  const saveAsset = async () => {
    const cost = Number(assetForm.acquisitionCost);
    if (!assetForm.name.trim() || !Number.isFinite(cost) || cost < 0) {
      toast.error(t('requiredFieldsMissing') || 'Invalid');
      return;
    }
    const salvage = Number(assetForm.salvageValue);
    const code = assetForm.code.trim() || `AST-${Date.now().toString(36).toUpperCase()}`;
    const payload: Record<string, unknown> = {
      code,
      name: assetForm.name.trim(),
      category: assetForm.category,
      location: assetForm.location.trim() || undefined,
      acquisitionDate: assetForm.acquisitionDate,
      acquisitionCost: cost,
      usefulLifeYears: Number(assetForm.usefulLifeYears) || 5,
      salvageValue: Number.isFinite(salvage) && salvage >= 0 ? salvage : 0,
      depreciationMethod: assetForm.depreciationMethod || 'LINEAR',
      notes: assetForm.notes.trim() || undefined,
      status: assetForm.status,
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

  const exportXlsx = () => {
    const wb = exportFixedAssetsWorkbook(assets);
    const name =
      assets.length === 0
        ? 'fixed-assets-import-template.xlsx'
        : `fixed-assets-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    downloadFixedAssetsXlsx(wb, name);
    toast.success(tf('exportExcelDone'));
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const rows = parseFixedAssetsImportWorkbook(buf);
      if (!rows.length) {
        toast.error(tf('assetInvalidExcel'));
        return;
      }
      let ok = 0;
      let fail = 0;
      const codeToId = new Map(assets.map((a) => [a.code, a.id]));
      for (const row of rows) {
        const name = row.name?.trim();
        if (!name) {
          fail++;
          continue;
        }
        const rowId = row.id?.trim();
        const existingById = rowId ? assets.find((a) => a.id === rowId) : undefined;
        const code =
          row.code?.trim() ||
          existingById?.code ||
          `AST-${Date.now().toString(36).toUpperCase()}-${ok + fail}`;
        const cost = row.acquisitionCost;
        if (cost == null || !Number.isFinite(cost) || cost < 0) {
          fail++;
          continue;
        }
        const body: Record<string, unknown> = {
          code,
          name,
          category: normalizeCategory(row.category),
          location: row.location?.trim() || undefined,
          acquisitionDate: row.acquisitionDate || format(new Date(), 'yyyy-MM-dd'),
          acquisitionCost: cost,
          usefulLifeYears: row.usefulLifeYears != null && row.usefulLifeYears > 0 ? row.usefulLifeYears : 5,
          salvageValue:
            row.salvageValue != null && Number.isFinite(row.salvageValue) && row.salvageValue >= 0
              ? row.salvageValue
              : 0,
          depreciationMethod: row.depreciationMethod?.trim() || 'LINEAR',
          status: normalizeStatus(row.status),
          notes: row.notes?.trim() || undefined,
        };
        if (row.lastMaintenanceAt) body.lastMaintenanceAt = row.lastMaintenanceAt;
        if (row.nextMaintenanceAt) body.nextMaintenanceAt = row.nextMaintenanceAt;
        if (row.maintenanceNotes) body.maintenanceNotes = row.maintenanceNotes;

        try {
          const id = rowId;
          const byCode = row.code?.trim() ? codeToId.get(row.code.trim()) : undefined;
          if (id && assets.some((a) => a.id === id)) {
            const res = await authFetch(`/api/db/fixedAssets/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(),
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await readApiErrorMessage(res));
          } else if (byCode) {
            const res = await authFetch(`/api/db/fixedAssets/${byCode}`, {
              method: 'PUT',
              headers: getAuthHeaders(),
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await readApiErrorMessage(res));
          } else {
            const res = await authFetch('/api/db/fixedAssets', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await readApiErrorMessage(res));
          }
          ok++;
        } catch (err) {
          console.error(err);
          fail++;
        }
      }
      toast.success(tf('assetImportSummary').replace(':ok', String(ok)).replace(':fail', String(fail)));
      if (fail > 0) toast.error(tf('assetImportErrors'));
      void fetchAssets();
    } catch (err) {
      console.error(err);
      toast.error(tf('assetInvalidExcel'));
    }
  };

  const openEditMaint = (m: FixedAssetMaintenanceRow) => {
    setEditingMaint(m);
    setMaintForm({
      date: toDateInputValue(m.date) || today,
      description: m.description ?? '',
      cost: m.cost,
      nextDueDate: toDateInputValue(m.nextDueDate),
    });
  };

  const saveMaintenance = async () => {
    if (!maintenanceAsset) return;
    const cost = Number(maintForm.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error(t('requiredFieldsMissing') || 'Invalid');
      return;
    }
    const payload: Record<string, unknown> = {
      fixedAssetId: maintenanceAsset.id,
      date: maintForm.date,
      description: maintForm.description.trim(),
      cost,
      nextDueDate: maintForm.nextDueDate.trim() || null,
    };
    try {
      if (editingMaint) {
        const res = await authFetch(`/api/db/fixedAssetMaintenances/${editingMaint.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
      } else {
        const res = await authFetch('/api/db/fixedAssetMaintenances', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
      }
      toast.success(tf('assetSaved'));
      setEditingMaint(null);
      setMaintForm({
        date: today,
        description: '',
        cost: '',
        nextDueDate: defaultNextDue,
      });
      await loadMaintenances(maintenanceAsset);
      await syncAssetMaintenanceSnapshot(maintenanceAsset.id);
    } catch (e) {
      console.error(e);
      toast.error(t('errorAddingCategory') || 'Error');
    }
  };

  const deleteMaintenance = async (m: FixedAssetMaintenanceRow) => {
    if (!maintenanceAsset || !confirm(t('confirmDelete'))) return;
    try {
      const res = await authFetch(`/api/db/fixedAssetMaintenances/${m.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      toast.success(tf('assetDeleted'));
      await loadMaintenances(maintenanceAsset);
      await syncAssetMaintenanceSnapshot(maintenanceAsset.id);
    } catch (e) {
      console.error(e);
      toast.error(t('purchaseSaveFailed') || 'Error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
        <div className={clsx('relative flex-1 max-w-md', isRTL && 'ms-auto')}>
          <Search className={clsx('absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400', isRTL ? 'right-3' : 'left-3')} />
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportXlsx}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            <Download className="w-5 h-5" />
            {tf('assetExportXlsx')}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            <Upload className="w-5 h-5" />
            {tf('assetImportXlsx')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(ev) => void onImportFile(ev)}
          />
          <button
            type="button"
            onClick={openNewAsset}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
          >
            <Plus className="w-5 h-5" />
            {tf('assetAdd')}
          </button>
        </div>
      </div>

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
                        <td className="px-4 py-3 text-xs font-bold">{statusTf(a.status)}</td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            onClick={() => void loadMaintenances(a)}
                            className="p-2 text-slate-400 hover:text-amber-600 inline-flex"
                            aria-label={tf('assetMaintenanceLog')}
                          >
                            <span title={tf('assetMaintenanceLog')} aria-hidden="true">
                              <Wrench className="w-4 h-4" />
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAsset(a)}
                            className="p-2 text-slate-400 hover:text-primary-600 inline-flex"
                            aria-label={tf('assetEdit')}
                          >
                            <span title={tf('assetEdit')} aria-hidden="true">
                              <Pencil className="w-4 h-4" />
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteAsset(a)}
                            className="p-2 text-slate-400 hover:text-rose-600 inline-flex"
                            aria-label={t('delete')}
                          >
                            <span title={t('delete')} aria-hidden="true">
                              <Trash2 className="w-4 h-4" />
                            </span>
                          </button>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetName')} *</label>
                  <input required className="input w-full" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetCode')}</label>
                  <input className="input w-full" placeholder="AST-..." value={assetForm.code} onChange={(e) => setAssetForm((f) => ({ ...f, code: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetCategory')}</label>
                <select className="input w-full" value={assetForm.category} onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))}>
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryTf(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetLocation')}</label>
                <input className="input w-full" value={assetForm.location} onChange={(e) => setAssetForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetAcquisitionDate')}</label>
                  <input className="input w-full" type="date" value={assetForm.acquisitionDate} onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetAcquisitionCost')} *</label>
                  <input required className="input w-full" type="number" min={0} value={assetForm.acquisitionCost} onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionCost: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetUsefulLifeYears')} *</label>
                  <input required className="input w-full" type="number" min={1} value={assetForm.usefulLifeYears} onChange={(e) => setAssetForm((f) => ({ ...f, usefulLifeYears: Number(e.target.value) || 5 }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetSalvageValue')}</label>
                  <input className="input w-full" type="number" min={0} value={assetForm.salvageValue} onChange={(e) => setAssetForm((f) => ({ ...f, salvageValue: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetDepreciationMethod')}</label>
                <select className="input w-full" value={assetForm.depreciationMethod} onChange={(e) => setAssetForm((f) => ({ ...f, depreciationMethod: e.target.value }))}>
                  <option value="LINEAR">LINEAR</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetNotes')}</label>
                <textarea className="input w-full min-h-[72px]" value={assetForm.notes} onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{tf('assetStatus')} *</label>
                <select required className="input w-full" value={assetForm.status} onChange={(e) => setAssetForm((f) => ({ ...f, status: e.target.value }))}>
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusTf(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setAssetModalOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn-primary" onClick={() => void saveAsset()}>
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {maintenanceAsset && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/10 shrink-0">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                {tf('assetMaintenanceLog')} — {maintenanceAsset.code}
              </h3>
              <button
                type="button"
                onClick={() => setMaintenanceAsset(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="rounded-xl border border-slate-100 dark:border-white/10 p-3 bg-slate-50/80 dark:bg-zinc-800/40 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">{editingMaint ? tf('assetEdit') : tf('assetMaintenanceAdd')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">{tf('assetMaintenanceDate')}</label>
                    <input
                      type="date"
                      className="input w-full mt-0.5"
                      value={maintForm.date || today}
                      onFocus={() => {
                        if (!maintForm.date) setMaintForm((f) => ({ ...f, date: today }));
                      }}
                      onChange={(e) => setMaintForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">{tf('assetMaintenanceCost')}</label>
                    <input type="number" min={0} className="input w-full mt-0.5" value={maintForm.cost} onChange={(e) => setMaintForm((f) => ({ ...f, cost: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">{tf('assetMaintenanceDescription')}</label>
                  <textarea className="input w-full mt-0.5 min-h-[56px]" value={maintForm.description} onChange={(e) => setMaintForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">{tf('assetMaintenanceNextDue')}</label>
                  <input type="date" className="input w-full mt-0.5" value={maintForm.nextDueDate} onChange={(e) => setMaintForm((f) => ({ ...f, nextDueDate: e.target.value }))} />
                </div>
                <div className="flex gap-2 justify-end">
                  {editingMaint && (
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => {
                        setEditingMaint(null);
                        setMaintForm({
                          date: today,
                          description: '',
                          cost: '',
                          nextDueDate: defaultNextDue,
                        });
                      }}
                    >
                      {t('cancel')}
                    </button>
                  )}
                  <button type="button" className="btn-primary text-sm" onClick={() => void saveMaintenance()}>
                    {t('save')}
                  </button>
                </div>
              </div>

              {maintenancesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : maintenances.length === 0 ? (
                <p className="text-center text-slate-500 py-6">{tf('assetMaintenanceEmpty')}</p>
              ) : (
                <ul className="space-y-2">
                  {maintenances.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{formatApiDate(m.date)}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{m.description || '—'}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {tf('assetMaintenanceCost')}: {formatCurrency(m.cost)}
                          {m.nextDueDate ? ` · ${tf('assetMaintenanceNextDue')}: ${formatApiDate(m.nextDueDate)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <button
                          type="button"
                          className="p-2 text-slate-400 hover:text-primary-600"
                          onClick={() => openEditMaint(m)}
                          aria-label={tf('assetEdit')}
                        >
                          <span title={tf('assetEdit')} aria-hidden="true">
                            <Pencil className="w-4 h-4" />
                          </span>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-slate-400 hover:text-rose-600"
                          onClick={() => void deleteMaintenance(m)}
                          aria-label={t('delete')}
                        >
                          <span title={t('delete')} aria-hidden="true">
                            <Trash2 className="w-4 h-4" />
                          </span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManagement;
