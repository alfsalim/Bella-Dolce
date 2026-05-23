import { PayrollConfig, IrgBracket } from '../types';

// Algeria 2024 defaults — stored in Setting(id: 'payroll_config') and editable by admin.
// These constants are ONLY used as the seed / fallback; all calculations must accept
// a PayrollConfig argument so the caller can pass a snapshotted config.
export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  cnasEmployeeRate: 0.09,
  cnasEmployerRate: 0.26,
  irgBrackets: [
    { upTo: 10_000,  rate: 0     },
    { upTo: 20_000,  rate: 0.20  },
    { upTo: 30_000,  rate: 0.26  },
    { upTo: 35_000,  rate: 0.30  },
    { upTo: null,    rate: 0.35  },
  ],
  irgRebateRate: 0.40,
  irgRebateCap:  1_500,
};

/**
 * Compute progressive IRG (impôt sur le revenu global) on a given monthly taxable amount.
 * Pure function — no side effects, no rounding until the final value.
 */
export function computeIrg(taxableGross: number, brackets: IrgBracket[]): number {
  if (taxableGross <= 0) return 0;

  let tax = 0;
  let prev = 0;

  for (const bracket of brackets) {
    const ceiling = bracket.upTo ?? Infinity;
    const slice = Math.min(taxableGross, ceiling) - prev;
    if (slice <= 0) break;
    tax += slice * bracket.rate;
    prev = ceiling;
    if (taxableGross <= ceiling) break;
  }

  return tax;
}

/**
 * Apply the 40% rebate (abatement), capped at irgRebateCap.
 */
export function applyIrgRebate(rawIrg: number, rebateRate: number, rebateCap: number): number {
  const rebate = Math.min(rawIrg * rebateRate, rebateCap);
  return Math.max(rawIrg - rebate, 0);
}

export interface PayslipCalculation {
  // Salary components
  baseSalary: number;
  transportAllowance: number;
  performanceBonus: number;
  otherAllowances: number;
  grossSalary: number;
  // CNAS base (transport excluded when contributesToCNAS is true)
  cnasBase: number;
  // Employee deductions
  cnasEmployee: number;
  taxableGross: number;
  irgBeforeRebate: number;
  irgAbatement: number;
  irgRetained: number;
  netSalary: number;
  // Employer cost
  cnasEmployer: number;
  totalEmployerCost: number;
}

/**
 * Full payslip calculation for a single employee.
 * Transport is always excluded from CNAS base (Algerian rule, fixed).
 * When contributesToCNAS is false, CNAS = 0 and the full gross is taxable.
 */
export function calculatePayslip(
  config: PayrollConfig,
  baseSalary: number,
  transportAllowance: number,
  performanceBonus: number,
  otherAllowances: number,
  contributesToCNAS: boolean
): PayslipCalculation {
  const grossSalary = baseSalary + transportAllowance + performanceBonus + otherAllowances;

  // CNAS base excludes transport (fixed Algerian rule)
  const cnasBase = baseSalary + performanceBonus + otherAllowances;

  const cnasEmployee = contributesToCNAS
    ? cnasBase * config.cnasEmployeeRate
    : 0;

  const cnasEmployer = contributesToCNAS
    ? cnasBase * config.cnasEmployerRate
    : 0;

  // Taxable gross = gross - cnasEmployee (transport stays in gross for IRG base)
  const taxableGross = grossSalary - cnasEmployee;

  const irgBeforeRebate = computeIrg(taxableGross, config.irgBrackets);
  const irgRetained = applyIrgRebate(irgBeforeRebate, config.irgRebateRate, config.irgRebateCap);
  const irgAbatement = irgBeforeRebate - irgRetained;

  const netSalary = taxableGross - irgRetained;
  const totalEmployerCost = grossSalary + cnasEmployer;

  return {
    baseSalary,
    transportAllowance,
    performanceBonus,
    otherAllowances,
    grossSalary,
    cnasBase,
    cnasEmployee,
    taxableGross,
    irgBeforeRebate,
    irgAbatement,
    irgRetained,
    netSalary,
    cnasEmployer,
    totalEmployerCost,
  };
}
