import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calculator,
  Printer,
  Calendar,
  ArrowRightLeft,
  PieChart
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { authFetch, getAuthHeaders } from '../../lib/api-client';

type UtilityRecord = {
  type: string;
  amount: number;
  provider?: string;
};

const TaxReports: React.FC = () => {
  const { formatCurrency, isRTL, tf } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('tva');
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [utilities, setUtilities] = useState<UtilityRecord[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Mock data for TVA
  const tvaSummary = {
    collected: 125400,
    deductible: 82400,
    net: 43000
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [utilRes, salesRes, invoiceRes] = await Promise.all([
          authFetch('/api/db/utilities', { headers: getAuthHeaders() }),
          authFetch('/api/sales', { headers: getAuthHeaders() }),
          authFetch('/api/db/purchases', { headers: getAuthHeaders() }),
        ]);

        const utilData = utilRes.ok ? await utilRes.json() : [];
        const salesData = salesRes.ok ? await salesRes.json() : [];
        const invoiceData = invoiceRes.ok ? await invoiceRes.json() : [];

        setUtilities(Array.isArray(utilData) ? utilData : []);
        setSales(Array.isArray(salesData) ? salesData : []);
        setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      } catch (err) {
        console.error('Error fetching P&L data:', err);
      }
    };

    fetchData();
  }, []);

  const { monthYear, startDate, endDate } = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0);
    return {
      monthYear: format(start, 'MMMM yyyy'),
      startDate: start,
      endDate: end
    };
  }, [selectedMonth]);

  const plMetrics = useMemo(() => {
    const inPeriod = (ts: any) => {
      const d = new Date(ts);
      return d >= startDate && d <= endDate;
    };

    const revenue = sales
      .filter(s => inPeriod(s.createdAt))
      .reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);

    const cogs = invoices
      .filter(i => inPeriod(i.date ?? i.createdAt))
      .reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);

    const utilTotal = utilities
      .filter(u => inPeriod(u.periodStart ?? u.createdAt))
      .reduce((sum, u) => sum + (u.amount ?? 0), 0);

    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      opex: utilTotal,
      operatingProfit: (revenue - cogs) - utilTotal,
    };
  }, [sales, invoices, utilities, startDate, endDate]);

  const utilitiesByType = useMemo(() => {
    const inPeriod = (ts: any) => {
      const d = new Date(ts);
      return d >= startDate && d <= endDate;
    };

    const map = new Map<string, number>();
    utilities
      .filter(u => inPeriod(u.periodStart ?? u.createdAt))
      .forEach(u => {
        const type = u.type ?? 'other';
        map.set(type, (map.get(type) ?? 0) + (u.amount ?? 0));
      });

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [utilities, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('tva')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative whitespace-nowrap",
            activeSubTab === 'tva'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="tvaSummary" tf />
          {activeSubTab === 'tva' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('g50')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative whitespace-nowrap",
            activeSubTab === 'g50'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="g50Report" tf />
          {activeSubTab === 'g50' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('pl')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative whitespace-nowrap",
            activeSubTab === 'pl'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="profitLoss" tf />
          {activeSubTab === 'pl' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'tva' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('tvaCollectedSales')}</p>
              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(tvaSummary.collected)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('tvaDeductiblePurchases')}</p>
              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(tvaSummary.deductible)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-primary-100 dark:border-primary-900/20 shadow-sm bg-primary-50/50 dark:bg-primary-900/5">
              <p className="text-sm text-primary-600 dark:text-primary-400 font-bold">{tf('tvaNetCredit')}</p>
              <p className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400 mt-1">
                {formatCurrency(tvaSummary.net)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">{tf('tvaDetailedBreakdown')}</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all">
                <Printer className="w-4 h-4" />
                {tf('taxPrintReport')}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">{tf('tvaSalesAt19')}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(660000)}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">{tf('tvaSalesAt9')}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(0)}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">{tf('tvaPurchasesAt19')}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(433684)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'g50' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FileText className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">{tf('g50AutomatedSoon')}</p>
          <p className="text-sm">{tf('g50FinalizeNote')}</p>
        </div>
      )}

      {activeSubTab === 'pl' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-bold text-slate-500">{tf('month')}:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input py-1.5 text-sm"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">{monthYear}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('revenue')}</p>
              <p className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(plMetrics.revenue)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('cogs')}</p>
              <p className="text-2xl font-display font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(plMetrics.cogs)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('grossProfit')}</p>
              <p className="text-2xl font-display font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatCurrency(plMetrics.grossProfit)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-6">{tf('profitLoss')}</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{tf('revenue')}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(plMetrics.revenue)}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{tf('cogs')}</span>
                <span className="font-mono font-bold text-red-600 dark:text-red-400">−{formatCurrency(plMetrics.cogs)}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5 bg-blue-50/50 dark:bg-blue-900/10 px-4">
                <span className="text-slate-900 dark:text-white font-bold">{tf('grossProfit')}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(plMetrics.grossProfit)}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{tf('opex')}</span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400">−{formatCurrency(plMetrics.opex)}</span>
              </div>
              <div className="flex items-center justify-between py-4 bg-purple-50/50 dark:bg-purple-900/10 px-4">
                <span className="text-slate-900 dark:text-white font-bold">{tf('operatingProfit')}</span>
                <span className={`font-mono font-bold ${plMetrics.operatingProfit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(plMetrics.operatingProfit)}
                </span>
              </div>
            </div>
          </div>

          {utilitiesByType.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-6">{tf('utilitiesBreakdown')}</h3>

              <div className="space-y-3">
                {utilitiesByType.map(([type, amount]) => (
                  <div key={type} className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-white/5 last:border-0">
                    <span className="text-slate-600 dark:text-slate-400">{type}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between py-4 mt-4 pt-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-zinc-800/50 px-4">
                <span className="font-bold text-slate-900 dark:text-white">{tf('total')}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(plMetrics.opex)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaxReports;
