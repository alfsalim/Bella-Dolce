import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ArrowRightLeft,
  CheckCircle,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { PCN_ACCOUNTS } from '../../constants';
import BilingualLabel from '../../components/BilingualLabel';
import { financeService } from '../../services/financeService';
import { JournalEntry, JournalLine } from '../../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { PAGE_SIZE } from '../../constants';
import Pagination from '../../components/Pagination';

interface AccountBalance {
  accountNumber: string;
  totalDebit: number;
  totalCredit: number;
}

interface NewLine {
  accountNumber: string;
  label: string;
  debit: string;
  credit: string;
}

const EMPTY_LINE: NewLine = { accountNumber: '', label: '', debit: '', credit: '' };

const GeneralLedger: React.FC = () => {
  const { formatCurrency, tf, t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('accounts');

  // --- Chart of Accounts state ---
  const [searchTerm, setSearchTerm] = useState('');
  const [accountsPage, setAccountsPage] = useState(1);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);

  // --- Journal Entries state ---
  const [journalPeriod, setJournalPeriod] = useState(format(new Date(), 'yyyy-MM'));
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [entryLines, setEntryLines] = useState<Record<string, JournalLine[]>>({});
  const [showNewEntry, setShowNewEntry] = useState(false);

  // New entry form state
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newLabel, setNewLabel] = useState('');
  const [newReference, setNewReference] = useState('');
  const [newLines, setNewLines] = useState<NewLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // --- Trial Balance state ---
  const [trialPeriod, setTrialPeriod] = useState(format(new Date(), 'yyyy-MM'));
  const [trialBalances, setTrialBalances] = useState<AccountBalance[]>([]);
  const [trialLoading, setTrialLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('bakery_user') || 'null');

  // Load balances for Chart of Accounts
  useEffect(() => {
    setBalancesLoading(true);
    financeService.getAccountBalances()
      .then(setBalances)
      .finally(() => setBalancesLoading(false));
  }, []);

  // Load journal entries
  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const data = await financeService.getJournalEntries(journalPeriod);
      setEntries(data);
    } finally {
      setEntriesLoading(false);
    }
  }, [journalPeriod]);

  useEffect(() => {
    if (activeSubTab === 'journal') loadEntries();
  }, [activeSubTab, loadEntries]);

  // Load trial balance
  useEffect(() => {
    if (activeSubTab === 'trialBalance') {
      setTrialLoading(true);
      financeService.getAccountBalances(trialPeriod)
        .then(setTrialBalances)
        .finally(() => setTrialLoading(false));
    }
  }, [activeSubTab, trialPeriod]);

  // Chart of Accounts helpers
  useEffect(() => { setAccountsPage(1); }, [searchTerm]);

  const filteredAccounts = PCN_ACCOUNTS.filter(acc =>
    acc.number.includes(searchTerm) ||
    acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const accountsTotalPages = Math.ceil(filteredAccounts.length / PAGE_SIZE) || 1;
  const safeAccountsPage = Math.min(accountsPage, accountsTotalPages);
  const paginatedAccounts = filteredAccounts.slice(
    (safeAccountsPage - 1) * PAGE_SIZE,
    safeAccountsPage * PAGE_SIZE
  );

  const getBalance = (accountNumber: string) => {
    const b = balances.find(b => b.accountNumber === accountNumber);
    return b ? b.totalDebit - b.totalCredit : 0;
  };

  // Journal entry expand/collapse
  const toggleEntry = async (id: string) => {
    if (expandedEntry === id) {
      setExpandedEntry(null);
      return;
    }
    setExpandedEntry(id);
    if (!entryLines[id]) {
      const lines = await financeService.getJournalLines(id);
      setEntryLines(prev => ({ ...prev, [id]: lines }));
    }
  };

  // New entry form helpers
  const updateLine = (i: number, field: keyof NewLine, value: string) => {
    setNewLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const addLine = () => setNewLines(prev => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (i: number) => setNewLines(prev => prev.filter((_, idx) => idx !== i));

  const newLinesDebitTotal = newLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const newLinesCreditTotal = newLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

  const submitEntry = async () => {
    setFormError('');
    if (!newLabel.trim()) { setFormError('Libellé requis'); return; }
    const filledLines = newLines.filter(l => l.accountNumber && (parseFloat(l.debit) || parseFloat(l.credit)));
    if (filledLines.length < 2) { setFormError('Au moins 2 lignes requises'); return; }
    if (Math.abs(newLinesDebitTotal - newLinesCreditTotal) > 0.001) {
      setFormError(t('unbalancedError'));
      return;
    }
    setSaving(true);
    try {
      await financeService.createJournalEntry(
        {
          date: newDate,
          period: newDate.slice(0, 7),
          label: newLabel.trim(),
          reference: newReference.trim() || null,
          sourceModule: 'MANUEL',
          sourceId: null,
          status: 'BROUILLON' as any,
          createdBy: currentUser?.id || 'system',
          approvedBy: null,
          approvedAt: null,
          postedAt: null,
        },
        filledLines.map(l => ({
          accountNumber: l.accountNumber,
          label: l.label || null,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        }))
      );
      setShowNewEntry(false);
      setNewLabel('');
      setNewReference('');
      setNewLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
      loadEntries();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Trial balance totals
  const trialTotalDebit = trialBalances.reduce((s, b) => s + b.totalDebit, 0);
  const trialTotalCredit = trialBalances.reduce((s, b) => s + b.totalCredit, 0);
  const trialBalanced = Math.abs(trialTotalDebit - trialTotalCredit) < 0.01;

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      BROUILLON: 'bg-slate-100 text-slate-600',
      COMPTABILISÉ: 'bg-emerald-50 text-emerald-600',
      APPROUVÉ: 'bg-blue-50 text-blue-600',
    };
    return <span className={clsx('text-xs font-bold px-2 py-1 rounded-full', colors[status] || 'bg-slate-100 text-slate-600')}>{status}</span>;
  };

  const tabBtn = (id: string, labelKey: string) => (
    <button
      onClick={() => setActiveSubTab(id)}
      className={clsx(
        'pb-3 text-sm font-bold transition-all relative',
        activeSubTab === id
          ? 'text-primary-600'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
      )}
    >
      <BilingualLabel tKey={labelKey as any} tf />
      {activeSubTab === id && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        {tabBtn('accounts', 'chartOfAccounts')}
        {tabBtn('journal', 'journalEntries')}
        {tabBtn('trialBalance', 'trialBalance')}
      </div>

      {/* ── Chart of Accounts ── */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={tf('searchAccounts')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
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
                  {paginatedAccounts.map(account => {
                    const bal = getBalance(account.number);
                    return (
                      <tr key={account.number} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                            {account.number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900 dark:text-white">{account.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={clsx(
                            'text-xs font-bold px-2 py-1 rounded-full',
                            account.type === 'ACTIF' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
                            account.type === 'PASSIF' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' :
                            account.type === 'CHARGE' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' :
                            'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                          )}>
                            {account.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {balancesLoading ? '...' : formatCurrency(bal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={safeAccountsPage}
              totalPages={Math.ceil(filteredAccounts.length / PAGE_SIZE)}
              onPageChange={setAccountsPage}
            />
          </div>
        </div>
      )}

      {/* ── Écriture Journal ── */}
      {activeSubTab === 'journal' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                <BilingualLabel tKey="period" tf />
              </label>
              <input
                type="month"
                value={journalPeriod}
                onChange={e => setJournalPeriod(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <button
              onClick={() => setShowNewEntry(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
            >
              <Plus className="w-5 h-5" />
              <BilingualLabel tKey="newEntry" tf />
            </button>
          </div>

          {/* New entry modal */}
          {showNewEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    <BilingualLabel tKey="newEntry" tf />
                  </h3>
                  <button onClick={() => { setShowNewEntry(false); setFormError(''); }} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                        <BilingualLabel tKey="date" tf /> *
                      </label>
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                        <BilingualLabel tKey="entryReference" tf />
                      </label>
                      <input type="text" value={newReference} onChange={e => setNewReference(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                      <BilingualLabel tKey="entryLabel" tf /> *
                    </label>
                    <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>

                  {/* Lines table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-zinc-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="account" tf /></th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="entryLabel" tf /></th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="debit" tf /></th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="credit" tf /></th>
                          <th className="px-3 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                        {newLines.map((line, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1">
                              <select value={line.accountNumber} onChange={e => updateLine(i, 'accountNumber', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-primary-500">
                                <option value="">—</option>
                                {PCN_ACCOUNTS.map(a => (
                                  <option key={a.number} value={a.number}>{a.number} — {a.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <input type="text" value={line.label} onChange={e => updateLine(i, 'label', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" min="0" step="0.01" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" min="0" step="0.01" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500" />
                            </td>
                            <td className="px-2 py-1">
                              {newLines.length > 2 && (
                                <button onClick={() => removeLine(i)} className="text-rose-400 hover:text-rose-600">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-zinc-800">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Total</td>
                          <td className={clsx('px-3 py-2 text-right font-mono font-bold text-sm',
                            Math.abs(newLinesDebitTotal - newLinesCreditTotal) > 0.001 ? 'text-rose-600' : 'text-slate-900 dark:text-white')}>
                            {formatCurrency(newLinesDebitTotal)}
                          </td>
                          <td className={clsx('px-3 py-2 text-right font-mono font-bold text-sm',
                            Math.abs(newLinesDebitTotal - newLinesCreditTotal) > 0.001 ? 'text-rose-600' : 'text-slate-900 dark:text-white')}>
                            {formatCurrency(newLinesCreditTotal)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <button onClick={addLine} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    <Plus className="w-4 h-4" />
                    <BilingualLabel tKey="addLine" tf />
                  </button>

                  {formError && (
                    <p className="text-sm text-rose-600 font-medium">{formError}</p>
                  )}
                </div>
                <div className="p-6 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
                  <button onClick={() => { setShowNewEntry(false); setFormError(''); }}
                    className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
                    <BilingualLabel tKey="cancel" tf />
                  </button>
                  <button onClick={submitEntry} disabled={saving}
                    className="px-4 py-2 text-sm font-bold bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50">
                    <BilingualLabel tKey="save" tf />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Entries list */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            {entriesLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <BookOpen className="w-8 h-8 animate-pulse" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <ArrowRightLeft className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">{t('noJournalEntries')}</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase w-8" />
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">N°</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="date" tf /></th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="entryLabel" tf /></th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="entrySource" tf /></th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="status" tf /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {entries.map(entry => (
                    <React.Fragment key={entry.id}>
                      <tr
                        className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        onClick={() => toggleEntry(entry.id)}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          {expandedEntry === entry.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-primary-600 font-bold">{entry.number}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{entry.date ? format(new Date(entry.date), 'dd/MM/yyyy') : '—'}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{entry.label}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{entry.sourceModule}</td>
                        <td className="px-4 py-3">{statusBadge(entry.status)}</td>
                      </tr>
                      {expandedEntry === entry.id && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50 dark:bg-zinc-800/30 px-8 py-3">
                            {!entryLines[entry.id] ? (
                              <p className="text-sm text-slate-400">Chargement...</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500 font-bold uppercase">
                                    <th className="py-1 text-left"><BilingualLabel tKey="account" tf /></th>
                                    <th className="py-1 text-left"><BilingualLabel tKey="entryLabel" tf /></th>
                                    <th className="py-1 text-right"><BilingualLabel tKey="debit" tf /></th>
                                    <th className="py-1 text-right"><BilingualLabel tKey="credit" tf /></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                  {entryLines[entry.id].map(line => (
                                    <tr key={line.id}>
                                      <td className="py-1 font-mono text-primary-600">{line.accountNumber}</td>
                                      <td className="py-1 text-slate-600 dark:text-slate-300">{line.label || '—'}</td>
                                      <td className="py-1 text-right font-mono">{line.debit ? formatCurrency(line.debit) : '—'}</td>
                                      <td className="py-1 text-right font-mono">{line.credit ? formatCurrency(line.credit) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Vérification Balance ── */}
      {activeSubTab === 'trialBalance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              <BilingualLabel tKey="period" tf />
            </label>
            <input
              type="month"
              value={trialPeriod}
              onChange={e => setTrialPeriod(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Balance status banner */}
          {!trialLoading && trialBalances.length > 0 && (
            <div className={clsx(
              'flex items-center gap-3 px-5 py-3 rounded-xl font-bold text-sm',
              trialBalanced
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700'
                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700'
            )}>
              {trialBalanced
                ? <><CheckCircle className="w-5 h-5" /> {t('balanceEquilibree')} ✓</>
                : <><AlertTriangle className="w-5 h-5" /> {t('desequilibre')}: {formatCurrency(Math.abs(trialTotalDebit - trialTotalCredit))} ✗</>
              }
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            {trialLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <BookOpen className="w-8 h-8 animate-pulse" />
              </div>
            ) : trialBalances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <BookOpen className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">{t('noJournalEntries')}</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="accountNumber" tf /></th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="accountName" tf /></th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="type" tf /></th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="totalDebit" tf /></th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="totalCredit" tf /></th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase"><BilingualLabel tKey="balance" tf /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {trialBalances.map(row => {
                    const acct = PCN_ACCOUNTS.find(a => a.number === row.accountNumber);
                    const bal = row.totalDebit - row.totalCredit;
                    return (
                      <tr key={row.accountNumber} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-3">
                          <span className="font-mono font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                            {row.accountNumber}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{acct?.name || row.accountNumber}</td>
                        <td className="px-6 py-3">
                          {acct && (
                            <span className={clsx(
                              'text-xs font-bold px-2 py-1 rounded-full',
                              acct.type === 'ACTIF' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
                              acct.type === 'PASSIF' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' :
                              acct.type === 'CHARGE' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' :
                              'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                            )}>{acct.type}</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(row.totalDebit)}</td>
                        <td className="px-6 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(row.totalCredit)}</td>
                        <td className={clsx(
                          'px-6 py-3 text-right font-mono font-bold',
                          bal >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'
                        )}>
                          {formatCurrency(bal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-zinc-800">
                  <tr>
                    <td colSpan={3} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">TOTAL</td>
                    <td className={clsx(
                      'px-6 py-3 text-right font-mono font-bold',
                      trialBalanced ? 'text-slate-900 dark:text-white' : 'text-rose-600'
                    )}>
                      {formatCurrency(trialTotalDebit)}
                    </td>
                    <td className={clsx(
                      'px-6 py-3 text-right font-mono font-bold',
                      trialBalanced ? 'text-slate-900 dark:text-white' : 'text-rose-600'
                    )}>
                      {formatCurrency(trialTotalCredit)}
                    </td>
                    <td className={clsx(
                      'px-6 py-3 text-right font-mono font-bold',
                      trialBalanced ? 'text-emerald-600' : 'text-rose-600'
                    )}>
                      {formatCurrency(trialTotalDebit - trialTotalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralLedger;
