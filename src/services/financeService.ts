import {
  Account,
  JournalEntry,
  JournalLine,
  JournalStatus,
  FinancialEmployee,
  UserProfile,
  PayrollRun,
  Payslip,
  PayrollConfig,
  PayrollConfigVersion,
} from '../types';
import { authFetch, getAuthHeaders, readApiErrorMessage } from '../lib/api-client';
import { format } from 'date-fns';
import { DEFAULT_PAYROLL_CONFIG, calculatePayslip } from '../lib/payrollEngine';

export const financeService = {
  // Account Management
  async getAccounts(): Promise<Account[]> {
    const res = await authFetch('/api/db/accounts', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch accounts');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async createAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<string> {
    const res = await authFetch('/api/db/accounts', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.id;
  },

  // Journal Entries
  async createJournalEntry(
    entry: Omit<JournalEntry, 'id' | 'createdAt' | 'number'>,
    lines: Omit<JournalLine, 'id' | 'journalId' | 'createdAt'>[]
  ): Promise<string> {
    const res = await authFetch('/api/finance/journal', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry, lines }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.id;
  },

  async getJournalEntries(period?: string): Promise<JournalEntry[]> {
    const params = period ? `?where=${encodeURIComponent(JSON.stringify({ period }))}` : '';
    const res = await authFetch(`/api/db/journalEntries${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch journal entries');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async getJournalLines(journalId: string): Promise<JournalLine[]> {
    const params = `?where=${encodeURIComponent(JSON.stringify({ journalId }))}`;
    const res = await authFetch(`/api/db/journalLines${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch journal lines');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async getAccountBalances(period?: string): Promise<{ accountNumber: string; totalDebit: number; totalCredit: number }[]> {
    const params = period ? `?period=${encodeURIComponent(period)}` : '';
    const res = await authFetch(`/api/finance/balances${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch balances');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  // Automatic Journal Entry for Sales (CASH ONLY)
  async createSaleJournalEntry(saleId: string, totalAmount: number, tvaAmount: number) {
    const period = format(new Date(), 'yyyy-MM');
    const date = format(new Date(), 'yyyy-MM-dd');
    
    const lines: Omit<JournalLine, 'id' | 'journalId' | 'createdAt'>[] = [
      {
        accountNumber: '1101', // Caisse Principale
        debit: totalAmount,
        credit: 0,
        label: `Vente POS ${saleId}`
      },
      {
        accountNumber: '4001', // Ventes (assuming bread for simplicity)
        debit: 0,
        credit: totalAmount - tvaAmount,
        label: `Vente POS ${saleId}`
      },
      {
        accountNumber: '2301', // TVA Collectée
        debit: 0,
        credit: tvaAmount,
        label: `TVA Vente POS ${saleId}`
      }
    ];

    return this.createJournalEntry({
      date,
      period,
      label: `Vente POS ${saleId}`,
      sourceModule: 'POS',
      sourceId: saleId,
      status: 'COMPTABILISÉ',
      createdBy: JSON.parse(localStorage.getItem('bakery_user') || 'null')?.id || 'system'
    }, lines);
  },

  // Payroll Config (Setting id: 'payroll_config')
  // data shape: { current: PayrollConfig, history: PayrollConfigVersion[] }
  // Falls back to flat PayrollConfig for backwards compatibility.
  async getPayrollConfig(): Promise<PayrollConfig> {
    try {
      const res = await authFetch('/api/db/settings/payroll_config', { headers: getAuthHeaders() });
      if (!res.ok) return DEFAULT_PAYROLL_CONFIG;
      const setting = await res.json();
      const parsed = JSON.parse(setting.data);
      // new format
      if (parsed && parsed.current) return { ...DEFAULT_PAYROLL_CONFIG, ...parsed.current };
      // legacy flat format
      return { ...DEFAULT_PAYROLL_CONFIG, ...parsed };
    } catch {
      return DEFAULT_PAYROLL_CONFIG;
    }
  },

  async getPayrollConfigHistory(): Promise<PayrollConfigVersion[]> {
    try {
      const res = await authFetch('/api/db/settings/payroll_config', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const setting = await res.json();
      const parsed = JSON.parse(setting.data);
      return parsed?.history ?? [];
    } catch {
      return [];
    }
  },

  async savePayrollConfig(config: PayrollConfig, savedBy: string): Promise<void> {
    // Load existing history first
    let history: PayrollConfigVersion[] = [];
    try {
      const res = await authFetch('/api/db/settings/payroll_config', { headers: getAuthHeaders() });
      if (res.ok) {
        const setting = await res.json();
        const parsed = JSON.parse(setting.data);
        history = parsed?.history ?? [];
      }
    } catch { /* first save */ }

    const nextVersion = history.length > 0 ? history[0].version + 1 : 1;
    const newEntry: PayrollConfigVersion = {
      version: nextVersion,
      savedAt: new Date().toISOString(),
      savedBy,
      config,
    };
    const newHistory = [newEntry, ...history];
    const data = JSON.stringify({ current: config, history: newHistory });

    const res = await authFetch('/api/db/settings/payroll_config', {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'payroll_config', data }),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Financial Employee Management
  async getFinancialEmployees(): Promise<FinancialEmployee[]> {
    const res = await authFetch('/api/db/financialEmployees', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch employees');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async addFinancialEmployee(employee: Omit<FinancialEmployee, 'createdAt'>): Promise<string> {
    const matriculeTrim = employee.matricule?.trim();
    const payload = {
      ...employee,
      matricule: matriculeTrim || `EMP-${String(employee.id).replace(/-/g, '')}`,
      contributesToCNAS: employee.contributesToCNAS !== false,
      status: employee.status ?? 'ACTIF',
    };
    const res = await authFetch('/api/db/financialEmployees', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.id;
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const res = await authFetch('/api/db/users', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async updateFinancialEmployee(id: string, data: Partial<FinancialEmployee>): Promise<void> {
    const res = await authFetch(`/api/db/financialEmployees/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async getPayrollRuns(): Promise<PayrollRun[]> {
    const res = await authFetch('/api/db/payrollRuns', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch payroll runs');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async getPayslipsForRun(runId: string): Promise<Payslip[]> {
    const res = await authFetch(`/api/db/payslips?runId=${runId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch payslips');
    const data = await res.json();
    return (Array.isArray(data) ? data : []).filter((p: Payslip) => p.runId === runId);
  },

  async createPayrollRun(
    period: string,
    employees: FinancialEmployee[],
    adjustments: Record<string, { bonus: number; other: number }>
  ): Promise<PayrollRun> {
    // Load current config and snapshot it into the run for historical accuracy
    const config = await this.getPayrollConfig();

    const payslips = employees.map(emp => {
      const adj = adjustments[emp.id] ?? { bonus: 0, other: 0 };
      const calc = calculatePayslip(
        config,
        emp.baseSalary,
        emp.transportAllowance ?? 0,
        (emp.performanceBonus ?? 0) + adj.bonus,
        (emp.otherAllowances ?? 0) + adj.other,
        emp.contributesToCNAS !== false,
      );
      return { emp, adj, calc };
    });

    const totalGross        = payslips.reduce((s, p) => s + p.calc.grossSalary, 0);
    const totalNet          = payslips.reduce((s, p) => s + p.calc.netSalary, 0);
    const totalCNASEmployee = payslips.reduce((s, p) => s + p.calc.cnasEmployee, 0);
    const totalCNASEmployer = payslips.reduce((s, p) => s + p.calc.cnasEmployer, 0);
    const totalIRG          = payslips.reduce((s, p) => s + p.calc.irgRetained, 0);

    const runRes = await authFetch('/api/db/payrollRuns', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period,
        executionDate: new Date().toISOString(),
        totalGross,
        totalNet,
        totalCNAS: totalCNASEmployee,
        totalCNASEmployer,
        totalIRG,
        employeeCount: employees.length,
        status: 'BROUILLON',
        configSnapshot: JSON.stringify(config),
      }),
    });
    if (!runRes.ok) {
      const errMsg = await readApiErrorMessage(runRes);
      throw new Error(errMsg || 'Failed to create payroll run');
    }
    const run: PayrollRun = await runRes.json();

    await Promise.all(payslips.map(async ({ emp, adj, calc }) => {
      const slipRes = await authFetch('/api/db/payslips', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: run.id,
          employeeId: emp.id,
          employeeName: emp.name,
          period,
          baseSalary: emp.baseSalary,
          transportAllowance: emp.transportAllowance ?? 0,
          performanceBonus: (emp.performanceBonus ?? 0) + adj.bonus,
          otherAllowances: (emp.otherAllowances ?? 0) + adj.other,
          grossSalary: calc.grossSalary,
          cnasEmployee: calc.cnasEmployee,
          taxableGross: calc.taxableGross,
          irgAbatement: calc.irgAbatement,
          irgRetained: calc.irgRetained,
          netSalary: calc.netSalary,
          cnasEmployer: calc.cnasEmployer,
          totalEmployerCost: calc.totalEmployerCost,
        }),
      });
      if (!slipRes.ok) {
        const errMsg = await readApiErrorMessage(slipRes);
        throw new Error(errMsg || `Failed to create payslip for ${emp.name}`);
      }
    }));

    return run;
  },

  async approvePayrollRun(runId: string, approvedBy: string): Promise<void> {
    const res = await authFetch(`/api/db/payrollRuns/${runId}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROUVÉ', approvedBy }),
    });
    if (!res.ok) throw new Error('Failed to approve payroll run');
  },

  async updatePayslip(id: string, fields: Partial<Omit<Payslip, 'id' | 'runId' | 'employeeId' | 'employeeName' | 'period'>>): Promise<void> {
    const res = await authFetch(`/api/db/payslips/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Compatibility shim used by employee card previews — uses DEFAULT_PAYROLL_CONFIG.
  calculatePayroll(
    baseSalary: number,
    transportAllowance: number,
    performanceBonusPlusOther: number,
    _otherAllowances?: number,
  ) {
    const bonus = performanceBonusPlusOther;
    const other = _otherAllowances ?? 0;
    const r = calculatePayslip(
      DEFAULT_PAYROLL_CONFIG,
      baseSalary,
      transportAllowance,
      bonus,
      other,
      true,
    );
    // Short aliases used by employee card previews and run preview table.
    return { ...r, gross: r.grossSalary, net: r.netSalary, irg: r.irgRetained };
  },
};
