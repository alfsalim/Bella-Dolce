import { describe, it, expect } from 'vitest';
import {
  computeIrg,
  applyIrgRebate,
  calculatePayslip,
  DEFAULT_PAYROLL_CONFIG,
} from '../lib/payrollEngine';

const BRACKETS = DEFAULT_PAYROLL_CONFIG.irgBrackets;

describe('computeIrg — Algeria 2024 brackets', () => {
  it('returns 0 for zero income', () => {
    expect(computeIrg(0, BRACKETS)).toBe(0);
  });

  it('returns 0 for income at the 0% ceiling (10 000)', () => {
    expect(computeIrg(10_000, BRACKETS)).toBe(0);
  });

  it('taxes only the slice above 10 000 at 20%', () => {
    // 15 000: 10000×0% + 5000×20% = 1000
    expect(computeIrg(15_000, BRACKETS)).toBeCloseTo(1_000);
  });

  it('spans two brackets at 25 000', () => {
    // 10000×0 + 10000×20% + 5000×26% = 2000+1300 = 3300
    expect(computeIrg(25_000, BRACKETS)).toBeCloseTo(3_300);
  });

  it('spans three brackets at 35 000', () => {
    // 10000×0 + 10000×20% + 10000×26% + 5000×30% = 6100
    expect(computeIrg(35_000, BRACKETS)).toBeCloseTo(6_100);
  });

  it('spans all brackets at 50 000', () => {
    // 10000×0 + 10000×20% + 10000×26% + 5000×30% + 15000×35% = 11350
    expect(computeIrg(50_000, BRACKETS)).toBeCloseTo(11_350);
  });
});

describe('applyIrgRebate', () => {
  const { irgRebateRate, irgRebateCap } = DEFAULT_PAYROLL_CONFIG;

  it('rebate is 40% when under 1500 cap', () => {
    // rawIrg=1000 → rebate=400 → retained=600
    expect(applyIrgRebate(1_000, irgRebateRate, irgRebateCap)).toBeCloseTo(600);
  });

  it('rebate is capped at 1500 when 40% would exceed it', () => {
    // rawIrg=6100 → 40%=2440 > 1500 → retained=4600
    expect(applyIrgRebate(6_100, irgRebateRate, irgRebateCap)).toBeCloseTo(4_600);
  });

  it('returns 0 for zero IRG', () => {
    expect(applyIrgRebate(0, irgRebateRate, irgRebateCap)).toBe(0);
  });
});

describe('calculatePayslip — full calculation', () => {
  const config = DEFAULT_PAYROLL_CONFIG;

  it('correctly calculates for a mid-range salary with CNAS', () => {
    // base=30000, transport=2000, bonus=0, other=0, contributesToCNAS=true
    // cnasBase=30000, cnasEmployee=2700, gross=32000, taxable=29300
    // IRG(29300)=10000×0+10000×0.20+9300×0.26=4418 → rebate=min(1767.2,1500)=1500 → retained=2918
    // net=29300-2918=26382, cnasEmployer=7800, totalCost=39800
    const result = calculatePayslip(config, 30_000, 2_000, 0, 0, true);
    expect(result.grossSalary).toBe(32_000);
    expect(result.cnasBase).toBe(30_000);
    expect(result.cnasEmployee).toBeCloseTo(2_700);
    expect(result.taxableGross).toBeCloseTo(29_300);
    expect(result.irgRetained).toBeCloseTo(2_918);
    expect(result.netSalary).toBeCloseTo(26_382);
    expect(result.cnasEmployer).toBeCloseTo(7_800);
    expect(result.totalEmployerCost).toBeCloseTo(39_800);
  });

  it('excludes transport from cnasBase', () => {
    const result = calculatePayslip(config, 20_000, 5_000, 0, 0, true);
    expect(result.cnasBase).toBe(20_000);
    expect(result.grossSalary).toBe(25_000);
    expect(result.cnasEmployee).toBeCloseTo(20_000 * 0.09);
  });

  it('sets CNAS to 0 when contributesToCNAS is false', () => {
    const result = calculatePayslip(config, 30_000, 2_000, 0, 0, false);
    expect(result.cnasEmployee).toBe(0);
    expect(result.cnasEmployer).toBe(0);
    // taxableGross = full gross (no CNAS deduction)
    expect(result.taxableGross).toBe(32_000);
  });

  it('calculates correctly at the minimum (below first bracket)', () => {
    // gross=10000, transport=0, CNAS=900, taxable=9100 → all under 10000 threshold → IRG=0
    const result = calculatePayslip(config, 10_000, 0, 0, 0, true);
    expect(result.irgRetained).toBeCloseTo(0);
    expect(result.netSalary).toBeCloseTo(result.taxableGross);
  });

  it('irgAbatement + irgRetained === irgBeforeRebate', () => {
    const result = calculatePayslip(config, 40_000, 3_000, 2_000, 1_000, true);
    expect(result.irgAbatement + result.irgRetained).toBeCloseTo(result.irgBeforeRebate, 5);
  });

  it('includes bonus and otherAllowances in cnasBase and gross', () => {
    const result = calculatePayslip(config, 20_000, 1_000, 3_000, 2_000, true);
    expect(result.grossSalary).toBe(26_000);
    expect(result.cnasBase).toBe(25_000); // excludes transport
    expect(result.cnasEmployee).toBeCloseTo(25_000 * 0.09);
  });
});
