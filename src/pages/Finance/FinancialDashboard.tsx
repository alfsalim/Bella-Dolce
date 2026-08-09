import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  ShieldCheck,
  Zap,
  DollarSign
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { authFetch, getAuthHeaders } from '../../lib/api-client';
import { calculateProfitability, ProfitabilityMetrics } from '../../lib/profitabilityEngine';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Period = 'day' | 'month' | 'year';

const FinancialDashboard: React.FC = () => {
  const { formatCurrency, tf } = useLanguage();
  const [period, setPeriod] = useState<Period>('month');
  const [sales, setSales] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [utilities, setUtilities] = useState<any[]>([]);
  const [profitability, setProfitability] = useState<ProfitabilityMetrics | null>(null);

  const riskScore = 82;

  useEffect(() => {
    authFetch('/api/sales', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setSales(Array.isArray(d) ? d : d.sales ?? []))
      .catch(() => {});

    authFetch('/api/db/purchases', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => {});

    authFetch('/api/db/utilities', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setUtilities(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const chartData = useMemo(() => {
    const now = new Date();

    if (period === 'day') {
      const buckets = Array.from({ length: 24 }, (_, h) => ({
        name: `${String(h).padStart(2, '0')}:00`,
        revenue: 0,
        expenses: 0,
      }));
      const todayStr = now.toDateString();
      sales.forEach(s => {
        const d = new Date(s.createdAt);
        if (d.toDateString() === todayStr)
          buckets[d.getHours()].revenue += s.totalAmount ?? 0;
      });
      invoices.forEach(i => {
        const d = new Date(i.date ?? i.createdAt);
        if (d.toDateString() === todayStr)
          buckets[d.getHours()].expenses += i.totalAmount ?? 0;
      });
      return buckets;
    }

    if (period === 'month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const buckets = Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        revenue: 0,
        expenses: 0,
      }));
      sales.forEach(s => {
        const d = new Date(s.createdAt);
        if (d.getFullYear() === year && d.getMonth() === month)
          buckets[d.getDate() - 1].revenue += s.totalAmount ?? 0;
      });
      invoices.forEach(i => {
        const d = new Date(i.date ?? i.createdAt);
        if (d.getFullYear() === year && d.getMonth() === month)
          buckets[d.getDate() - 1].expenses += i.totalAmount ?? 0;
      });
      return buckets;
    }

    // year
    const year = now.getFullYear();
    const monthNames = tf('monthNames') as unknown as string[] || ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const buckets = monthNames.map(name => ({ name, revenue: 0, expenses: 0 }));
    sales.forEach(s => {
      const d = new Date(s.createdAt);
      if (d.getFullYear() === year)
        buckets[d.getMonth()].revenue += s.totalAmount ?? 0;
    });
    invoices.forEach(i => {
      const d = new Date(i.date ?? i.createdAt);
      if (d.getFullYear() === year)
        buckets[d.getMonth()].expenses += i.totalAmount ?? 0;
    });
    return buckets;
  }, [sales, invoices, period]);

  const { totalRevenue, totalExpenses } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const inPeriod = (ts: any) => {
      const d = new Date(ts);
      if (period === 'day') return d.toDateString() === now.toDateString();
      if (period === 'month') return d.getFullYear() === year && d.getMonth() === month;
      return d.getFullYear() === year;
    };

    const rev = sales
      .filter(s => inPeriod(s.createdAt))
      .reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
    const exp = invoices
      .filter(i => inPeriod(i.date ?? i.createdAt))
      .reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);

    return { totalRevenue: rev, totalExpenses: exp };
  }, [sales, invoices, period]);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let startDate: Date, endDate: Date;
    if (period === 'day') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    let cancelled = false;
    calculateProfitability(sales, invoices, utilities, { startDate, endDate }).then((metrics) => {
      if (!cancelled) setProfitability(metrics);
    });
    return () => { cancelled = true; };
  }, [sales, invoices, utilities, period]);

  const periodButtons: { key: Period; label: string }[] = [
    { key: 'day',   label: tf('day')   || 'Jour' },
    { key: 'month', label: tf('month') || 'Mois' },
    { key: 'year',  label: tf('year')  || 'Année' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              {tf('revenue')}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="revenue" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(profitability?.revenue ?? 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" />
              {tf('cogs')}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="cogs" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(profitability?.cogs ?? 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              {tf('financialStatusHealthy')}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="grossProfit" tf />
          </p>
          <p className={`text-2xl font-display font-bold mt-1 ${(profitability?.grossProfit ?? 0) >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(profitability?.grossProfit ?? 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              EBIT
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="operatingProfit" tf />
          </p>
          <p className={`text-2xl font-display font-bold mt-1 ${(profitability?.operatingProfit ?? 0) >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(profitability?.operatingProfit ?? 0)}
          </p>
        </div>
      </div>

      {/* Secondary Stats - OpEx Breakdown and Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm group relative"
          title={tf('utilitiesTrackedSeparately') || 'Utilities are tracked separately under Finance > Utilities'}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full">
              OpEx
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="opex" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(profitability?.opex ?? 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {tf('utilitiesCosts')}: {formatCurrency(profitability?.utilities ?? 0)}
          </p>
          {/* Tooltip */}
          <div className="absolute left-0 right-0 bottom-full mb-2 hidden group-hover:block bg-slate-900 dark:bg-slate-700 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-10 pointer-events-none">
            {tf('utilitiesTrackedSeparately') || 'Utilities are tracked separately under Finance > Utilities'}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
              {tf('riskScoreLabel')}: {riskScore}{tf('riskScoreOutOf')}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="riskScore" tf />
          </p>
          <div className="mt-2 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-1000"
              style={{ width: `${riskScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
              <BilingualLabel tKey="revenueVsExpenses" tf />
            </h3>
            <div className="flex items-center gap-2">
              {periodButtons.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setPeriod(btn.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    period === btn.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
              <div className="flex items-center gap-3 text-xs font-medium ml-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400">{tf('revenue')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-slate-500 dark:text-slate-400">{tf('expenses')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="h-[300px] min-h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  interval={period === 'month' ? 4 : period === 'day' ? 3 : 0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => [formatCurrency(value)]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-6">
            <BilingualLabel tKey="cashPosition" tf />
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg text-primary-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tf('financePosCashLabel')}</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(24500)}</p>
                </div>
              </div>
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg text-indigo-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tf('financeBankLabel')}</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(1250000)}</p>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">{tf('financeTotalCashAvailable')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(1274500)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">{tf('financeBurnRateDaily')}</span>
                <span className="font-bold text-rose-600">{formatCurrency(12400)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
