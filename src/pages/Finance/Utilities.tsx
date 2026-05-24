import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Pencil, Trash2, Calendar, TrendingDown, BarChart3 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { PAGE_SIZE } from '../../constants';
import Pagination from '../../components/Pagination';
import { authFetch, getAuthHeaders, parseJsonResponse, readApiErrorMessage } from '../../lib/api-client';
import { toast } from 'react-hot-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import UtilitiesForm from './UtilitiesForm';
import ConsumptionTrends from './ConsumptionTrends';

type UtilityRow = {
  id: string;
  type: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  dueDate?: string | null;
  paidAt?: string | null;
  status: string;
  invoiceNumber?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
};

const UTILITY_TYPES = ['ELECTRICITY', 'WATER', 'GAS', 'INTERNET', 'PHONE', 'OTHER'] as const;

const Utilities: React.FC = () => {
  const { formatCurrency, isRTL, tf, t } = useLanguage();
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState(() => format(new Date(), 'MM'));
  const [filterYear, setFilterYear] = useState(() => format(new Date(), 'yyyy'));
  const [filterStatus, setFilterStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bills' | 'trends'>('bills');

  const fetchUtilities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/db/utilities', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await parseJsonResponse<UtilityRow[]>(res);
      setUtilities(data);
    } catch (e) {
      console.error(e);
      toast.error(tf('purchaseLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tf]);

  useEffect(() => {
    void fetchUtilities();
  }, [fetchUtilities]);

  useEffect(() => {
    setPage(1);
  }, [search, filterType, filterMonth, filterYear, filterStatus]);

  const monthNum = parseInt(filterMonth, 10);
  const yearNum = parseInt(filterYear, 10);

  const filteredUtilities = useMemo(() => {
    let result = utilities;

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((u) =>
        u.provider.toLowerCase().includes(q) ||
        u.invoiceNumber?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((u) => u.type === filterType);
    }

    // Month/Year filter
    result = result.filter((u) => {
      const startDate = new Date(u.periodStart);
      return startDate.getMonth() === monthNum - 1 && startDate.getFullYear() === yearNum;
    });

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter((u) => u.status === filterStatus);
    }

    return result;
  }, [utilities, search, filterType, filterMonth, filterYear, filterStatus, monthNum, yearNum]);

  const monthlyTotal = useMemo(() => {
    return filteredUtilities.reduce((sum, u) => sum + (u.amount || 0), 0);
  }, [filteredUtilities]);

  const totalPages = Math.max(1, Math.ceil(filteredUtilities.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedUtilities = filteredUtilities.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      ELECTRICITY: tf('utilitiesTypeElectricity'),
      WATER: tf('utilitiesTypeWater'),
      GAS: tf('utilitiesTypeGas'),
      INTERNET: tf('utilitiesTypeInternet'),
      PHONE: tf('utilitiesTypePhone'),
      OTHER: tf('utilitiesTypeOther'),
    };
    return map[type] || type;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PAID: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
      PENDING: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
      OVERDUE: 'bg-red-50 dark:bg-red-900/20 text-red-600',
    };
    const labels: Record<string, string> = {
      PAID: tf('utilitiesPaid'),
      PENDING: tf('utilitiesPending'),
      OVERDUE: tf('utilitiesOverdue'),
    };
    return { color: colors[status] || colors.PENDING, label: labels[status] || status };
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(tf('utilitiesDeleteConfirm'))) return;
    try {
      const res = await authFetch(`/api/db/utilities/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      toast.success(tf('utilitiesDeleted'));
      setUtilities((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      console.error(e);
      toast.error(tf('utilitiesDeleteFailed'));
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    void fetchUtilities();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg text-white">
              <TrendingDown className="w-5 h-5" />
            </div>
            <BilingualLabel tKey="utilities" tf />
          </h2>
        </div>
        {activeTab === 'bills' && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <BilingualLabel tKey="utilitiesAdd" tf />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          onClick={() => setActiveTab('bills')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative whitespace-nowrap",
            activeTab === 'bills'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="utilitiesBills" tf />
          {activeTab === 'bills' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative whitespace-nowrap flex items-center gap-2",
            activeTab === 'trends'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <BilingualLabel tKey="consumptionTrends" tf />
          {activeTab === 'trends' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'bills' && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 p-4">
            <p className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 mb-2">
              {tf('utilitiesMonthlyTotal')}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(monthlyTotal)}</p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className={clsx('relative flex-1', isRTL && 'ms-auto')}>
                <Search
                  className={clsx('absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400', isRTL ? 'right-3' : 'left-3')}
                />
                <input
                  type="text"
                  placeholder={tf('utilitiesProvider')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={clsx(
                    'w-full py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm',
                    isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                  )}
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-medium dark:text-white"
              >
                <option value="all">{tf('utilitiesFilterType')}</option>
                {UTILITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>

              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-medium dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  const monthName = new Date(2024, i, 1).toLocaleString('default', { month: 'long' });
                  return (
                    <option key={m} value={m}>
                      {monthName}
                    </option>
                  );
                })}
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-medium dark:text-white"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = String(new Date().getFullYear() - i);
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-medium dark:text-white"
              >
                <option value="all">{tf('utilitiesFilterStatus')}</option>
                <option value="PAID">{tf('utilitiesPaid')}</option>
                <option value="PENDING">{tf('utilitiesPending')}</option>
                <option value="OVERDUE">{tf('utilitiesOverdue')}</option>
              </select>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
              {loading ? (
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
                            <BilingualLabel tKey="utilitiesProvider" tf />
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <BilingualLabel tKey="utilitiesType" tf />
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <BilingualLabel tKey="utilitiesPeriod" tf />
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <BilingualLabel tKey="utilitiesDueDate" tf />
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <BilingualLabel tKey="utilitiesStatus" tf />
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                            <BilingualLabel tKey="utilitiesAmount" tf />
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                            {t('actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                        {paginatedUtilities.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                              {tf('searchNoResults')}
                            </td>
                          </tr>
                        ) : (
                          paginatedUtilities.map((utility) => {
                            const badge = statusBadge(utility.status);
                            const periodEnd = new Date(utility.periodEnd);
                            return (
                              <tr key={utility.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-slate-500">
                                      <Calendar className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white">{utility.provider}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{typeLabel(utility.type)}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                  {format(new Date(utility.periodStart), 'dd/MM')} -{' '}
                                  {format(new Date(utility.periodEnd), 'dd/MM/yy')}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                  {utility.dueDate ? format(new Date(utility.dueDate), 'dd/MM/yy') : '—'}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={clsx('text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest', badge.color)}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                  {formatCurrency(utility.amount)}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                                  <button
                                    onClick={() => {
                                      setEditingId(utility.id);
                                      setFormOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(utility.id)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
                </>
              )}
            </div>

            {formOpen && <UtilitiesForm utilityId={editingId} onClose={handleFormClose} onSuccess={handleFormSuccess} />}
          </div>
        </>
      )}

      {activeTab === 'trends' && <ConsumptionTrends utilities={utilities} />}
    </div>
  );
};

export default Utilities;
