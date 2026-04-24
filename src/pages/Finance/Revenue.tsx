import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Store,
  DollarSign,
  Calendar,
  ArrowRightLeft
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const Revenue: React.FC = () => {
  const { formatCurrency, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('pos');

  // Mock data for POS summaries
  const posSummaries = [
    {
      id: 'pos-1',
      date: '2026-03-25',
      totalSales: 145200,
      cashAmount: 125000,
      cardAmount: 20200,
      status: 'COMPTABILISÉ',
      transactionCount: 142
    },
    {
      id: 'pos-2',
      date: '2026-03-24',
      totalSales: 138500,
      cashAmount: 115000,
      cardAmount: 23500,
      status: 'COMPTABILISÉ',
      transactionCount: 128
    }
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          onClick={() => setActiveSubTab('pos')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'pos'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="posSales" tf />
          {activeSubTab === 'pos' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('b2b')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'b2b'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search daily sales..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posSummaries.map((pos) => (
              <div 
                key={pos.id}
                className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{pos.date}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{pos.transactionCount} Transactions</p>
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-3 py-4 border-y border-slate-50 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Total Sales</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(pos.totalSales)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Cash</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(pos.cashAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Card</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(pos.cardAmount)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                    {pos.status}
                  </span>
                  <button className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1">
                    View Details
                    <ArrowRightLeft className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'b2b' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <TrendingUp className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">B2B Customer Invoices Module coming soon</p>
          <p className="text-sm">Real-time credit limit monitoring is active</p>
        </div>
      )}
    </div>
  );
};

export default Revenue;
