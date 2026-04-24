import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Receipt, 
  TrendingUp, 
  ShieldAlert, 
  PieChart, 
  Wallet,
  FileText,
  Calculator
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { clsx } from 'clsx';
import FinancialDashboard from './FinancialDashboard';
import GeneralLedger from './GeneralLedger';
import Payroll from './Payroll';
import Expenses from './Expenses';
import Revenue from './Revenue';
import TaxReports from './TaxReports';
import RiskEngine from './RiskEngine';
import Budgeting from './Budgeting';
import BilingualLabel from '../../components/BilingualLabel';

const Finance: React.FC = () => {
  const { tf, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'dashboard' },
    { id: 'gl', icon: BookOpen, label: 'generalLedger' },
    { id: 'payroll', icon: Users, label: 'payroll' },
    { id: 'expenses', icon: Receipt, label: 'expenses' },
    { icon: TrendingUp, id: 'revenue', label: 'revenue' },
    { icon: FileText, id: 'tax', label: 'taxReports' },
    { icon: ShieldAlert, id: 'risk', label: 'riskEngine' },
    { icon: Calculator, id: 'budget', label: 'budgeting' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg text-white">
              <Wallet className="w-6 h-6" />
            </div>
            <BilingualLabel tKey="finance" tf />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Bakery Financial Module — Algeria Edition (BFM-DZ v1.0)
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-100 dark:border-white/10 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <BilingualLabel tKey={tab.label} tf />
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'dashboard' && <FinancialDashboard />}
        {activeTab === 'gl' && <GeneralLedger />}
        {activeTab === 'payroll' && <Payroll />}
        {activeTab === 'expenses' && <Expenses />}
        {activeTab === 'revenue' && <Revenue />}
        {activeTab === 'tax' && <TaxReports />}
        {activeTab === 'risk' && <RiskEngine />}
        {activeTab === 'budget' && <Budgeting />}
      </div>
    </div>
  );
};

export default Finance;
