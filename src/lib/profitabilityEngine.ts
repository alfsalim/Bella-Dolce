import { authFetch, getAuthHeaders } from './api-client';

export interface ProfitabilityMetrics {
  revenue: number;
  cogs: number; // Cost of Goods Sold from supplier invoices
  grossProfit: number; // Revenue - COGS
  opex: number; // Operating Expenses (utilities + depreciation + maintenance)
  operatingProfit: number; // Gross Profit - OpEx (EBIT)
  utilities: number; // Utilities total for period
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

function inPeriod(timestamp: any, startDate: Date, endDate: Date): boolean {
  const date = new Date(timestamp);
  return date >= startDate && date <= endDate;
}

export async function calculateProfitability(
  sales: any[],
  invoices: any[],
  utilities: any[],
  period: DateRange
): Promise<ProfitabilityMetrics> {
  const { startDate, endDate } = period;

  // Revenue: sum of all sales in period
  const revenue = sales
    .filter(s => inPeriod(s.createdAt, startDate, endDate))
    .reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);

  // COGS: sum of all supplier invoices (purchases) in period
  const cogs = invoices
    .filter(i => inPeriod(i.date ?? i.createdAt, startDate, endDate))
    .reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);

  // Utilities: sum of all utility amounts in period
  const utilitiesTotal = utilities
    .filter(u => inPeriod(u.periodStart, startDate, endDate))
    .reduce((sum, u) => sum + (u.amount ?? 0), 0);

  // Gross Profit = Revenue - COGS
  const grossProfit = revenue - cogs;

  // Operating Expenses = Utilities (+ depreciation, maintenance, etc. if applicable)
  // For now, just utilities. Depreciation and maintenance are already in invoices.
  const opex = utilitiesTotal;

  // Operating Profit (EBIT) = Gross Profit - OpEx
  const operatingProfit = grossProfit - opex;

  return {
    revenue,
    cogs,
    grossProfit,
    opex,
    operatingProfit,
    utilities: utilitiesTotal,
  };
}

export async function fetchProfitabilityData(period: DateRange) {
  const headers = getAuthHeaders();

  try {
    const [salesRes, invoicesRes, utilitiesRes] = await Promise.all([
      authFetch('/api/sales', { headers }),
      authFetch('/api/db/purchases', { headers }),
      authFetch('/api/db/utilities', { headers }),
    ]);

    const sales = (await (salesRes.ok ? salesRes.json() : Promise.resolve([]))).sales ?? [];
    const invoices = await (invoicesRes.ok ? invoicesRes.json() : Promise.resolve([]));
    const utilities = await (utilitiesRes.ok ? utilitiesRes.json() : Promise.resolve([]));

    const metrics = await calculateProfitability(sales, invoices, utilities, period);
    return metrics;
  } catch (error) {
    console.error('Error fetching profitability data:', error);
    return null;
  }
}
