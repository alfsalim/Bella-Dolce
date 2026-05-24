import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';

type UtilityRow = {
  id: string;
  type: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
};

type ConsumptionTrendsProps = {
  utilities: UtilityRow[];
};

const COLORS = {
  ELECTRICITY: '#3b82f6',
  WATER: '#06b6d4',
  GAS: '#f59e0b',
  INTERNET: '#8b5cf6',
  PHONE: '#ec4899',
  OTHER: '#6b7280'
};

const ConsumptionTrends: React.FC<ConsumptionTrendsProps> = ({ utilities }) => {
  const { formatCurrency, tf } = useLanguage();
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: monthNames[i],
      monthNum: i,
      [currentYear]: 0,
      [lastYear]: 0
    }));

    utilities.forEach(u => {
      const date = new Date(u.periodStart);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (months[month]) {
        const key = String(year);
        if (key === String(currentYear) || key === String(lastYear)) {
          months[month][key as keyof (typeof months[0])] += u.amount;
        }
      }
    });

    return months;
  }, [utilities, currentYear, lastYear]);

  const yearlyData = useMemo(() => {
    const years = new Map<number, number>();

    utilities.forEach(u => {
      const date = new Date(u.periodStart);
      const year = date.getFullYear();
      years.set(year, (years.get(year) ?? 0) + u.amount);
    });

    return Array.from(years.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, amount]) => ({
        year: String(year),
        amount
      }));
  }, [utilities]);

  const consumptionByType = useMemo(() => {
    const map = new Map<string, number>();

    utilities.forEach(u => {
      const date = new Date(u.periodStart);
      const year = date.getFullYear();

      if (year === currentYear) {
        const type = u.type || 'OTHER';
        map.set(type, (map.get(type) ?? 0) + u.amount);
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, amount]) => ({
        name: type,
        value: amount,
        fill: COLORS[type as keyof typeof COLORS] || COLORS.OTHER
      }));
  }, [utilities, currentYear]);

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

  const totalCurrentYear = monthlyData.reduce((sum, m) => sum + m[currentYear], 0);
  const totalLastYear = monthlyData.reduce((sum, m) => sum + m[lastYear], 0);
  const yearOverYearChange = totalLastYear > 0 ? ((totalCurrentYear - totalLastYear) / totalLastYear * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('monthly')}
          className={clsx(
            "px-4 py-2 rounded-lg font-bold text-sm transition-colors",
            viewMode === 'monthly'
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'
          )}
        >
          {tf('monthlyView')}
        </button>
        <button
          onClick={() => setViewMode('yearly')}
          className={clsx(
            "px-4 py-2 rounded-lg font-bold text-sm transition-colors",
            viewMode === 'yearly'
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'
          )}
        >
          {tf('yearlyView')}
        </button>
      </div>

      {viewMode === 'monthly' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('currentYear')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(totalCurrentYear)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('lastYear')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(totalLastYear)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10">
              <p className="text-sm text-slate-500 dark:text-slate-400">YoY Change</p>
              <p className={clsx(
                "text-2xl font-bold mt-1",
                parseFloat(yearOverYearChange) >= 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              )}>
                {parseFloat(yearOverYearChange) >= 0 ? '+' : ''}{yearOverYearChange}%
              </p>
            </div>
          </div>

          {/* Monthly Line Chart - Combined */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {tf('monthlyView')} {tf('consumptionTrends')}
              </h3>
              <div className="flex items-center gap-4 text-xs font-medium">
                {totalLastYear > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-slate-500 dark:text-slate-400">{lastYear}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-primary-500" />
                  <span className="text-slate-500 dark:text-slate-400">{currentYear}</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                {totalLastYear > 0 && (
                  <Line
                    type="monotone"
                    dataKey={lastYear}
                    stroke="#9ca3af"
                    strokeWidth={3}
                    dot={false}
                    name={String(lastYear)}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={currentYear}
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={false}
                  name={String(currentYear)}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {viewMode === 'yearly' && yearlyData.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">
            {tf('year')} {tf('consumptionTrends')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                formatter={(value) => formatCurrency(value as number)}
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f1f5f9'
                }}
              />
              <Bar dataKey="amount" fill="#3b82f6" name={tf('amount')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Consumption by Type */}
      {consumptionByType.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">
              {tf('consumptionByType')} ({currentYear})
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={consumptionByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${typeLabel(name)}: ${formatCurrency(value)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {consumptionByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">
              {tf('consumptionByType')} {tf('breakdown')}
            </h3>
            <div className="space-y-3">
              {consumptionByType.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      {typeLabel(item.name)}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between py-4 mt-4 pt-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800/50 px-4">
                <span className="font-bold text-slate-900 dark:text-white">{tf('total')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(consumptionByType.reduce((sum, item) => sum + item.value, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {utilities.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-2xl border border-slate-100 dark:border-white/10 text-center">
          <p className="text-slate-500 dark:text-slate-400">{tf('noDataAvailable')}</p>
        </div>
      )}
    </div>
  );
};

export default ConsumptionTrends;
