import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  TrendingUp,
  Calendar,
  Users,
  DollarSign,
  Save,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { taxService, IfuDeclaration } from '../../services/taxService';
import { authFetch, getAuthHeaders, parseJsonResponse } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { downloadG12Pdf, downloadG50TerPdf } from '../../lib/export';

const TaxReports: React.FC = () => {
  const { formatCurrency, isRTL, tf } = useLanguage();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [activeSubTab, setActiveSubTab] = useState<'tva' | 'ifu' | 'pl'>('tva');
  const [ifuTab, setIfuTab] = useState<'g12' | 'g50' | 'dashboard' | 'config'>('g12');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [declarations, setDeclarations] = useState<IfuDeclaration[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPayroll, setHasPayroll] = useState(false);
  const [declaredMonthly, setDeclaredMonthly] = useState<Record<number, number>>({});
  const [editMode, setEditMode] = useState<'total' | 'monthly'>('total');
  const [declaredTotal, setDeclaredTotal] = useState<number>(0);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Mock TVA data
  const tvaSummary = {
    collected: 125400,
    deductible: 82400,
    net: 43000,
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [declRes, salesRes, payRes] = await Promise.all([
        taxService.getIfuDeclarations(selectedYear),
        authFetch('/api/sales', { headers: getAuthHeaders() }),
        authFetch('/api/db/payslips', { headers: getAuthHeaders() }),
      ]);

      setDeclarations(declRes);

      const salesData = salesRes.ok ? await parseJsonResponse<any[]>(salesRes) : [];
      setSales(Array.isArray(salesData) ? salesData : []);

      const payData = payRes.ok ? await parseJsonResponse<any[]>(payRes) : [];
      setPayslips(Array.isArray(payData) ? payData : []);
      setHasPayroll(Array.isArray(payData) && payData.length > 0);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Calculate monthly turnover from sales
  const monthlyTurnover = useMemo(() => {
    const months: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) {
      months[i] = 0;
    }

    sales.forEach((s) => {
      const date = new Date(s.createdAt);
      if (date.getFullYear() === selectedYear) {
        const month = date.getMonth() + 1;
        months[month] = (months[month] || 0) + (s.totalAmount || 0);
      }
    });

    return months;
  }, [sales, selectedYear]);

  // Calculate quarterly payroll metrics from real payslips
  const quarterlyPayroll = useMemo(() => {
    const quarters = [
      { start: 1, end: 3 },
      { start: 4, end: 6 },
      { start: 7, end: 9 },
      { start: 10, end: 12 },
    ];
    const q = quarters[selectedQuarter - 1];

    const quarterPayslips = payslips.filter((p) => {
      if (!p.period || typeof p.period !== 'string') return false;
      const [year, month] = p.period.split('-').map(Number);
      return year === selectedYear && month >= q.start && month <= q.end;
    });

    const uniqueEmployees = new Set(quarterPayslips.map((p) => p.employeeId));
    const totalGross = quarterPayslips.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
    const totalIrg = quarterPayslips.reduce((sum, p) => sum + (p.irgRetained || 0), 0);

    return {
      employeeCount: uniqueEmployees.size,
      totalGrossPayroll: totalGross,
      totalIrgWithheld: totalIrg,
    };
  }, [payslips, selectedYear, selectedQuarter]);

  // All versions for the selected year, sorted ascending
  const yearVersions = useMemo(() => {
    return declarations.filter((d) => d.year === selectedYear).sort((a, b) => a.version - b.version);
  }, [declarations, selectedYear]);

  // The currently-viewed declaration (by selected version ID, or latest)
  const currentDeclaration = useMemo(() => {
    if (selectedVersionId) {
      return yearVersions.find((d) => d.id === selectedVersionId) || yearVersions[yearVersions.length - 1] || null;
    }
    return yearVersions[yearVersions.length - 1] || null;
  }, [yearVersions, selectedVersionId]);

  // Calculate total annual turnover from real sales
  const annualTurnover = useMemo(() => {
    return Object.values(monthlyTurnover).reduce((sum, val) => sum + val, 0);
  }, [monthlyTurnover]);

  // Check if exceeds threshold
  const exceedsThreshold = annualTurnover > 9_000_000;

  // Initialize declared monthly from declaration or real data
  useEffect(() => {
    if (currentDeclaration?.monthlyBreakdown) {
      try {
        const parsed = JSON.parse(currentDeclaration.monthlyBreakdown) as Record<string, number>;
        const asNumbers: Record<number, number> = {};
        for (const [k, v] of Object.entries(parsed)) asNumbers[parseInt(k)] = v;
        setDeclaredMonthly(asNumbers);
        const total = Object.values(asNumbers).reduce((s, v) => s + v, 0);
        setDeclaredTotal(total);
      } catch {}
    } else {
      setDeclaredMonthly({ ...monthlyTurnover });
      setDeclaredTotal(annualTurnover);
    }
  }, [currentDeclaration, monthlyTurnover, annualTurnover]);

  // When total mode changes, redistribute proportionally
  const handleDeclaredTotalChange = useCallback((total: number) => {
    setDeclaredTotal(total);
    const realTotal = annualTurnover;
    if (realTotal === 0) {
      const even = total / 12;
      const evenly: Record<number, number> = {};
      for (let i = 1; i <= 12; i++) evenly[i] = even;
      setDeclaredMonthly(evenly);
    } else {
      const distributed: Record<number, number> = {};
      for (let i = 1; i <= 12; i++) {
        distributed[i] = Math.round((monthlyTurnover[i] / realTotal) * total);
      }
      setDeclaredMonthly(distributed);
    }
  }, [annualTurnover, monthlyTurnover]);

  const declaredAnnualTotal = useMemo(() => {
    return Object.values(declaredMonthly).reduce((s, v) => s + v, 0);
  }, [declaredMonthly]);

  // Save draft
  const handleSaveDeclaration = useCallback(async () => {
    try {
      setIsSaving(true);
      const grossTurnover = declaredAnnualTotal;
      const taxRatePercent = 1.5;
      const taxAmountDue = (grossTurnover * taxRatePercent) / 100;
      if (!currentDeclaration) {
        const created = await taxService.createIfuDeclaration({
          year: selectedYear,
          grossTurnover,
          taxRatePercent,
          monthlyBreakdown: declaredMonthly,
        });
        setSelectedVersionId(created.id);
      } else {
        await taxService.updateIfuDeclaration(currentDeclaration.id, {
          grossTurnover,
          taxRatePercent,
          monthlyBreakdown: declaredMonthly,
        });
      }
      void fetchData();
    } catch (err) {
      toast.error(tf('ifuCreationFailed'));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }, [selectedYear, declaredAnnualTotal, declaredMonthly, currentDeclaration, fetchData, tf]);

  // Submit declaration
  const handleSubmitDeclaration = useCallback(async () => {
    if (!currentDeclaration) return;
    try {
      setIsSaving(true);
      await taxService.submitIfuDeclaration(currentDeclaration.id);
      void fetchData();
    } catch (err) {
      toast.error(tf('ifuSubmitFailed'));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }, [currentDeclaration, fetchData, tf]);

  // Amend declaration
  const handleAmend = useCallback(async () => {
    if (!currentDeclaration) return;
    try {
      setIsSaving(true);
      const newDecl = await taxService.amendIfuDeclaration(currentDeclaration.id);
      await fetchData();
      setSelectedVersionId(newDecl.id);
    } catch (err) {
      toast.error(tf('ifuCreationFailed'));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }, [currentDeclaration, fetchData, tf]);

  // Print G12 declaration
  const handlePrintG12 = useCallback(() => {
    window.print();
  }, []);

  // Export G12 declaration as PDF
  const handleExportG12Pdf = useCallback(async () => {
    try {
      if (!currentDeclaration) {
        toast.error(tf('ifuNoDeclarationToExport'));
        return;
      }
      const filename = `G12-${selectedYear}-${new Date().toISOString().split('T')[0]}.pdf`;
      const submissionDate = currentDeclaration.submittedAt
        ? new Date(currentDeclaration.submittedAt).toLocaleDateString(isRTL ? 'ar-DZ' : 'fr-DZ')
        : format(new Date(), 'dd MMM yyyy');

      await downloadG12Pdf({
        filename,
        isRTL,
        currencyUnit: 'DZD',
        labels: tf as any,
        declaration: {
          year: currentDeclaration.year,
          grossTurnover: currentDeclaration.grossTurnover,
          taxRatePercent: currentDeclaration.taxRatePercent,
          taxAmountDue: currentDeclaration.taxAmountDue,
          status: currentDeclaration.status,
          submittedAt: currentDeclaration.submittedAt,
          configSnapshot: currentDeclaration.configSnapshot,
        },
        monthlyTurnover,
        submissionDate,
      });
    } catch (err) {
      toast.error(tf('ifuExportPdfFailed'));
      console.error(err);
    }
  }, [currentDeclaration, monthlyTurnover, selectedYear, isRTL, tf]);

  // Print G50ter declaration
  const handlePrintG50 = useCallback(() => {
    window.print();
  }, []);

  // Export G50ter declaration as PDF
  const handleExportG50Pdf = useCallback(async () => {
    try {
      if (!hasPayroll) {
        toast.error(tf('ifuNoPayrollData'));
        return;
      }
      const filename = `G50ter-${selectedYear}-Q${selectedQuarter}-${new Date().toISOString().split('T')[0]}.pdf`;
      const submissionDate = format(new Date(), 'dd MMM yyyy');

      await downloadG50TerPdf({
        filename,
        isRTL,
        currencyUnit: 'DZD',
        labels: tf as any,
        declaration: {
          year: selectedYear,
          quarter: selectedQuarter,
          employeeCount: quarterlyPayroll.employeeCount,
          totalGrossPayroll: quarterlyPayroll.totalGrossPayroll,
          totalIrgWithheld: quarterlyPayroll.totalIrgWithheld,
          status: 'BROUILLON',
        },
        submissionDate,
      });
    } catch (err) {
      toast.error(tf('ifuExportPdfFailed'));
      console.error(err);
    }
  }, [selectedYear, selectedQuarter, isRTL, tf, hasPayroll, quarterlyPayroll]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // G12 ANNUAL DECLARATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const G12Screen = () => {
    const isBrouillon = currentDeclaration?.status === 'BROUILLON' || !currentDeclaration;
    const isLatestVersion = !currentDeclaration || currentDeclaration.id === yearVersions[yearVersions.length - 1]?.id;
    const latestIsSoumis = yearVersions[yearVersions.length - 1]?.status === 'SOUMIS';

    return (
    <div className="space-y-6">
      {/* Top bar: year selector + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-slate-600 dark:text-slate-400">
            <BilingualLabel tKey="ifuYear" tf />:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setSelectedVersionId(null); }}
            className="input py-2 text-sm"
          >
            {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isBrouillon && isLatestVersion && (
            <>
              <button
                onClick={handleSaveDeclaration}
                disabled={isSaving || loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <BilingualLabel tKey="ifuActionSaveDraft" tf />
              </button>
              <button
                onClick={handleSubmitDeclaration}
                disabled={isSaving || loading || !currentDeclaration}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl transition-all"
              >
                <BilingualLabel tKey="ifuActionSubmit" tf />
              </button>
            </>
          )}
          {isLatestVersion && latestIsSoumis && (
            <button
              onClick={handleAmend}
              disabled={isSaving || loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
            >
              <BilingualLabel tKey="ifuAmend" tf />
            </button>
          )}
          <button
            onClick={handleExportG12Pdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
          >
            <Download className="w-4 h-4" />
            <BilingualLabel tKey="ifuActionExportPdf" tf />
          </button>
        </div>
      </div>

      {/* Version pills */}
      {yearVersions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <BilingualLabel tKey="ifuVersionLabel" tf />:
          </span>
          {yearVersions.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVersionId(v.id)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-bold border transition-all',
                currentDeclaration?.id === v.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-primary-400'
              )}
            >
              v{v.version} {v.status === 'SOUMIS'
                ? <span className="text-emerald-400">✓</span>
                : '✏️'}
            </button>
          ))}
          {yearVersions.length > 0 && (
            <span className={clsx(
              'px-3 py-1 rounded-full text-xs font-bold ml-2',
              currentDeclaration?.status === 'SOUMIS'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
            )}>
              {currentDeclaration?.status === 'SOUMIS'
                ? tf('ifuStatusSubmitted')
                : tf('ifuStatusDraft')}
            </span>
          )}
        </div>
      )}

      {/* Warning if threshold exceeded */}
      {exceedsThreshold && (
        <div className="flex gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">
            <BilingualLabel tKey="ifuWarningThreshold" tf />
          </p>
        </div>
      )}

      {/* Monthly Table */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            <BilingualLabel tKey="ifuMonthlyBreakdown" tf />
          </h3>
          {/* Mode switcher — only in BROUILLON */}
          {isBrouillon && isLatestVersion && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-xl p-1">
              <button
                onClick={() => setEditMode('monthly')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  editMode === 'monthly' ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                )}
              >
                <BilingualLabel tKey="ifuModeMonthly" tf />
              </button>
              <button
                onClick={() => setEditMode('total')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  editMode === 'total' ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                )}
              >
                <BilingualLabel tKey="ifuModeTotal" tf />
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="text-left py-3 px-4 font-bold text-slate-600 dark:text-slate-400">
                  <BilingualLabel tKey="month" tf />
                </th>
                <th className="text-right py-3 px-4 font-bold text-slate-500 dark:text-slate-500">
                  <BilingualLabel tKey="ifuRealRevenue" tf />
                </th>
                <th className="text-right py-3 px-4 font-bold text-slate-600 dark:text-slate-400">
                  <BilingualLabel tKey="ifuDeclaredAmount" tf />
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(monthlyTurnover).map(([monthStr, realAmount]) => {
                const m = parseInt(monthStr);
                const declared = declaredMonthly[m] ?? realAmount;
                return (
                  <tr key={monthStr} className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {tf('monthNames')[m - 1]}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 dark:text-slate-500 text-right">
                      {formatCurrency(realAmount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(isBrouillon && isLatestVersion && editMode === 'monthly') ? (
                        <input
                          type="number"
                          value={declared}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setDeclaredMonthly((prev) => ({ ...prev, [m]: val }));
                          }}
                          className="w-32 px-2 py-1 text-right font-mono bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      ) : (
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(declared)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-white/5 font-bold">
                <td className="py-3 px-4 text-slate-900 dark:text-white">
                  <BilingualLabel tKey="total" tf />
                </td>
                <td className="py-3 px-4 font-mono text-slate-400 dark:text-slate-500 text-right">
                  {formatCurrency(annualTurnover)}
                </td>
                <td className="py-3 px-4 text-right">
                  {(isBrouillon && isLatestVersion && editMode === 'total') ? (
                    <input
                      type="number"
                      value={declaredTotal}
                      onChange={(e) => handleDeclaredTotalChange(parseFloat(e.target.value) || 0)}
                      className="w-36 px-2 py-1 text-right font-mono bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  ) : (
                    <span className="font-mono text-slate-900 dark:text-white">
                      {formatCurrency(declaredAnnualTotal)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="ifuRealRevenue" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(annualTurnover)}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="ifuDeclaredAmount" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(declaredAnnualTotal)}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="ifuGap" tf />
          </p>
          <p className={clsx(
            'text-2xl font-display font-bold mt-2',
            declaredAnnualTotal - annualTurnover < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
          )}>
            {formatCurrency(declaredAnnualTotal - annualTurnover)}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-primary-100 dark:border-primary-900/20 shadow-sm bg-primary-50/50 dark:bg-primary-900/5">
          <p className="text-sm text-primary-600 dark:text-primary-400 font-bold">
            <BilingualLabel tKey="ifuTaxDue" tf />
          </p>
          <p className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400 mt-2">
            {formatCurrency((declaredAnnualTotal * 1.5) / 100)}
          </p>
        </div>
      </div>

    </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // G50ter QUARTERLY DECLARATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const G50Screen = () => {
    if (!hasPayroll) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Users className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium"><BilingualLabel tKey="noActivityLogsGeneric" tf /></p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-slate-600 dark:text-slate-400">
            <BilingualLabel tKey="ifuYear" tf />:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="input py-2 text-sm"
          >
            {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-4">
            <BilingualLabel tKey="ifuQuarter" tf />:
          </label>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
            className="input py-2 text-sm"
          >
            <option value={1}>{tf('ifuQuarter1')}</option>
            <option value={2}>{tf('ifuQuarter2')}</option>
            <option value={3}>{tf('ifuQuarter3')}</option>
            <option value={4}>{tf('ifuQuarter4')}</option>
          </select>
        </div>

        {/* Quarterly Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <BilingualLabel tKey="ifuEmployeeCount" tf />
            </p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-2">
              {quarterlyPayroll.employeeCount}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <BilingualLabel tKey="ifuTotalGrossPayroll" tf />
            </p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-2">
              {formatCurrency(quarterlyPayroll.totalGrossPayroll)}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <BilingualLabel tKey="ifuTotalIrgWithheld" tf />
            </p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-2">
              {formatCurrency(quarterlyPayroll.totalIrgWithheld)}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <BilingualLabel tKey="ifuStatus" tf />
            </p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-2">
              <BilingualLabel tKey="ifuStatusDraft" tf />
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all">
            <BilingualLabel tKey="ifuActionGenerate" tf />
          </button>
          <button
            onClick={handlePrintG50}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
          >
            <Printer className="w-4 h-4" />
            <BilingualLabel tKey="ifuActionPrint" tf />
          </button>
          <button
            onClick={handleExportG50Pdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
          >
            <Download className="w-4 h-4" />
            <BilingualLabel tKey="ifuActionExportPdf" tf />
          </button>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TAX DASHBOARD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const DashboardScreen = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="ifuYearToDate" tf />
          </p>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(annualTurnover)}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="ifuCurrentEstimate" tf />
          </p>
          <p className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400 mt-2">
            {formatCurrency((annualTurnover * 1.5) / 100)}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="ifuG12Status" tf />
          </p>
          <p className="text-sm font-bold mt-2 flex items-center gap-2">
            {currentDeclaration ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <BilingualLabel tKey="ifuStatusFinalized" tf />
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <BilingualLabel tKey="ifuStatusDraft" tf />
              </>
            )}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <BilingualLabel tKey="ifuDeadlineReminder" tf />
          </p>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-2">
            {tf('ifuDeadlineMarch31')} {new Date().getFullYear() + 1}
          </p>
        </div>
      </div>

      {hasPayroll && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-4">
            <BilingualLabel tKey="ifuQuarterlyCards" tf />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((q) => (
              <div key={q} className="p-4 border border-slate-100 dark:border-white/10 rounded-xl hover:border-primary-300 dark:hover:border-primary-900/50 cursor-pointer transition-all">
                <p className="font-bold text-slate-900 dark:text-white">Q{q}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <BilingualLabel tKey={`ifuQuarter${q}`} tf />
                </p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-2">
                  <BilingualLabel tKey="ifuStatusDraft" tf />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IFU CONFIG ADMIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const TaxConfigAdmin = () => {
    const [ratePercent, setRatePercent] = useState(1.5);
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [detailVersion, setDetailVersion] = useState<any>(null);

    useEffect(() => { loadConfig(); }, []);

    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const config = await taxService.getDefaultConfig();
        setRatePercent(config.ratePercent);
        // Fetch history from API
        const histRes = await authFetch('/api/admin/tax-config', {
          headers: getAuthHeaders(),
        });
        if (histRes.ok) {
          const histData = await parseJsonResponse<any[]>(histRes);
          setHistory(Array.isArray(histData) ? histData : []);
        }
      } catch (err) {
        toast.error(tf('ifuConfigLoadFailed'));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    const handleSave = async () => {
      if (ratePercent < 0 || ratePercent > 100) {
        toast.error(tf('ifuConfigRateValidationError'));
        return;
      }
      setIsSaving(true);
      try {
        const user = JSON.parse(localStorage.getItem('bakery_user') || 'null');
        await taxService.saveTaxConfig({
          type: 'IFU_RATE',
          year: new Date().getFullYear(),
          ratePercent,
          description: 'Commercial/Artisanal activity IFU rate',
        });
        toast.success(tf('ifuConfigRateSaved'));
        await loadConfig();
      } catch (err) {
        toast.error(tf('ifuConfigRateSaveFailed'));
        console.error(err);
      } finally {
        setIsSaving(false);
      }
    };

    const sectionTitle = (tKey: string) => (
      <h3 className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-4">
        {tf(tKey)}
      </h3>
    );

    const fieldRow = (label: string, input: React.ReactNode, required = false) => (
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {input}
      </div>
    );

    if (isLoading) {
      return <div className="flex items-center justify-center h-40 text-slate-400">{tf('loading')}</div>;
    }

    const exampleTurnover = 1_000_000;
    const exampleTax = (exampleTurnover * ratePercent) / 100;

    return (
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Warning banner */}
        <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <BilingualLabel tKey="ifuConfigWarningBanner" tf />
          </p>
        </div>

        {/* SECTION 1 — Fiscal regime basics */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
          {sectionTitle('ifuConfigSectionFiscal')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldRow(tf('ifuConfigThreshold'),
              <input type="number" disabled value="9000000"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl outline-none opacity-60" />
            )}
            {fieldRow(tf('ifuConfigActivityType'),
              <input type="text" disabled value={tf('ifuConfigActivityTypeValue')}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl outline-none opacity-60" />
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tf('ifuConfigActivityTypeValue')} — {tf('ifuConfigActivityName')}
          </p>
        </div>

        {/* SECTION 2 — IFU Rate */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
          {sectionTitle('ifuConfigSectionRate')}
          <div>
            {fieldRow(tf('ifuConfigRateLabel'),
              <input type="number" step={0.01} min={0} max={100} value={ratePercent}
                onChange={e => setRatePercent(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all" />,
              true
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            {tf('ifuConfigRateDescription')}
          </p>

          {/* Live preview */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/10">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              {tf('ifuConfigPreviewLabel')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">{tf('ifuConfigPreviewTurnover')}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(exampleTurnover)}</p>
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-xl border border-primary-200 dark:border-primary-900/50">
                <p className="text-xs text-primary-600 dark:text-primary-400 font-bold">{tf('ifuConfigPreviewTax')}</p>
                <p className="text-sm font-bold text-primary-600 dark:text-primary-400 mt-1">{formatCurrency(exampleTax)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3 — Declaration parameters */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
          {sectionTitle('ifuConfigSectionDeadlines')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldRow(tf('ifuConfigG12Deadline'),
              <input type="number" value="90" disabled
                className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl outline-none opacity-60" />
            )}
            {hasPayroll && fieldRow(tf('ifuConfigG50TerDeadline'),
              <input type="number" value="45" disabled
                className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl outline-none opacity-60" />
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tf('ifuConfigDeadlineNote')}
          </p>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '…' : tf('ifuConfigSave')}
          </button>
        </div>

        {/* SECTION 4 — History */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
          {sectionTitle('ifuConfigSectionHistory')}
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">{tf('ifuConfigHistoryEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                    <th className="text-start py-2 pr-4">{tf('ifuConfigHistoryVersion')}</th>
                    <th className="text-start py-2 pr-4">{tf('ifuConfigHistoryDate')}</th>
                    <th className="text-start py-2 pr-4">{tf('ifuConfigHistorySavedBy')}</th>
                    <th className="text-start py-2">{tf('ifuConfigHistoryActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((v, idx) => (
                    <tr key={idx} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-500">v{idx + 1}</td>
                      <td className="py-2 pr-4 text-slate-700 dark:text-slate-300 text-xs">
                        {v.createdAt ? new Date(v.createdAt).toLocaleString() : tf('notAvailable')}
                      </td>
                      <td className="py-2 pr-4 text-slate-700 dark:text-slate-300 text-xs">{v.createdBy || tf('adminLabel')}</td>
                      <td className="py-2">
                        <button
                          onClick={() => setDetailVersion(v)}
                          className="text-primary-600 hover:text-primary-700 text-xs font-bold"
                        >
                          {tf('ifuConfigHistoryView')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail modal */}
        {detailVersion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/10">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {tf('ifuConfigDetailTitle')}
                </h2>
                <button onClick={() => setDetailVersion(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div className="text-xs text-slate-400 mb-2">
                  {detailVersion.createdAt ? new Date(detailVersion.createdAt).toLocaleString() : tf('notAvailable')} — {detailVersion.createdBy || tf('adminLabel')}
                </div>
                <pre className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(detailVersion, null, 2)}
                </pre>
              </div>
              <div className="p-6 pt-0 flex justify-end">
                <button
                  onClick={() => setDetailVersion(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                >
                  {tf('ifuConfigClose')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('tva')}
          className={clsx(
            'pb-3 text-sm font-bold transition-all relative whitespace-nowrap',
            activeSubTab === 'tva'
              ? 'text-primary-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <BilingualLabel tKey="tvaSummary" tf />
          {activeSubTab === 'tva' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('ifu')}
          className={clsx(
            'pb-3 text-sm font-bold transition-all relative whitespace-nowrap',
            activeSubTab === 'ifu'
              ? 'text-primary-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <BilingualLabel tKey="ifuDeclaration" tf />
          {activeSubTab === 'ifu' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('pl')}
          className={clsx(
            'pb-3 text-sm font-bold transition-all relative whitespace-nowrap',
            activeSubTab === 'pl'
              ? 'text-primary-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <BilingualLabel tKey="profitLoss" tf />
          {activeSubTab === 'pl' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      {activeSubTab === 'tva' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('tvaCollectedSales')}</p>
              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(tvaSummary.collected)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">{tf('tvaDeductiblePurchases')}</p>
              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(tvaSummary.deductible)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-primary-100 dark:border-primary-900/20 shadow-sm bg-primary-50/50 dark:bg-primary-900/5">
              <p className="text-sm text-primary-600 dark:text-primary-400 font-bold">{tf('tvaNetCredit')}</p>
              <p className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400 mt-1">
                {formatCurrency(tvaSummary.net)}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'ifu' && (
        <div className="space-y-6">
          {/* IFU Sub-tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/10 overflow-x-auto">
            <button
              onClick={() => setIfuTab('g12')}
              className={clsx(
                'pb-3 text-sm font-bold transition-all relative whitespace-nowrap',
                ifuTab === 'g12'
                  ? 'text-primary-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <BilingualLabel tKey="ifuG12Annual" tf />
              {ifuTab === 'g12' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setIfuTab('g50')}
              className={clsx(
                'pb-3 text-sm font-bold transition-all relative whitespace-nowrap',
                ifuTab === 'g50'
                  ? 'text-primary-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <BilingualLabel tKey="ifuG50Quarterly" tf />
              {ifuTab === 'g50' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setIfuTab('dashboard')}
              className={clsx(
                'pb-3 text-sm font-bold transition-all relative whitespace-nowrap',
                ifuTab === 'dashboard'
                  ? 'text-primary-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <BilingualLabel tKey="ifuTaxDashboard" tf />
              {ifuTab === 'dashboard' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
              )}
            </button>
            {isAdmin && (
              <button
                onClick={() => setIfuTab('config')}
                className={clsx(
                  'pb-3 text-sm font-bold transition-all relative whitespace-nowrap',
                  ifuTab === 'config'
                    ? 'text-primary-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {tf('ifuConfigTitle')}
                {ifuTab === 'config' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
                )}
              </button>
            )}
          </div>

          {/* IFU Content */}
          {ifuTab === 'g12' && <G12Screen />}
          {ifuTab === 'g50' && <G50Screen />}
          {ifuTab === 'dashboard' && <DashboardScreen />}
          {ifuTab === 'config' && isAdmin && <TaxConfigAdmin />}
        </div>
      )}

      {activeSubTab === 'pl' && (
        <div className="text-center py-12 text-slate-400">
          <p className="font-medium">{tf('comingSoonSuffix')}</p>
        </div>
      )}
    </div>
  );
};

export default TaxReports;
