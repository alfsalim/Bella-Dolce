import React, { useState } from 'react';
import { 
  ShieldAlert, 
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
  PieChart,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const RiskEngine: React.FC = () => {
  const { formatCurrency, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Mock data for Risk
  const riskMetrics = [
    { name: 'Liquidity Risk', score: 85, status: 'Low', color: 'emerald' },
    { name: 'Credit Risk (B2B)', score: 62, status: 'Moderate', color: 'amber' },
    { name: 'Operational Risk', score: 92, status: 'Very Low', color: 'emerald' },
    { name: 'Tax Compliance Risk', score: 78, status: 'Low', color: 'emerald' },
    { name: 'Inventory Shrinkage', score: 45, status: 'High', color: 'rose' }
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'overview'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="riskOverview" tf />
          {activeSubTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('alerts')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'alerts'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="riskAlerts" tf />
          {activeSubTab === 'alerts' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">Composite Risk Score</h3>
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-full text-primary-600">
                  <ShieldCheck className="w-8 h-8" />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-10">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-slate-100 dark:text-zinc-800"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      strokeDasharray={552.92}
                      strokeDashoffset={552.92 * (1 - 0.82)}
                      strokeLinecap="round"
                      className="text-primary-600 transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-display font-bold text-slate-900 dark:text-white">82</span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Healthy</span>
                  </div>
                </div>
                <p className="mt-8 text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
                  Your financial health is strong. Inventory shrinkage is the primary concern this period.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-8">Risk Breakdown</h3>
              <div className="space-y-6">
                {riskMetrics.map((metric) => (
                  <div key={metric.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{metric.name}</span>
                      <span className={clsx(
                        "font-bold",
                        metric.color === 'emerald' ? "text-emerald-600" :
                        metric.color === 'amber' ? "text-amber-600" :
                        "text-rose-600"
                      )}>
                        {metric.status} ({metric.score}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          "h-full transition-all duration-1000",
                          metric.color === 'emerald' ? "bg-emerald-500" :
                          metric.color === 'amber' ? "bg-amber-500" :
                          "bg-rose-500"
                        )}
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/20 flex items-start gap-4">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/20 rounded-lg text-rose-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-rose-900 dark:text-rose-400">Critical Alert: Inventory Shrinkage</h4>
              <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                Detected a 12% discrepancy between production output and POS sales for 'Baguette Traditionnelle' over the last 48 hours.
              </p>
              <button className="mt-3 text-xs font-bold text-rose-900 dark:text-rose-400 underline underline-offset-4">
                Investigate Discrepancy
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'alerts' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">Real-time Risk Alerts coming soon</p>
          <p className="text-sm">Composite engine is monitoring all transactions</p>
        </div>
      )}
    </div>
  );
};

export default RiskEngine;
