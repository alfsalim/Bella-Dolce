import React, { useState } from 'react';
import { 
  Calculator, 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Printer,
  Calendar,
  ArrowRightLeft,
  PieChart,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const Budgeting: React.FC = () => {
  const { formatCurrency, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Mock data for Budget
  const budgetItems = [
    { name: 'Matières Premières', budget: 1200000, actual: 1150000, variance: 50000, color: 'emerald' },
    { name: 'Main d\'œuvre', budget: 850000, actual: 865000, variance: -15000, color: 'rose' },
    { name: 'Énergie & Eau', budget: 120000, actual: 145000, variance: -25000, color: 'rose' },
    { name: 'Marketing & Pub', budget: 50000, actual: 42000, variance: 8000, color: 'emerald' },
    { name: 'Maintenance', budget: 80000, actual: 75000, variance: 5000, color: 'emerald' }
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
          <BilingualLabel tKey="budgetOverview" tf />
          {activeSubTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('planning')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'planning'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="budgetPlanning" tf />
          {activeSubTab === 'planning' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">Budget vs Actual (March 2026)</h3>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20">
                <Plus className="w-5 h-5" />
                <BilingualLabel tKey="newBudget" tf />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {budgetItems.map((item) => {
              const percentage = (item.actual / item.budget) * 100;
              return (
                <div 
                  key={item.name}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{item.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Monthly Allocation</p>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Budgeted</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.budget)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actual</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.actual)}</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Variance</p>
                        <p className={clsx(
                          "font-bold",
                          item.variance >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Utilization</span>
                      <span className={clsx(
                        "font-bold",
                        percentage > 100 ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          "h-full transition-all duration-1000",
                          percentage > 100 ? "bg-rose-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'planning' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Calculator className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">Budget Planning Module coming soon</p>
          <p className="text-sm">Scenario analysis and forecasting engine is active</p>
        </div>
      )}
    </div>
  );
};

export default Budgeting;
