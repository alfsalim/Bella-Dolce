import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { financeService } from '../../services/financeService';
import { FinancialEmployee, PayrollRun, Payslip, UserProfile } from '../../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { PAGE_SIZE } from '../../constants';
import Pagination from '../../components/Pagination';
import { downloadPayslipPdf } from '../../lib/export';

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

  // ── Payslip print modal ────────────────────────────────────────────────────
  const [printPayslip, setPrintPayslip] = useState<Payslip | null>(null);

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
              { label: 'totalCnas',  value: (selectedRun as any).totalCNAS ?? selectedRun.totalCNASEmployee,  color: 'text-rose-600' },
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
                          onClick={() => setPrintPayslip(slip)}
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
          PAYSLIP PRINT MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      {printPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{tf('payslip')}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const emp = employees.find(e => e.id === printPayslip.employeeId);
                    downloadPayslipPdf({
                      filename: `bulletin-${printPayslip.employeeName.replace(/\s+/g, '-')}-${printPayslip.period}.pdf`,
                      currencyUnit: 'DA',
                      labels: {
                        payslip: tf('payslip'),
                        employee: tf('employee'),
                        matriculeLabel: tf('matriculeLabel'),
                        ninLabel: tf('ninLabel'),
                        sectionFinancial: tf('sectionFinancial'),
                        baseSalary: tf('baseSalary'),
                        transportAllowanceLabel: tf('transportAllowanceLabel'),
                        payrollBonusLabel: tf('payrollBonusLabel'),
                        otherAllowancesLabel: tf('otherAllowancesLabel'),
                        grossSalary: tf('grossSalary'),
                        deductions: tf('deductions'),
                        cnasEmployee: tf('cnasEmployee'),
                        taxableGross: tf('taxableGross'),
                        irgRetained: tf('irgRetained'),
                        netSalary: tf('netSalary'),
                        employerCost: tf('employerCost'),
                      },
                      slip: {
                        ...printPayslip,
                        matricule: emp?.matricule,
                        nin: emp?.nin,
                      },
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
                >
                  <Download className="w-4 h-4" />{tf('printPayslip')}
                </button>
                <button onClick={() => setPrintPayslip(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 print:p-0">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">{tf('employee')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{printPayslip.employeeName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">{tf('runPeriod')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{printPayslip.period}</span>
              </div>
              <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-2">
                <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">{tf('sectionFinancial')}</p>
                {[
                  { label: 'baseSalary',           value: printPayslip.baseSalary },
                  { label: 'transportAllowanceLabel', value: printPayslip.transportAllowance },
                  { label: 'payrollBonusLabel',     value: printPayslip.performanceBonus },
                  { label: 'otherAllowancesLabel',  value: printPayslip.otherAllowances },
                  { label: 'grossSalary',           value: printPayslip.grossSalary },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{tf(label)}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-2">
                <p className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-2">{tf('deductions') || 'Déductions'}</p>
                {[
                  { label: 'cnasEmployee', value: printPayslip.cnasEmployee },
                  { label: 'taxableGross', value: printPayslip.taxableGross },
                  { label: 'irgRetained',  value: printPayslip.irgRetained },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{tf(label)}</span>
                    <span className="font-bold text-rose-600">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t-2 border-slate-200 dark:border-white/20 pt-4">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{tf('netSalary')}</span>
                  <span className="font-bold text-xl text-emerald-600">{formatCurrency(printPayslip.netSalary)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-500">{tf('employerCost')}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(printPayslip.totalEmployerCost)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
