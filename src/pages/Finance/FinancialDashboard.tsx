import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
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
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const FinancialDashboard: React.FC = () => {
  const { formatCurrency } = useLanguage();

  // Mock data for the dashboard
  const pnlData = [
    { name: '08:00', revenue: 4500, expenses: 3200 },
    { name: '10:00', revenue: 12000, expenses: 4500 },
    { name: '12:00', revenue: 18000, expenses: 6000 },
    { name: '14:00', revenue: 15000, expenses: 5500 },
    { name: '16:00', revenue: 22000, expenses: 7000 },
    { name: '18:00', revenue: 28000, expenses: 8500 },
    { name: '20:00', revenue: 15000, expenses: 6000 },
  ];

  const riskScore = 82; // Out of 100

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
              +12.5%
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="revenue" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(145200)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-full flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" />
              -2.4%
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="expenses" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(82400)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-full">
              Healthy
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="netProfit" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(62800)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
              Score: {riskScore}/100
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
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary-500" />
                <span className="text-slate-500 dark:text-slate-400">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-slate-500 dark:text-slate-400">Expenses</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pnlData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Caisse POS</p>
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Banque (BNA)</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(1250000)}</p>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Total Cash Available</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(1274500)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Burn Rate (Daily)</span>
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
