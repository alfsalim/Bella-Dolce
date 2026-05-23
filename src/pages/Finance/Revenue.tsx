import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  Download,
  TrendingUp,
  CheckCircle2,
  Store,
  ArrowRightLeft,
  LayoutGrid,
  LayoutList,
  X,
  Eye,
  Calendar,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { PAGE_SIZE } from '../../constants';
import Pagination from '../../components/Pagination';
import { toast } from 'react-hot-toast';
import { authFetch } from '../../lib/api-client';
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { Sale } from '../../types';

type PeriodFilter = 'day' | 'week' | 'month' | 'year';

type PosDaySummary = {
  date: string;
  totalSales: number;
  cashAmount: number;
  cardAmount: number;
  mobileAmount: number;
  transactionCount: number;
};

function getPeriodRange(period: PeriodFilter): { from: string; to: string } {
  const now = new Date();
  const to = format(now, 'yyyy-MM-dd');
  let from: string;
  switch (period) {
    case 'day':
      from = format(startOfDay(now), 'yyyy-MM-dd');
      break;
    case 'week':
      from = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      break;
    case 'month':
      from = format(startOfMonth(now), 'yyyy-MM-dd');
      break;
    case 'year':
      from = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd');
      break;
  }
  return { from, to };
}

function groupSalesByDay(sales: Sale[]): PosDaySummary[] {
  const map = new Map<string, PosDaySummary>();
  for (const sale of sales) {
    const date = format(new Date(sale.createdAt), 'yyyy-MM-dd');
    const cur = map.get(date) ?? {
      date,
      totalSales: 0,
      cashAmount: 0,
      cardAmount: 0,
      mobileAmount: 0,
      transactionCount: 0,
    };
    cur.totalSales += sale.totalAmount;
    cur.transactionCount += 1;
    if (sale.paymentMethod === 'cash') cur.cashAmount += sale.totalAmount;
    else if (sale.paymentMethod === 'card') cur.cardAmount += sale.totalAmount;
    else cur.mobileAmount += sale.totalAmount;
    map.set(date, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

const Revenue: React.FC = () => {
  const { formatCurrency, isRTL, tf, t, language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    return (localStorage.getItem('revenuePosViewMode') as 'card' | 'list') || 'card';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [detailRow, setDetailRow] = useState<PosDaySummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);

  const { from, to } = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    return getPeriodRange(period);
  }, [period, customFrom, customTo]);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('bakery_token');
        const params = new URLSearchParams({ from, to });
        const res = await authFetch(`/api/sales?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to fetch sales');
        const data = await res.json();
        setSales(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching revenue sales:', err);
        toast.error(t('errorGeneric') || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [from, to]);

  const summaries = useMemo(() => groupSalesByDay(sales), [sales]);

  const persistViewMode = (mode: 'card' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('revenuePosViewMode', mode);
  };

  const formatDayLabel = (isoDate: string) => {
    try {
      return format(new Date(isoDate + 'T12:00:00'), 'dd/MM/yyyy');
    } catch {
      return isoDate;
    }
  };

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (row) =>
        row.date.toLowerCase().includes(q) ||
        formatDayLabel(row.date).toLowerCase().includes(q) ||
        String(row.transactionCount).includes(q)
    );
  }, [summaries, searchQuery, language]);

  const totalPages = Math.max(1, Math.ceil(filteredSummaries.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSummaries = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredSummaries.slice(start, start + PAGE_SIZE);
  }, [filteredSummaries, safePage]);

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const exportPosSalesCsv = () => {
    const sep = ';';
    const header = [
      tf('revenuePosDetailDate'),
      tf('revenueOperationsColumn'),
      tf('revenueTotalSalesLabel'),
      tf('revenueCashLabel'),
      tf('revenueCardLabel'),
      tf('mobile'),
    ];
    const lines = [header.join(sep)];
    for (const r of filteredSummaries) {
      lines.push(
        [
          formatDayLabel(r.date),
          String(r.transactionCount),
          String(r.totalSales),
          String(r.cashAmount),
          String(r.cardAmount),
          String(r.mobileAmount),
        ].join(sep)
      );
    }
    const BOM = '﻿';
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(tf('exportExcelDone'));
  };

  const periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: 'day', label: t('day') },
    { value: 'week', label: t('week') },
    { value: 'month', label: t('month') },
    { value: 'year', label: t('year') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveSubTab('pos')}
          className={clsx(
            'pb-3 text-sm font-bold transition-all relative',
            activeSubTab === 'pos'
              ? 'text-primary-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <BilingualLabel tKey="posSales" tf />
          {activeSubTab === 'pos' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('b2b')}
          className={clsx(
            'pb-3 text-sm font-bold transition-all relative',
            activeSubTab === 'b2b'
              ? 'text-primary-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <BilingualLabel tKey="customerInvoices" tf />
          {activeSubTab === 'b2b' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'pos' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            {/* Period presets */}
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-white/10 gap-1">
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPeriod(opt.value);
                    setCustomFrom('');
                    setCustomTo('');
                    setCurrentPage(1);
                  }}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    period === opt.value && !customFrom
                      ? 'bg-white dark:bg-zinc-900 text-primary-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom date range */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none text-xs font-bold focus:ring-0 text-slate-900 dark:text-white w-32"
              />
              <span className="text-slate-400 text-xs">—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none text-xs font-bold focus:ring-0 text-slate-900 dark:text-white w-32"
              />
            </div>

            {/* Search */}
            <div className={clsx('relative flex-1 max-w-xs', isRTL && 'ms-auto')}>
              <Search
                className={clsx(
                  'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400',
                  isRTL ? 'right-3' : 'left-3'
                )}
              />
              <input
                type="text"
                placeholder={tf('searchDailySales')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className={clsx(
                  'w-full py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm',
                  isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                )}
              />
            </div>

            <div className="flex items-center gap-2 ms-auto">
              <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => persistViewMode('card')}
                  title={t('cardView')}
                  className={clsx(
                    'p-2 rounded-lg transition-all',
                    viewMode === 'card'
                      ? 'bg-white dark:bg-zinc-900 shadow-sm text-primary-600'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  )}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => persistViewMode('list')}
                  title={t('listView')}
                  className={clsx(
                    'p-2 rounded-lg transition-all',
                    viewMode === 'list'
                      ? 'bg-white dark:bg-zinc-900 shadow-sm text-primary-600'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  )}
                >
                  <LayoutList className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={exportPosSalesCsv}
                className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
                title={tf('exportExcel')}
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 font-medium">{t('loading')}</div>
          ) : filteredSummaries.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-medium">{t('noSalesFound')}</div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedSummaries.map((pos) => (
                <div
                  key={pos.date}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600 shrink-0">
                        <Store className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">
                          {formatDayLabel(pos.date)}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {tf('revenueTransactionCount').replace('{{count}}', String(pos.transactionCount))}
                        </p>
                      </div>
                    </div>
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-3 py-4 border-y border-slate-50 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">{tf('revenueTotalSalesLabel')}</span>
                      <span className="font-bold text-slate-900 dark:text-white text-end">{formatCurrency(pos.totalSales)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">{tf('revenueCashLabel')}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-end">{formatCurrency(pos.cashAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">{tf('revenueCardLabel')}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-end">{formatCurrency(pos.cardAmount)}</span>
                    </div>
                    {pos.mobileAmount > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{t('mobile')}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-end">{formatCurrency(pos.mobileAmount)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest truncate">
                      {tf('revenueStatusPosted')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailRow(pos)}
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1 shrink-0"
                    >
                      {tf('revenueViewDetails')}
                      <ArrowRightLeft className="w-3 h-3 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{tf('revenuePosDetailDate')}</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{tf('revenueOperationsColumn')}</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-end">{tf('revenueTotalSalesLabel')}</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-end">{tf('revenueCashLabel')}</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-end">{tf('revenueCardLabel')}</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-end">{t('mobile')}</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-end">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {paginatedSummaries.map((pos) => (
                      <tr key={pos.date} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="p-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatDayLabel(pos.date)}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{pos.transactionCount}</td>
                        <td className="p-4 font-mono text-end font-bold text-slate-900 dark:text-white">{formatCurrency(pos.totalSales)}</td>
                        <td className="p-4 font-mono text-end text-slate-600 dark:text-slate-300">{formatCurrency(pos.cashAmount)}</td>
                        <td className="p-4 font-mono text-end text-slate-600 dark:text-slate-300">{formatCurrency(pos.cardAmount)}</td>
                        <td className="p-4 font-mono text-end text-slate-600 dark:text-slate-300">{formatCurrency(pos.mobileAmount)}</td>
                        <td className="p-4 text-end">
                          <button
                            type="button"
                            onClick={() => setDetailRow(pos)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {tf('revenueViewDetails')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && filteredSummaries.length > 0 && (
            <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      {activeSubTab === 'b2b' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <TrendingUp className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium text-center px-4">{tf('revenueB2bModuleSoon')}</p>
          <p className="text-sm text-center px-4 mt-1 max-w-md">{tf('revenueB2bCreditBlurb')}</p>
        </div>
      )}

      {detailRow && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revenue-pos-detail-title"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="revenue-pos-detail-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  {tf('revenuePosDetailTitle')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{formatDayLabel(detailRow.date)}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{tf('revenueOperationsColumn')}</dt>
                <dd className="font-bold text-slate-900 dark:text-white">{detailRow.transactionCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{tf('revenueTotalSalesLabel')}</dt>
                <dd className="font-bold text-slate-900 dark:text-white">{formatCurrency(detailRow.totalSales)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{tf('revenueCashLabel')}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(detailRow.cashAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{tf('revenueCardLabel')}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(detailRow.cardAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t('mobile')}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(detailRow.mobileAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{tf('status')}</dt>
                <dd className="font-bold text-emerald-600">{tf('revenueStatusPosted')}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => setDetailRow(null)} className="w-full btn-secondary py-2.5 font-bold">
              {tf('payrollBack')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Revenue;
