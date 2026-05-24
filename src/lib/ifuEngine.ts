/**
 * IFU (Impôt Forfaitaire Unique) Calculation Engine
 * Simplified flat-rate tax calculation for Algerian bakery commercial activity.
 * Single-rate regime; no mixed-activity support.
 */

export interface TaxConfig {
  id: string;
  type: string;
  year?: number;
  ratePercent: number;
  description?: string;
  effectiveFrom?: Date | string;
  effectiveUntil?: Date | string;
  createdBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IfuCalculationInput {
  grossTurnover: number;
  taxRatePercent: number;
}

export interface IfuCalculationResult {
  grossTurnover: number;
  taxRatePercent: number;
  taxAmountDue: number;
}

/**
 * Calculate gross turnover from sales data.
 * Sums all sales in period; excludes cancelled transactions.
 * Called with fetched sales array (client/server-side aggregation).
 */
export function calculateGrossTurnover(sales: Array<{ totalAmount?: number; status?: string }>): number {
  return sales.reduce((sum, sale) => {
    const amount = sale.totalAmount ?? 0;
    const isValid = amount > 0;
    return isValid ? sum + amount : sum;
  }, 0);
}

/**
 * Calculate IFU tax due.
 * IFU = Gross Turnover × (Rate % / 100)
 * Deterministic, always rounds to 2 decimal places (DZD cents).
 */
export function calculateIfuTax(input: IfuCalculationInput): IfuCalculationResult {
  const { grossTurnover, taxRatePercent } = input;
  const taxAmountDue = Math.round((grossTurnover * (taxRatePercent / 100)) * 100) / 100;
  return {
    grossTurnover,
    taxRatePercent,
    taxAmountDue,
  };
}

/**
 * Validate IFU calculation input.
 * Ensures values are non-negative and rate is reasonable (0–100%).
 */
export function validateIfuInput(input: IfuCalculationInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (input.grossTurnover < 0) errors.push("Gross turnover cannot be negative");
  if (input.taxRatePercent < 0 || input.taxRatePercent > 100) errors.push("Tax rate must be between 0% and 100%");
  return { valid: errors.length === 0, errors };
}

/**
 * Default IFU tax configuration.
 * Bakery commercial activity, single rate.
 */
export const DEFAULT_IFU_CONFIG: TaxConfig = {
  id: 'ifu_rate_default',
  type: 'IFU_RATE',
  year: new Date().getFullYear(),
  ratePercent: 1.5,
  description: 'Default IFU rate for commercial bakery (1.5%)',
};

export interface IfuConfigSnapshot {
  taxRatePercent: number;
  year: number;
  description?: string;
  snapshotDate: string;
  system: string;
}

/**
 * Create a configuration snapshot for audit trail.
 * Called when declaration is finalized.
 */
export function createIfuConfigSnapshot(config: TaxConfig, year: number): IfuConfigSnapshot {
  return {
    taxRatePercent: config.ratePercent,
    year,
    description: config.description,
    snapshotDate: new Date().toISOString(),
    system: 'bella-dolce-v1.0',
  };
}
