import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Users,
  FileText,
  CheckCircle2,
  Calculator,
  X,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Pencil,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
  Save,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { financeService } from '../../services/financeService';
import { FinancialEmployee, PayrollRun, Payslip, UserProfile, PayrollConfig } from '../../types';
import { calculatePayslip, DEFAULT_PAYROLL_CONFIG } from '../../lib/payrollEngine';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { PAGE_SIZE } from '../../constants';
import Pagination from '../../components/Pagination';
import { downloadPayslipPdf } from '../../lib/export';

const SMIG_DZD = 20_000;

// ─── PayslipEditor ────────────────────────────────────────────────────────────
type EditorForm = {
  baseSalary: string;
  transportAllowance: string;
  performanceBonus: string;
  otherAllowances: string;
  otherDeductions: string;
};

const PayslipEditor: React.FC<{
  slip: Payslip;
  run: PayrollRun;
  employee: FinancialEmployee | undefined;
  onClose: () => void;
  onSaved: (updated: Payslip) => void;
}> = ({ slip, run, employee, onClose, onSaved }) => {
  const { tf, formatCurrency, language } = useLanguage();
  const isRTL = language === 'ar';
  const isApproved = run.status === 'APPROUVÉ';

  const config: PayrollConfig = useMemo(() => {
    try { return run.configSnapshot ? JSON.parse(run.configSnapshot) : DEFAULT_PAYROLL_CONFIG; }
    catch { return DEFAULT_PAYROLL_CONFIG; }
  }, [run.configSnapshot]);

  const [form, setForm] = useState<EditorForm>({
    baseSalary: String(slip.baseSalary),
    transportAllowance: String(slip.transportAllowance),
    performanceBonus: String(slip.performanceBonus),
    otherAllowances: String(slip.otherAllowances),
    otherDeductions: String(slip.otherDeductions ?? 0),
  });
  const [showIrgBreakdown, setShowIrgBreakdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const n = (v: string) => parseFloat(v) || 0;

  const calc = useMemo(() => calculatePayslip(
    config,
    n(form.baseSalary),
    n(form.transportAllowance),
    n(form.performanceBonus),
    n(form.otherAllowances),
    employee?.contributesToCNAS !== false,
  ), [form, config, employee]);

  const otherDed = n(form.otherDeductions);
  const netToPay = calc.netSalary - otherDed;

  const warnNetBelowSmig = netToPay < SMIG_DZD && netToPay > 0;
  const warnGrossZero = calc.grossSalary === 0;

  const setField = useCallback((key: keyof EditorForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) setForm(f => ({ ...f, [key]: val }));
  }, []);

  const handleSave = async () => {
    if (isApproved) return;
    setIsSaving(true);
    try {
      const fields: Partial<Payslip> = {
        baseSalary: n(form.baseSalary),
        transportAllowance: n(form.transportAllowance),
        performanceBonus: n(form.performanceBonus),
        otherAllowances: n(form.otherAllowances),
        otherDeductions: otherDed,
        grossSalary: calc.grossSalary,
        cnasEmployee: calc.cnasEmployee,
        taxableGross: calc.taxableGross,
        irgAbatement: calc.irgAbatement,
        irgRetained: calc.irgRetained,
        netSalary: netToPay,
        cnasEmployer: calc.cnasEmployer,
        totalEmployerCost: calc.totalEmployerCost,
      };
      await financeService.updatePayslip(slip.id, fields);
      toast.success(tf('payslipSaved'));
      onSaved({ ...slip, ...fields });
    } catch {
      toast.error(tf('payslipSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    downloadPayslipPdf({
      filename: `bulletin-${slip.employeeName.replace(/\s+/g, '-')}-${slip.period}.pdf`,
      isRTL,
      currencyUnit: 'DA',
      configSnapshot: run.configSnapshot,
      labels: {
        payslip: tf('payslip'),
        employee: tf('employee'),
        matriculeLabel: tf('matriculeLabel'),
        ninLabel: tf('ninLabel'),
        cnasNumberLabel: tf('cnasNumberLabel'),
        earningsSectionLabel: tf('earningsSectionLabel'),
        baseSalary: tf('baseSalary'),
        transportAllowanceLabel: tf('transportAllowanceLabel'),
        payrollBonusLabel: tf('payrollBonusLabel'),
        otherAllowancesLabel: tf('otherAllowancesLabel'),
        grossSalary: tf('grossSalary'),
        deductionsSectionLabel: tf('deductionsSectionLabel'),
        cnasBaseLabel: tf('cnasBaseLabel'),
        cnasEmployee: tf('cnasEmployee'),
        taxableGross: tf('taxableGross'),
        irgBeforeRebateLabel: tf('irgBeforeRebateLabel'),
        irgRebateLabel: tf('irgRebateLabel'),
        irgAfterRebateLabel: tf('irgAfterRebateLabel'),
        irgRetained: tf('irgRetained'),
        irgExemptLabel: tf('irgExemptLabel'),
        otherDeductionsLabel: tf('otherDeductionsLabel'),
        employerCostSectionLabel: tf('employerCostSectionLabel'),
        cnasEmployerLabel: tf('cnasEmployerLabel'),
        employerCost: tf('employerCost'),
        payslipNetToPayLabel: tf('payslipNetToPayLabel'),
        payslipEmployerLabel: tf('payslipEmployerLabel'),
        payslipGeneratedOn: tf('payslipGeneratedOn'),
        payslipLegalNote: tf('payslipLegalNote'),
        payslipSignatureLabel: tf('payslipSignatureLabel'),
      },
      slip: {
        // Always use live-computed values — these match exactly what the editor shows on screen.
        // Using stored `slip` fields would show stale data if the user edited without saving.
        employeeName: slip.employeeName,
        period: slip.period,
        matricule: employee?.matricule,
        nin: employee?.nin,
        cnasNumber: employee?.cnasNumber,
        bankRIB: employee?.bankRIB,
        baseSalary: n(form.baseSalary),
        transportAllowance: n(form.transportAllowance),
        performanceBonus: n(form.performanceBonus),
        otherAllowances: n(form.otherAllowances),
        grossSalary: calc.grossSalary,
        cnasEmployee: calc.cnasEmployee,
        taxableGross: calc.taxableGross,
        irgAbatement: calc.irgAbatement,
        irgRetained: calc.irgRetained,
        otherDeductions: otherDed,
        netSalary: netToPay,
        cnasEmployer: calc.cnasEmployer,
        totalEmployerCost: calc.totalEmployerCost,
      },
    });
  };

  const inputClass = clsx(
    'w-full px-3 py-2 rounded-xl text-right font-bold transition-all outline-none',
    isApproved
      ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 cursor-not-allowed'
      : 'bg-slate-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-primary-500'
  );

  const Row: React.FC<{ label: string; value: React.ReactNode; color?: string }> = ({ label, value, color }) => (
    <div className={clsx('flex items-center justify-between py-2 text-sm', isRTL && 'flex-row-reverse')}>
      <span className={clsx('text-slate-500 dark:text-slate-400', isRTL && 'text-right')}>{label}</span>
      <span className={clsx('font-bold', color ?? 'text-slate-900 dark:text-white')}>{value}</span>
    </div>
  );

  const EditableRow: React.FC<{ label: string; fieldKey: keyof EditorForm }> = ({ label, fieldKey }) => (
    <div className={clsx('flex items-center gap-4 py-1', isRTL && 'flex-row-reverse')}>
      <span className={clsx('flex-1 text-sm text-slate-500 dark:text-slate-400', isRTL && 'text-right')}>{label}</span>
      <div className="w-36">
        <input
          type="text"
          inputMode="decimal"
          value={form[fieldKey]}
          onChange={setField(fieldKey)}
          disabled={isApproved}
          className={inputClass}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {tf('payslipEditorTitle')} — {slip.employeeName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {slip.period} · {isApproved ? tf('payslipEditorSubtitleApproved') : tf('payslipEditorSubtitleDraft')}
            </p>
          </div>
          <div className={clsx('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />{tf('printPayslip')}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Warnings */}
        {(warnNetBelowSmig || warnGrossZero) && (
          <div className="px-5 pt-3 space-y-2 shrink-0">
            {warnGrossZero && (
              <div className={clsx('flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold', isRTL && 'flex-row-reverse')}>
                <AlertTriangle className="w-4 h-4 shrink-0" />{tf('warningGrossZero')}
              </div>
            )}
            {warnNetBelowSmig && (
              <div className={clsx('flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-bold', isRTL && 'flex-row-reverse')}>
                <AlertTriangle className="w-4 h-4 shrink-0" />{tf('warningNetBelowSmig')}
              </div>
            )}
          </div>
        )}

        {/* Read-only notice */}
        {isApproved && (
          <div className={clsx('mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-bold shrink-0', isRTL && 'flex-row-reverse')}>
            <Lock className="w-3.5 h-3.5 shrink-0" />{tf('payslipReadOnly')}
          </div>
        )}

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{tf('employee')}</p>
              <p className="font-bold text-slate-900 dark:text-white truncate">{slip.employeeName}</p>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{tf('runPeriod')}</p>
              <p className="font-bold text-slate-900 dark:text-white">{slip.period}</p>
            </div>
            {employee?.matricule && (
              <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{tf('matriculeLabel')}</p>
                <p className="font-bold text-slate-900 dark:text-white">{employee.matricule}</p>
              </div>
            )}
            {employee?.bankRIB && (
              <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">RIB</p>
                <p className="font-bold text-slate-900 dark:text-white text-xs truncate">{employee.bankRIB}</p>
              </div>
            )}
          </div>

          {/* Earnings */}
          <div>
            <p className="text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-2">{tf('earningsSectionLabel')}</p>
            <div className="space-y-0.5">
              <EditableRow label={tf('baseSalaryCurrency')} fieldKey="baseSalary" />
              <EditableRow label={tf('transportAllowanceLabel')} fieldKey="transportAllowance" />
              <EditableRow label={tf('payrollBonusLabel')} fieldKey="performanceBonus" />
              <EditableRow label={tf('otherAllowancesLabel')} fieldKey="otherAllowances" />
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <Row label={tf('grossSalary')} value={formatCurrency(calc.grossSalary)} />
            </div>
          </div>

          {/* Mandatory deductions */}
          <div>
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-2">{tf('deductionsSectionLabel')}</p>
            <div className="divide-y divide-slate-50 dark:divide-white/5">
              <Row label={tf('cnasBaseLabel')} value={formatCurrency(calc.cnasBase)} />
              <Row label={tf('cnasEmployee')} value={formatCurrency(calc.cnasEmployee)} color="text-rose-600" />
              <Row label={tf('taxableGross')} value={formatCurrency(calc.taxableGross)} />
            </div>

            {/* IRG breakdown toggle */}
            <button
              onClick={() => setShowIrgBreakdown(v => !v)}
              className={clsx(
                'mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-primary-600 transition-colors',
                isRTL && 'flex-row-reverse'
              )}
            >
              {showIrgBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showIrgBreakdown ? tf('hideIrgBreakdown') : tf('showIrgBreakdown')}
            </button>

            {showIrgBreakdown && (
              <div className="mt-1 ml-3 pl-3 border-l-2 border-slate-100 dark:border-white/10 divide-y divide-slate-50 dark:divide-white/5">
                <Row label={tf('irgBeforeRebateLabel')} value={formatCurrency(calc.irgBeforeRebate)} />
                <Row label={tf('irgRebateLabel')} value={`– ${formatCurrency(calc.irgAbatement)}`} color="text-emerald-600" />
                <Row label={tf('irgAfterRebateLabel')} value={formatCurrency(calc.irgRetained)} color="text-rose-600" />
              </div>
            )}

            {!showIrgBreakdown && (
              <div className="mt-1 pt-1 border-t border-slate-50 dark:border-white/5">
                <Row label={tf('irgRetained')} value={formatCurrency(calc.irgRetained)} color="text-rose-600" />
              </div>
            )}
          </div>

          {/* Other deductions */}
          <div>
            <div className={clsx('flex items-center gap-4 py-1', isRTL && 'flex-row-reverse')}>
              <span className={clsx('flex-1 text-sm text-slate-500 dark:text-slate-400', isRTL && 'text-right')}>{tf('otherDeductionsLabel')}</span>
              <div className="w-36">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.otherDeductions}
                  onChange={setField('otherDeductions')}
                  disabled={isApproved}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Net to pay */}
          <div className={clsx(
            'flex items-center justify-between rounded-2xl px-5 py-4',
            warnNetBelowSmig ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20',
            isRTL && 'flex-row-reverse'
          )}>
            <span className={clsx('font-bold text-sm', warnNetBelowSmig ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>
              {tf('netToPay')}
            </span>
            <span className={clsx('font-bold text-2xl', warnNetBelowSmig ? 'text-amber-600' : 'text-emerald-600')}>
              {formatCurrency(netToPay)}
            </span>
          </div>

          {/* Employer cost */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{tf('employerCostSectionLabel')}</p>
            <div className="divide-y divide-slate-50 dark:divide-white/5">
              <Row label={tf('cnasEmployerLabel')} value={formatCurrency(calc.cnasEmployer)} color="text-slate-600 dark:text-slate-300" />
              <Row label={tf('totalEmployerCost')} value={formatCurrency(calc.totalEmployerCost)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        {!isApproved && (
          <div className="p-5 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-3 shrink-0 bg-slate-50 dark:bg-zinc-800/50">
            <button onClick={onClose} className="px-5 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors">
              {tf('cancel') || 'Annuler'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '…' : tf('saveDraftLabel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PAYROLL_ELIGIBLE_ROLES = new Set([
  'admin', 'manager', 'cashier', 'baker', 'delivery_guy', 'inventory',
]);

// ─── SalaryForm must live OUTSIDE Payroll to preserve input focus across renders ───
type SalaryFormValues = ReturnType<typeof emptyForm>;
const SalaryForm = ({
  form, setForm, tf,
}: {
  form: SalaryFormValues;
  setForm: React.Dispatch<React.SetStateAction<SalaryFormValues>>;
  tf: (key: string) => string;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-primary-600 uppercase tracking-widest">{tf('sectionAdministrative')}</h4>
      <div className="space-y-3">
        {[
          { key: 'matricule', label: 'matriculeLabel', placeholder: 'placeholderPayrollMatricule', numeric: false },
          { key: 'nin', label: 'ninLabel', placeholder: 'placeholderNationalId', numeric: true },
          { key: 'cnasNumber', label: 'cnasNumberLabel', placeholder: '', numeric: true },
        ].map(({ key, label, placeholder, numeric }) => (
          <div key={key}>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{tf(label)}</label>
            <input
              type="text"
              inputMode={numeric ? 'numeric' : 'text'}
              pattern={numeric ? '[0-9]*' : undefined}
              value={(form as any)[key]}
              onChange={e => { if (!numeric || /^\d*$/.test(e.target.value)) setForm(f => ({ ...f, [key]: e.target.value })); }}
              placeholder={placeholder ? tf(placeholder) : ''}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{tf('hireDateLabel')}</label>
          <input
            type="date"
            value={form.hireDate}
            onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
          />
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <h4 className="text-xs font-bold text-primary-600 uppercase tracking-widest">{tf('sectionFinancial')}</h4>
      <div className="space-y-3">
        {[
          { key: 'baseSalary', label: 'baseSalaryCurrency' },
          { key: 'transportAllowance', label: 'transportAllowanceLabel' },
          { key: 'performanceBonus', label: 'payrollBonusLabel' },
          { key: 'otherAllowances', label: 'otherAllowancesLabel' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{tf(label)}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={(form as any)[key]}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setForm(f => ({ ...f, [key]: e.target.value })); }}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
          </div>
        ))}
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
          <input
            type="checkbox"
            id="cnas-check"
            checked={form.contributesToCNAS}
            onChange={e => setForm(f => ({ ...f, contributesToCNAS: e.target.checked }))}
            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <label htmlFor="cnas-check" className="text-sm font-bold text-slate-700 dark:text-slate-200">{tf('payrollCnasLabel')}</label>
        </div>
      </div>
    </div>
  </div>
);

// ─── PayrollConfigAdmin ───────────────────────────────────────────────────────
// Admin screen for managing payroll configuration (IRG rates, CNAS rates, SNMG,
// company info). Each save creates a new versioned entry in Setting('payroll_config').
// The engine always reads the latest version; approved payslips use their configSnapshot.
// To add a new rate field: add it to PayrollConfig in types.ts, add i18n keys,
// add an input in the relevant section below, and include it in the save payload.
const PayrollConfigAdmin: React.FC = () => {
  const { tf, language } = useLanguage();
  const isRTL = language === 'ar';

  const [config, setConfig] = useState<PayrollConfig>(DEFAULT_PAYROLL_CONFIG);
  const [history, setHistory] = useState<import('../../types').PayrollConfigVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [detailVersion, setDetailVersion] = useState<import('../../types').PayrollConfigVersion | null>(null);
  const [trancheErrors, setTrancheErrors] = useState<Record<number, string>>({});

  // CNAS sub-rates (4 components that sum to cnasEmployeeRate)
  const DEFAULT_SUB = { assurances: 1.5, retraite: 6.75, chomage: 0.5, anticipee: 0.25 };
  const [subRates, setSubRates] = useState(DEFAULT_SUB);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setIsLoading(true);
    try {
      const [cfg, hist] = await Promise.all([
        financeService.getPayrollConfig(),
        financeService.getPayrollConfigHistory(),
      ]);
      setConfig(cfg);
      setHistory(hist);
      setSubRates({
        assurances: (cfg.cnasAssurancesSociales ?? 0.015) * 100,
        retraite:   (cfg.cnasRetraite ?? 0.0675) * 100,
        chomage:    (cfg.cnasAssuranceChomage ?? 0.005) * 100,
        anticipee:  (cfg.cnasRetraiteAnticipee ?? 0.0025) * 100,
      });
    } catch {
      toast.error(tf('payrollLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const set = <K extends keyof PayrollConfig>(key: K, val: PayrollConfig[K]) =>
    setConfig(c => ({ ...c, [key]: val }));

  const totalCnasPct =
    subRates.assurances + subRates.retraite + subRates.chomage + subRates.anticipee;

  // Tranche helpers
  const updateTranche = (idx: number, field: 'upTo' | 'rate', raw: string) => {
    const brackets = [...config.irgBrackets];
    if (field === 'upTo') {
      brackets[idx] = { ...brackets[idx], upTo: raw === '' ? null : (parseFloat(raw) || 0) };
    } else {
      brackets[idx] = { ...brackets[idx], rate: parseFloat(raw) / 100 || 0 };
    }
    set('irgBrackets', brackets);
  };

  const addTranche = () => {
    const brackets = [...config.irgBrackets];
    // Insert before last (unbounded) row
    const lastIdx = brackets.findIndex(b => b.upTo === null);
    const insertAt = lastIdx >= 0 ? lastIdx : brackets.length;
    brackets.splice(insertAt, 0, { upTo: 0, rate: 0 });
    set('irgBrackets', brackets);
  };

  const removeTranche = (idx: number) => {
    const brackets = config.irgBrackets.filter((_, i) => i !== idx);
    set('irgBrackets', brackets);
  };

  const validateTranches = (): boolean => {
    const errs: Record<number, string> = {};
    const bs = config.irgBrackets;
    if (bs.length === 0) { setTrancheErrors({}); return true; }

    if (bs[0].upTo !== null && bs[0].upTo !== 0) {
      // first bracket should start from 0 implicitly — we validate the upTo, not from
    }

    for (let i = 0; i < bs.length; i++) {
      const rate = bs[i].rate * 100;
      if (rate < 0 || rate > 100) errs[i] = tf('payrollConfigTrancheErrorRate');
    }
    // Check contiguity: each bracket starts where previous ended
    for (let i = 1; i < bs.length; i++) {
      const prev = bs[i - 1].upTo;
      if (prev === null) errs[i - 1] = tf('payrollConfigTrancheErrorNoUnbounded');
    }
    if (bs[bs.length - 1].upTo !== null) {
      errs[bs.length - 1] = tf('payrollConfigTrancheErrorNoUnbounded');
    }

    setTrancheErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateTranches()) return;
    setIsSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('bakery_user') || 'null');
      const finalConfig: PayrollConfig = {
        ...config,
        cnasAssurancesSociales: subRates.assurances / 100,
        cnasRetraite: subRates.retraite / 100,
        cnasAssuranceChomage: subRates.chomage / 100,
        cnasRetraiteAnticipee: subRates.anticipee / 100,
        cnasEmployeeRate: totalCnasPct / 100,
      };
      await financeService.savePayrollConfig(finalConfig, user?.name ?? 'Admin');
      toast.success(tf('payrollConfigSaved'));
      setConfig(finalConfig);
      const hist = await financeService.getPayrollConfigHistory();
      setHistory(hist);
    } catch {
      toast.error(tf('payrollConfigSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const numInput = (
    val: number | undefined,
    onChange: (v: number) => void,
    opts: { step?: number; min?: number } = {}
  ) => (
    <input
      type="number"
      step={opts.step ?? 1}
      min={opts.min ?? 0}
      value={val ?? ''}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
    />
  );

  const textInput = (val: string | undefined, onChange: (v: string) => void) => (
    <input
      type="text"
      value={val ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
    />
  );

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

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Warning banner */}
      <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">{tf('payrollConfigWarningBanner')}</p>
      </div>

      {/* SECTION 1 — SNMG */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
        {sectionTitle('payrollConfigSectionSnmg')}
        {fieldRow(tf('payrollConfigSnmgLabel'), numInput(config.snmg ?? 20000, v => set('snmg', v)), true)}
      </div>

      {/* SECTION 2 — IRG parameters */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
        {sectionTitle('payrollConfigSectionIrg')}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldRow(tf('payrollConfigIrgExemptionLabel'),
            numInput(config.irgExemptionThreshold ?? 10000, v => set('irgExemptionThreshold', v))
          )}
          {fieldRow(tf('payrollConfigAbatementRate'),
            numInput((config.irgRebateRate ?? 0.4) * 100, v => set('irgRebateRate', v / 100), { step: 0.1 })
          )}
          {fieldRow(tf('payrollConfigAbatementFloor'),
            numInput(config.irgRebateFloor ?? 0, v => set('irgRebateFloor', v))
          )}
          {fieldRow(tf('payrollConfigAbatementCap'),
            numInput(config.irgRebateCap ?? 1500, v => set('irgRebateCap', v))
          )}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            {tf('payrollConfigIrgSmoothingLabel')} / {tf('payrollConfigIrgSmoothingTo')}
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {numInput(config.irgSmoothingFrom ?? 10000, v => set('irgSmoothingFrom', v))}
            </div>
            <span className="text-sm text-slate-500">{tf('payrollConfigIrgSmoothingTo')}</span>
            <div className="flex-1">
              {numInput(config.irgSmoothingTo ?? 12000, v => set('irgSmoothingTo', v))}
            </div>
            <span className="text-xs text-slate-400">{tf('payrollConfigIrgSmoothingUnit')}</span>
          </div>
        </div>
      </div>

      {/* SECTION 3 — Cotisations salariales */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
        {sectionTitle('payrollConfigSectionCotisations')}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldRow(tf('payrollConfigCnasAssurances'),
            <input type="number" step={0.01} min={0} value={subRates.assurances}
              onChange={e => setSubRates(s => ({ ...s, assurances: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all" />
          )}
          {fieldRow(tf('payrollConfigCnasRetraite'),
            <input type="number" step={0.01} min={0} value={subRates.retraite}
              onChange={e => setSubRates(s => ({ ...s, retraite: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all" />
          )}
          {fieldRow(tf('payrollConfigCnasChomage'),
            <input type="number" step={0.01} min={0} value={subRates.chomage}
              onChange={e => setSubRates(s => ({ ...s, chomage: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all" />
          )}
          {fieldRow(tf('payrollConfigCnasRetraiteAnticipee'),
            <input type="number" step={0.01} min={0} value={subRates.anticipee}
              onChange={e => setSubRates(s => ({ ...s, anticipee: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all" />
          )}
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{tf('payrollConfigCnasTotal')}</span>
          <span className="text-sm font-bold text-primary-600">{totalCnasPct.toFixed(2)} %</span>
        </div>
      </div>

      {/* SECTION 4 — IRG tranches */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
        {sectionTitle('payrollConfigSectionTranches')}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="text-start py-2 pr-4">{tf('payrollConfigTrancheFrom')}</th>
                <th className="text-start py-2 pr-4">{tf('payrollConfigTrancheTo')}</th>
                <th className="text-start py-2 pr-4">{tf('payrollConfigTrancheRate')}</th>
                <th className="text-start py-2" />
              </tr>
            </thead>
            <tbody className="space-y-2">
              {config.irgBrackets.map((b, idx) => {
                const prevUpTo = idx === 0 ? 0 : (config.irgBrackets[idx - 1].upTo ?? '∞');
                return (
                  <tr key={idx} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400 text-sm">
                      {typeof prevUpTo === 'number' ? prevUpTo.toLocaleString() : prevUpTo}
                    </td>
                    <td className="py-2 pr-4">
                      {b.upTo === null ? (
                        <span className="text-slate-400 italic">{tf('payrollConfigTrancheUnbounded')}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={b.upTo}
                          onChange={e => updateTranche(idx, 'upTo', e.target.value)}
                          className="w-32 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={b.rate * 100}
                        onChange={e => updateTranche(idx, 'rate', e.target.value)}
                        className="w-24 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeTranche(idx)}
                        className="text-red-400 hover:text-red-600 text-xs font-bold"
                      >
                        {tf('payrollConfigRemoveTranche')}
                      </button>
                    </td>
                    {trancheErrors[idx] && (
                      <td colSpan={4} className="pb-2 text-xs text-red-500">{trancheErrors[idx]}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          onClick={addTranche}
          className="flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
        >
          <Plus className="w-4 h-4" />
          {tf('payrollConfigAddTranche')}
        </button>
      </div>

      {/* SECTION — Company info */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
        {sectionTitle('payrollConfigSectionCompany')}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldRow(tf('payrollConfigCompanyName'), textInput(config.companyName, v => set('companyName', v)))}
          {fieldRow(tf('payrollConfigCompanyAddress'), textInput(config.companyAddress, v => set('companyAddress', v)))}
          {fieldRow(tf('payrollConfigNif'), textInput(config.nif, v => set('nif', v)))}
          {fieldRow(tf('payrollConfigNis'), textInput(config.nis, v => set('nis', v)))}
          {fieldRow(tf('payrollConfigRc'), textInput(config.rc, v => set('rc', v)))}
          {fieldRow(tf('payrollConfigCnasReg'), textInput(config.cnasRegistration, v => set('cnasRegistration', v)))}
        </div>
        <div className="pt-4 border-t border-slate-100 dark:border-white/10">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">{tf('payslipFooterInfo') || 'Informations du pied de page'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldRow(tf('payrollConfigShopPhone') || 'Téléphone', textInput(config.shopPhone, v => set('shopPhone', v)))}
            {fieldRow(tf('payrollConfigShopEmail') || 'Email', textInput(config.shopEmail, v => set('shopEmail', v)))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '…' : tf('payrollConfigSaveButton')}
        </button>
      </div>

      {/* SECTION 5 — History */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 space-y-4">
        {sectionTitle('payrollConfigSectionHistory')}
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">{tf('payrollConfigHistoryEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                  <th className="text-start py-2 pr-4">{tf('payrollConfigHistoryVersion')}</th>
                  <th className="text-start py-2 pr-4">{tf('payrollConfigHistoryDate')}</th>
                  <th className="text-start py-2 pr-4">{tf('payrollConfigHistorySavedBy')}</th>
                  <th className="text-start py-2">{tf('payrollConfigHistoryActions')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map(v => (
                  <tr key={v.version} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                    <td className="py-2 pr-4 font-mono text-xs text-slate-500">v{v.version}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300 text-xs">
                      {new Date(v.savedAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300 text-xs">{v.savedBy}</td>
                    <td className="py-2">
                      <button
                        onClick={() => setDetailVersion(v)}
                        className="text-primary-600 hover:text-primary-700 text-xs font-bold"
                      >
                        {tf('payrollConfigHistoryView')}
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
                {tf('payrollConfigDetailTitle')} — v{detailVersion.version}
              </h2>
              <button onClick={() => setDetailVersion(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="text-xs text-slate-400 mb-2">
                {new Date(detailVersion.savedAt).toLocaleString()} — {detailVersion.savedBy}
              </div>
              <pre className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(detailVersion.config, null, 2)}
              </pre>
            </div>
            <div className="p-6 pt-0 flex justify-end">
              <button
                onClick={() => setDetailVersion(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
              >
                {tf('payrollConfigClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Employee form fields ────────────────────────────────────────────────────
const emptyForm = () => ({
  matricule: '',
  nin: '',
  cnasNumber: '',
  department: '',
  hireDate: format(new Date(), 'yyyy-MM-dd'),
  baseSalary: '',
  transportAllowance: '',
  performanceBonus: '',
  otherAllowances: '',
  contributesToCNAS: true,
  bankRIB: '',
});

const Payroll: React.FC = () => {
  const { formatCurrency, tf, t } = useLanguage();
  const tx = (key: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), tf(key));

  // ── Sub-tab ────────────────────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState('employees');

  // ── Employee data ──────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<FinancialEmployee[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeePage, setEmployeePage] = useState(1);

  // ── Add employee modal ─────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<'select-user' | 'salary-details'>('select-user');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [addForm, setAddForm] = useState(emptyForm());

  // ── Edit employee modal ────────────────────────────────────────────────────
  const [editingEmployee, setEditingEmployee] = useState<FinancialEmployee | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());

  // ── Payroll runs ───────────────────────────────────────────────────────────
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // ── New run modal (3-step) ─────────────────────────────────────────────────
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runStep, setRunStep] = useState<1 | 2 | 3>(1);
  const [runPeriod, setRunPeriod] = useState(format(new Date(), 'yyyy-MM'));
  const [runAdjustments, setRunAdjustments] = useState<Record<string, { bonus: number; other: number }>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  // ── Run detail view ────────────────────────────────────────────────────────
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [runPayslips, setRunPayslips] = useState<Payslip[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);

  // ── Payslip editor ─────────────────────────────────────────────────────────
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedEmployees, fetchedUsers] = await Promise.all([
        financeService.getFinancialEmployees(),
        financeService.getAllUsers(),
      ]);
      setEmployees(fetchedEmployees);
      setUsers(fetchedUsers);
    } catch {
      toast.error(tf('payrollLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRuns = async () => {
    setRunsLoading(true);
    try {
      const data = await financeService.getPayrollRuns();
      setRuns(data.sort((a, b) => b.period.localeCompare(a.period)));
    } catch {
      toast.error(tf('payrollLoadFailed'));
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'runs') fetchRuns();
  }, [activeSubTab]);

  // ── Employee list filtering ────────────────────────────────────────────────
  const filteredEmployees = useMemo(() =>
    employees.filter(emp =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.matricule ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [employees, searchQuery]);

  useEffect(() => { setEmployeePage(1); }, [searchQuery]);

  const empTotalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE) || 1;
  const safeEmpPage = Math.min(employeePage, empTotalPages);
  const paginatedEmployees = filteredEmployees.slice(
    (safeEmpPage - 1) * PAGE_SIZE, safeEmpPage * PAGE_SIZE
  );

  // ── Available users for add modal ──────────────────────────────────────────
  const availableUsers = useMemo(() => {
    const employeeIds = new Set(employees.map(e => e.id));
    return users
      .filter(u =>
        PAYROLL_ELIGIBLE_ROLES.has(u.role) &&
        !employeeIds.has(u.id) &&
        (u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.role.toLowerCase().includes(userSearchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return 1;
        if (a.role !== 'admin' && b.role === 'admin') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [users, employees, userSearchQuery]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USERS_PER_PAGE;
    return availableUsers.slice(start, start + USERS_PER_PAGE);
  }, [availableUsers, userPage]);

  const totalUserPages = Math.ceil(availableUsers.length / USERS_PER_PAGE);

  // ── Add employee ───────────────────────────────────────────────────────────
  const handleAddEmployee = async () => {
    if (!selectedUser) return;
    try {
      await financeService.addFinancialEmployee({
        id: selectedUser.id,
        name: selectedUser.name,
        role: selectedUser.role,
        email: selectedUser.email,
        phone: selectedUser.phone,
        status: 'ACTIF',
        matricule: addForm.matricule.trim(),
        nin: addForm.nin,
        cnasNumber: addForm.cnasNumber,
        department: addForm.department,
        hireDate: addForm.hireDate,
        baseSalary: Number(addForm.baseSalary) || 0,
        transportAllowance: Number(addForm.transportAllowance) || 0,
        performanceBonus: Number(addForm.performanceBonus) || 0,
        otherAllowances: Number(addForm.otherAllowances) || 0,
        contributesToCNAS: addForm.contributesToCNAS,
        bankRIB: addForm.bankRIB,
      });
      toast.success(tf('payrollEmployeeAdded'));
      setIsAddModalOpen(false);
      resetAddModal();
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      toast.error(msg.trim() ? msg.slice(0, 280) : tf('payrollEmployeeAddFailed'));
    }
  };

  const resetAddModal = () => {
    setAddStep('select-user');
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserPage(1);
    setAddForm(emptyForm());
  };

  // ── Edit employee ──────────────────────────────────────────────────────────
  const openEdit = (emp: FinancialEmployee) => {
    setEditingEmployee(emp);
    setEditForm({
      matricule: emp.matricule ?? '',
      nin: emp.nin ?? '',
      cnasNumber: emp.cnasNumber ?? '',
      department: emp.department ?? '',
      hireDate: emp.hireDate
        ? emp.hireDate.substring(0, 10)
        : format(new Date(), 'yyyy-MM-dd'),
      baseSalary: String(emp.baseSalary ?? ''),
      transportAllowance: String(emp.transportAllowance ?? ''),
      performanceBonus: String(emp.performanceBonus ?? ''),
      otherAllowances: String(emp.otherAllowances ?? ''),
      contributesToCNAS: emp.contributesToCNAS !== false,
      bankRIB: emp.bankRIB ?? '',
    });
  };

  const handleEditEmployee = async () => {
    if (!editingEmployee) return;
    try {
      await financeService.updateFinancialEmployee(editingEmployee.id, {
        matricule: editForm.matricule.trim(),
        nin: editForm.nin,
        cnasNumber: editForm.cnasNumber,
        department: editForm.department,
        hireDate: editForm.hireDate,
        baseSalary: Number(editForm.baseSalary) || 0,
        transportAllowance: Number(editForm.transportAllowance) || 0,
        performanceBonus: Number(editForm.performanceBonus) || 0,
        otherAllowances: Number(editForm.otherAllowances) || 0,
        contributesToCNAS: editForm.contributesToCNAS,
        bankRIB: editForm.bankRIB,
      });
      toast.success(tf('payrollEmployeeAdded'));
      setEditingEmployee(null);
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      toast.error(msg.trim() ? msg.slice(0, 280) : tf('payrollEmployeeAddFailed'));
    }
  };

  // ── New run ────────────────────────────────────────────────────────────────
  const openNewRun = () => {
    setRunStep(1);
    setRunPeriod(format(new Date(), 'yyyy-MM'));
    setRunAdjustments({});
    setIsRunModalOpen(true);
  };

  const activeEmployees = employees.filter(e => e.status === 'ACTIF');

  const getAdj = (id: string) => runAdjustments[id] ?? { bonus: 0, other: 0 };
  const setAdj = (id: string, field: 'bonus' | 'other', value: number) =>
    setRunAdjustments(prev => ({ ...prev, [id]: { ...getAdj(id), [field]: value } }));

  const runPreview = useMemo(() =>
    activeEmployees.map(emp => {
      const adj = getAdj(emp.id);
      const calc = financeService.calculatePayroll(
        emp.baseSalary,
        emp.transportAllowance ?? 0,
        (emp.performanceBonus ?? 0) + adj.bonus,
        (emp.otherAllowances ?? 0) + adj.other,
      );
      return { emp, calc };
    }), [activeEmployees, runAdjustments]);

  const runTotals = useMemo(() => ({
    gross: runPreview.reduce((s, r) => s + r.calc.gross, 0),
    cnas:  runPreview.reduce((s, r) => s + r.calc.cnasEmployee, 0),
    irg:   runPreview.reduce((s, r) => s + r.calc.irg, 0),
    net:   runPreview.reduce((s, r) => s + r.calc.net, 0),
    cost:  runPreview.reduce((s, r) => s + r.calc.totalEmployerCost, 0),
  }), [runPreview]);

  const executeRun = async () => {
    setIsExecuting(true);
    try {
      await financeService.createPayrollRun(runPeriod, activeEmployees, runAdjustments);
      toast.success(tf('runPayroll'));
      setIsRunModalOpen(false);
      fetchRuns();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      toast.error(msg || tf('payrollLoadFailed'));
    } finally {
      setIsExecuting(false);
    }
  };

  // ── Run detail ─────────────────────────────────────────────────────────────
  const openRunDetail = async (run: PayrollRun) => {
    setSelectedRun(run);
    setPayslipsLoading(true);
    try {
      const slips = await financeService.getPayslipsForRun(run.id);
      setRunPayslips(slips);
    } catch {
      toast.error(tf('payrollLoadFailed'));
    } finally {
      setPayslipsLoading(false);
    }
  };

  const approveRun = async () => {
    if (!selectedRun) return;
    const user = JSON.parse(localStorage.getItem('bakery_user') || 'null');
    try {
      await financeService.approvePayrollRun(selectedRun.id, user?.name ?? 'Admin');
      toast.success(tf('approveRun'));
      setSelectedRun(prev => prev ? { ...prev, status: 'APPROUVÉ' } : prev);
      fetchRuns();
    } catch {
      toast.error(tf('payrollLoadFailed'));
    }
  };

  const exportCsv = () => {
    if (!selectedRun || !runPayslips.length) return;
    const headers = [
      'Nom', 'Période', 'Base', 'Transport', 'Prime', 'Autres',
      'Brut', 'CNAS Salarié', 'Brut Imposable', 'IRG', 'Net', 'Coût Employeur',
    ];
    const rows = runPayslips.map(p => [
      p.employeeName, p.period, p.baseSalary, p.transportAllowance,
      p.performanceBonus, p.otherAllowances, p.grossSalary,
      p.cnasEmployee, p.taxableGross, p.irgRetained, p.netSalary, p.totalEmployerCost,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${selectedRun.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        {['employees', 'runs'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={clsx(
              'pb-3 text-sm font-bold transition-all relative',
              activeSubTab === tab
                ? 'text-primary-600'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <BilingualLabel tKey={tab === 'employees' ? 'financeEmployees' : 'financePayrollRuns'} tf />
            {activeSubTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {activeSubTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={tf('searchEmployees')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
            >
              <Plus className="w-5 h-5" />
              <BilingualLabel tKey="addEmployee" tf />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedEmployees.map(emp => {
                  const payroll = financeService.calculatePayroll(
                    emp.baseSalary,
                    emp.transportAllowance ?? 0,
                    (emp.performanceBonus ?? 0) + (emp.otherAllowances ?? 0),
                  );
                  return (
                    <div key={emp.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">{emp.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{emp.role}</p>
                          </div>
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400 group-hover:text-primary-600 transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 dark:border-white/5">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{tf('baseSalary')}</p>
                          <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(emp.baseSalary)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{tf('netToPay')}</p>
                          <p className="font-bold text-emerald-600">{formatCurrency(payroll.net)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{tf('payrollCnasShort')}</p>
                          <p className="font-bold text-rose-600">{formatCurrency(payroll.cnasEmployee)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{tf('irg')}</p>
                          <p className="font-bold text-rose-600">{formatCurrency(payroll.irg)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {emp.status === 'ACTIF' ? tf('empStatusActive') : emp.status}
                          </span>
                        </div>
                        <button
                          onClick={() => openEdit(emp)}
                          className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                          title={tf('editEmployee')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination
                currentPage={safeEmpPage}
                totalPages={Math.ceil(filteredEmployees.length / PAGE_SIZE)}
                onPageChange={setEmployeePage}
              />
            </>
          )}
        </div>
      )}

      {/* ── RUNS TAB ── */}
      {activeSubTab === 'runs' && !selectedRun && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {runs.length} {tf('financePayrollRuns')}
            </p>
            <button
              onClick={openNewRun}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
            >
              <Plus className="w-5 h-5" />
              <BilingualLabel tKey="newRun" tf />
            </button>
          </div>

          {runsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Calculator className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium">{tf('noPayrollRuns')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-zinc-800 text-xs uppercase font-bold text-slate-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-3 text-left">{tf('runPeriod')}</th>
                    <th className="px-6 py-3 text-left">{tf('financeEmployees')}</th>
                    <th className="px-6 py-3 text-right">{tf('totalNet')}</th>
                    <th className="px-6 py-3 text-center">{tf('status')}</th>
                    <th className="px-6 py-3 text-center">{tf('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {runs.map(run => (
                    <tr key={run.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{run.period}</td>
                      <td className="px-6 py-4 text-slate-500">{run.employeeCount}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(run.totalNet)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={clsx(
                          'px-2 py-1 rounded-full text-xs font-bold',
                          run.status === 'APPROUVÉ'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                        )}>
                          {run.status === 'APPROUVÉ' ? tf('approved') : tf('draft')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openRunDetail(run)}
                          className="px-3 py-1 text-xs font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          {tf('viewRun')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── RUN DETAIL ── */}
      {activeSubTab === 'runs' && selectedRun && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedRun(null)}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {tf('financePayrollRuns')}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-zinc-800 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                {tf('exportCsv')}
              </button>
              {selectedRun.status !== 'APPROUVÉ' && (
                <button
                  onClick={approveRun}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {tf('approveRun')}
                </button>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'totalGross', value: selectedRun.totalGross, color: 'text-slate-900 dark:text-white' },
              { label: 'totalCnas',  value: selectedRun.totalCNAS,  color: 'text-rose-600' },
              { label: 'totalIrg',   value: selectedRun.totalIRG,   color: 'text-rose-600' },
              { label: 'totalNet',   value: selectedRun.totalNet,   color: 'text-emerald-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-white/10">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">{tf(label)}</p>
                <p className={`font-bold text-lg ${color}`}>{formatCurrency(value ?? 0)}</p>
              </div>
            ))}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-white/10">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">{tf('status')}</p>
              <span className={clsx(
                'px-2 py-1 rounded-full text-xs font-bold',
                selectedRun.status === 'APPROUVÉ'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
              )}>
                {selectedRun.status === 'APPROUVÉ' ? tf('approved') : tf('draft')}
              </span>
            </div>
          </div>

          {/* Payslip table */}
          {payslipsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-zinc-800 text-xs uppercase font-bold text-slate-400 tracking-widest">
                  <tr>
                    <th className="px-4 py-3 text-left">{tf('employee')}</th>
                    <th className="px-4 py-3 text-right">{tf('grossSalary')}</th>
                    <th className="px-4 py-3 text-right">{tf('cnasEmployee')}</th>
                    <th className="px-4 py-3 text-right">{tf('irgRetained')}</th>
                    <th className="px-4 py-3 text-right">{tf('netSalary')}</th>
                    <th className="px-4 py-3 text-center">{tf('payslip')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {runPayslips.map(slip => (
                    <tr key={slip.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{slip.employeeName}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(slip.grossSalary)}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(slip.cnasEmployee)}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(slip.irgRetained)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(slip.netSalary)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setEditingPayslip(slip)}
                          className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                          title={tf('printPayslip')}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ADD EMPLOYEE MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {addStep === 'select-user' ? tf('payrollModalSelectUser') : tf('payrollModalSalaryDetails')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {addStep === 'select-user'
                    ? tf('payrollModalSelectHint')
                    : tx('payrollConfiguringFor', { name: selectedUser?.name ?? '' })}
                </p>
              </div>
              <button onClick={() => { setIsAddModalOpen(false); resetAddModal(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {addStep === 'select-user' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={tf('searchUsersPayroll')}
                      value={userSearchQuery}
                      onChange={e => { setUserSearchQuery(e.target.value); setUserPage(1); }}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {paginatedUsers.length > 0 ? (
                      <>
                        {paginatedUsers.map(user => (
                          <button
                            key={user.id}
                            onClick={() => { setSelectedUser(user); setAddStep('salary-details'); }}
                            className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all text-left group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:text-primary-600 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-all">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user.role}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 transition-colors" />
                          </button>
                        ))}
                        {totalUserPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                              {tx('payrollPageIndicator', { current: String(userPage), total: String(totalUserPages) })}
                            </p>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1} className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg disabled:opacity-50 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                              <button onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))} disabled={userPage === totalUserPages} className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg disabled:opacity-50 transition-all"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-10 text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>{users.length === 0 ? tf('payrollNoUsersInSystem') : availableUsers.length === 0 ? tf('payrollAllEnrolled') : tf('payrollNoSearchResults')}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <SalaryForm form={addForm} setForm={setAddForm} tf={tf} />
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between">
              {addStep === 'salary-details' ? (
                <button onClick={() => setAddStep('select-user')} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />{tf('payrollBack')}
                </button>
              ) : <div />}
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsAddModalOpen(false); resetAddModal(); }} className="px-6 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors">{t('cancel')}</button>
                {addStep === 'salary-details' && (
                  <button onClick={handleAddEmployee} className="px-8 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />{tf('payrollCompleteSetup')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          EDIT EMPLOYEE MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{tf('editEmployee')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{editingEmployee.name}</p>
              </div>
              <button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <SalaryForm form={editForm} setForm={setEditForm} tf={tf} />
            </div>
            <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-end gap-3">
              <button onClick={() => setEditingEmployee(null)} className="px-6 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors">{t('cancel')}</button>
              <button onClick={handleEditEmployee} className="px-8 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20">
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          NEW RUN MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{tf('newRun')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {runStep === 1 ? tf('selectPeriod') : runStep === 2 ? tf('reviewAdjust') : tf('runSummary')}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Step indicator */}
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={clsx(
                      'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center',
                      runStep === s ? 'bg-primary-600 text-white' : runStep > s ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'
                    )}>{s}</div>
                  ))}
                </div>
                <button onClick={() => setIsRunModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto">
              {/* Step 1 — Period */}
              {runStep === 1 && (
                <div className="space-y-6 max-w-sm mx-auto">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{tf('runPeriod')}</label>
                    <input
                      type="month"
                      value={runPeriod}
                      onChange={e => setRunPeriod(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-lg font-bold"
                    />
                  </div>
                  <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl">
                    <p className="text-sm text-primary-700 dark:text-primary-300 font-bold">{activeEmployees.length} {tf('financeEmployees')}</p>
                  </div>
                </div>
              )}

              {/* Step 2 — Adjust */}
              {runStep === 2 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-zinc-800 text-xs uppercase font-bold text-slate-400 tracking-widest">
                      <tr>
                        <th className="px-4 py-3 text-left">{tf('employee')}</th>
                        <th className="px-4 py-3 text-right">{tf('baseSalary')}</th>
                        <th className="px-4 py-3 text-right">{tf('transportAllowanceLabel')}</th>
                        <th className="px-4 py-3 text-right">{tf('runBonus')}</th>
                        <th className="px-4 py-3 text-right">{tf('runOther')}</th>
                        <th className="px-4 py-3 text-right">{tf('netSalary')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {runPreview.map(({ emp, calc }) => (
                        <tr key={emp.id}>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{emp.name}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(emp.baseSalary)}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(emp.transportAllowance ?? 0)}</td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={getAdj(emp.id).bonus}
                              onChange={e => { if (/^\d*$/.test(e.target.value)) setAdj(emp.id, 'bonus', Number(e.target.value)); }}
                              className="w-24 px-2 py-1 text-right bg-slate-50 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={getAdj(emp.id).other}
                              onChange={e => { if (/^\d*$/.test(e.target.value)) setAdj(emp.id, 'other', Number(e.target.value)); }}
                              className="w-24 px-2 py-1 text-right bg-slate-50 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(calc.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Step 3 — Summary */}
              {runStep === 3 && (
                <div className="space-y-6 max-w-lg mx-auto">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'totalGross', value: runTotals.gross },
                      { label: 'totalCnas',  value: runTotals.cnas },
                      { label: 'totalIrg',   value: runTotals.irg },
                      { label: 'totalNet',   value: runTotals.net },
                      { label: 'totalEmployerCost', value: runTotals.cost },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">{tf(label)}</p>
                        <p className="font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-sm text-amber-700 dark:text-amber-300 font-medium">
                    {activeEmployees.length} {tf('financeEmployees')} · {runPeriod}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between">
              {runStep > 1 ? (
                <button onClick={() => setRunStep(s => (s - 1) as 1 | 2 | 3)} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />{tf('payrollBack')}
                </button>
              ) : <div />}
              <div className="flex items-center gap-3">
                <button onClick={() => setIsRunModalOpen(false)} className="px-6 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors">{t('cancel')}</button>
                {runStep < 3 ? (
                  <button
                    onClick={() => setRunStep(s => (s + 1) as 2 | 3)}
                    disabled={runStep === 1 && activeEmployees.length === 0}
                    className="px-8 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {tf('payrollBack') ? '' : ''}{tf('next') || 'Suivant'}<ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={executeRun}
                    disabled={isExecuting}
                    className="px-8 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Calculator className="w-5 h-5" />
                    {isExecuting ? '...' : tf('executeRun')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          PAYSLIP EDITOR
      ═════════════════════════════════════════════════════════════════════ */}
      {editingPayslip && selectedRun && (
        <PayslipEditor
          slip={editingPayslip}
          run={selectedRun}
          employee={employees.find(e => e.id === editingPayslip.employeeId)}
          onClose={() => setEditingPayslip(null)}
          onSaved={(updated) => {
            setRunPayslips(prev => prev.map(s => s.id === updated.id ? updated : s));
            setEditingPayslip(updated);
          }}
        />
      )}
    </div>
  );
};

export default Payroll;
