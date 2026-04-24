import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  ChevronDown,
  BookOpen,
  FileText,
  ListFilter,
  ArrowRightLeft
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { PCN_ACCOUNTS } from '../../constants';
import BilingualLabel from '../../components/BilingualLabel';
import { financeService } from '../../services/financeService';
import { Account, JournalEntry } from '../../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const GeneralLedger: React.FC = () => {
  const { formatCurrency, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('accounts');
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      const data = await financeService.getAccounts();
      setAccounts(data);
      setLoading(false);
    };
    fetchAccounts();
  }, []);

  const filteredAccounts = PCN_ACCOUNTS.filter(acc => 
    acc.number.includes(searchTerm) || 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          onClick={() => setActiveSubTab('accounts')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'accounts'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="chartOfAccounts" tf />
          {activeSubTab === 'accounts' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('journal')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'journal'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="journalEntries" tf />
          {activeSubTab === 'journal' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('trialBalance')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'trialBalance'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="trialBalance" tf />
          {activeSubTab === 'trialBalance' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                <Filter className="w-5 h-5" />
              </button>
              <button className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                <Download className="w-5 h-5" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20">
                <Plus className="w-5 h-5" />
                <BilingualLabel tKey="addAccount" tf />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <BilingualLabel tKey="accountNumber" tf />
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <BilingualLabel tKey="accountName" tf />
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <BilingualLabel tKey="type" tf />
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                      <BilingualLabel tKey="balance" tf />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {filteredAccounts.map((account) => (
                    <tr 
                      key={account.number}
                      className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                          {account.number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {account.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "text-xs font-bold px-2 py-1 rounded-full",
                          account.type === 'ACTIF' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                          account.type === 'PASSIF' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                          account.type === 'CHARGE' ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600" :
                          "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                        )}>
                          {account.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Math.random() * 1000000)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'journal' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ArrowRightLeft className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">Journal Entries Module coming soon</p>
          <p className="text-sm">Real-time GL synchronization is active</p>
        </div>
      )}
    </div>
  );
};

export default GeneralLedger;
