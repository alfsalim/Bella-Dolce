import React, { useState } from 'react';
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
import { format } from 'date-fns';

const TaxReports: React.FC = () => {
  const { formatCurrency, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('tva');

  // Mock data for TVA
  const tvaSummary = {
    collected: 125400,
    deductible: 82400,
    net: 43000
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          onClick={() => setActiveSubTab('tva')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
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
            "pb-3 text-sm font-bold transition-all relative",
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
      </div>

      {activeSubTab === 'tva' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">TVA Collectée (Sales)</p>
              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(tvaSummary.collected)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">TVA Déductible (Purchases)</p>
              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(tvaSummary.deductible)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-primary-100 dark:border-primary-900/20 shadow-sm bg-primary-50/50 dark:bg-primary-900/5">
              <p className="text-sm text-primary-600 dark:text-primary-400 font-bold">TVA à Payer / Crédit</p>
              <p className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400 mt-1">
                {formatCurrency(tvaSummary.net)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">Detailed TVA Breakdown</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all">
                <Printer className="w-4 h-4" />
                Print Report
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">Ventes Soumises à 19%</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(660000)}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">Ventes Soumises à 9%</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(0)}</span>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">Achats Soumis à 19%</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(433684)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'g50' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FileText className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">G50 Automated Generation coming soon</p>
          <p className="text-sm">TAP, IRG, and TVA calculations are being finalized</p>
        </div>
      )}
    </div>
  );
};

export default TaxReports;
