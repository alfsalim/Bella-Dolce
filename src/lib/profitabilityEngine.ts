import { authFetch, getAuthHeaders } from './api-client';

// Orders (special orders / storefront checkouts) carry their own amountPaid — this
// folds qualifying ones into a sales-shaped list so existing revenue math (which only
// knows how to sum totalAmount by createdAt) picks them up without a second code path.
// Cancelled orders are excluded so cancelling/deleting automatically removes them from
// revenue — no separate reversal step needed.
export function ordersAsRevenueRows(orders: any[]): { totalAmount: number; createdAt: string }[] {
  return orders
    .filter((o) => o.status !== 'cancelled' && (o.amountPaid ?? 0) > 0)
    .map((o) => ({ totalAmount: o.amountPaid, createdAt: o.createdAt }));
}

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
    const [salesRes, ordersRes, invoicesRes, utilitiesRes] = await Promise.all([
      authFetch('/api/sales', { headers }),
      authFetch('/api/db/orders', { headers }),
      authFetch('/api/db/purchases', { headers }),
      authFetch('/api/db/utilities', { headers }),
    ]);

    const sales = (await (salesRes.ok ? salesRes.json() : Promise.resolve([]))).sales ?? [];
    const orders = await (ordersRes.ok ? ordersRes.json() : Promise.resolve([]));
    const invoices = await (invoicesRes.ok ? invoicesRes.json() : Promise.resolve([]));
    const utilities = await (utilitiesRes.ok ? utilitiesRes.json() : Promise.resolve([]));

    const salesWithOrders = [...sales, ...ordersAsRevenueRows(Array.isArray(orders) ? orders : [])];
    const metrics = await calculateProfitability(salesWithOrders, invoices, utilities, period);
    return metrics;
  } catch (error) {
    console.error('Error fetching profitability data:', error);
    return null;
  }
}
