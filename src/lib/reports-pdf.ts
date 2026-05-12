import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { ActivityLog, Sale, SaleItem } from '../types';
import { generateTransactionId } from './transactionId';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseSaleItems(sale: Sale): (SaleItem & { name?: string })[] {
  try {
    return Array.isArray(sale.items) ? sale.items : JSON.parse((sale.items as unknown as string) || '[]');
  } catch {
    return [];
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function wrapRoot(rtl: boolean, inner: string): string {
  const fontStack = rtl
    ? '"Cairo", sans-serif'
    : "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  return `<div dir="${rtl ? 'rtl' : 'ltr'}" style="width:794px;background:#f1f5f9;padding:0 0 28px;box-sizing:border-box;font-family:${fontStack};color:#0f172a;font-size:12px;line-height:1.45;">${inner}</div>`;
}

function banner(L: Record<string, string>, title: string, lines: string[]): string {
  const lineHtml = lines.map((l) => `<div style="opacity:0.92;font-size:11px;margin-top:4px;">${esc(l)}</div>`).join('');
  return `
<div data-pdf-gradient="1" style="background:linear-gradient(135deg,#d97706 0%,#b45309 100%);color:#fff;padding:22px 26px 26px;border-radius:0 0 18px 18px;margin-bottom:22px;box-shadow:0 10px 28px rgba(217,119,6,0.22);">
  <div style="font-size:21px;font-weight:800;letter-spacing:-0.03em;">Bella Dolce</div>
  <div style="opacity:0.9;font-size:12px;margin-top:4px;font-weight:600;">${esc(L.reports)}</div>
  <div style="margin-top:14px;font-size:18px;font-weight:800;">${esc(title)}</div>
  ${lineHtml}
</div>`;
}

function kpiCard(label: string, value: string): string {
  return `<div style="flex:1 1 42%;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
    <div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${esc(label)}</div>
    <div style="font-size:17px;font-weight:800;margin-top:6px;color:#0f172a;">${esc(value)}</div>
  </div>`;
}

/** html2canvas cannot parse modern CSS color functions (e.g. oklch) from host Tailwind theme. */
const UNSUPPORTED_COLOR_FN = /\b(oklch|lch|lab|color\(|hwb)\s*\(/i;

function hasUnsupportedColor(cssValue: string | null | undefined): boolean {
  if (!cssValue || cssValue === 'none') return false;
  return UNSUPPORTED_COLOR_FN.test(cssValue);
}

/** After global reset, fix any remaining oklch / lab in computed styles on the clone. */
function sanitizeClonedNodeForHtml2Canvas(clonedDoc: Document, root: HTMLElement): void {
  const win = clonedDoc.defaultView;
  if (!win) return;

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

  for (const el of nodes) {
    if (el.closest('[data-pdf-gradient="1"]')) continue;

    const cs = win.getComputedStyle(el);
    const bgColor = cs.backgroundColor;
    const bgImage = cs.backgroundImage;
    const fullBg = cs.getPropertyValue('background');

    if (
      hasUnsupportedColor(bgColor) ||
      hasUnsupportedColor(bgImage) ||
      hasUnsupportedColor(fullBg) ||
      hasUnsupportedColor(cs.color) ||
      hasUnsupportedColor(cs.borderColor) ||
      hasUnsupportedColor(cs.outlineColor) ||
      hasUnsupportedColor(cs.boxShadow)
    ) {
      if (hasUnsupportedColor(bgImage) || hasUnsupportedColor(fullBg)) {
        el.style.backgroundImage = 'none';
        el.style.background = '';
      }
      if (hasUnsupportedColor(bgColor)) {
        el.style.backgroundColor = el === root ? '#f1f5f9' : '#ffffff';
      }
      if (hasUnsupportedColor(cs.color)) {
        el.style.color = '#0f172a';
      }
      if (hasUnsupportedColor(cs.borderColor)) {
        el.style.borderColor = '#e2e8f0';
      }
      if (hasUnsupportedColor(cs.outlineColor)) {
        el.style.outlineColor = '#e2e8f0';
      }
      if (hasUnsupportedColor(cs.boxShadow)) {
        el.style.boxShadow = 'none';
      }
    }
  }
}

async function renderHtmlToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  return html2canvas(el, {
    scale: 1.35,
    useCORS: true,
    logging: false,
    backgroundColor: '#f1f5f9',
    onclone: (clonedDoc, clonedEl) => {
      const reset = clonedDoc.createElement('style');
      reset.textContent = `
        html,body{background:#f1f5f9!important;color:#0f172a!important;margin:0;padding:0;}
        *{box-shadow:none!important;}
        *:not([data-pdf-gradient="1"]){background-image:none!important;}
        [data-pdf-gradient="1"]{
          background:linear-gradient(135deg,#d97706 0%,#b45309 100%)!important;
          background-image:linear-gradient(135deg,#d97706 0%,#b45309 100%)!important;
          box-shadow:0 10px 28px rgba(217,119,6,0.22)!important;
        }
      `
        .replace(/\s+/g, ' ')
        .trim();
      (clonedDoc.head || clonedDoc.documentElement).appendChild(reset);
      sanitizeClonedNodeForHtml2Canvas(clonedDoc, clonedEl as HTMLElement);
    },
  });
}

/** Push one canvas onto pdf; splits across pages when image is taller than one sheet. */
function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, options: { startNewPage: boolean }): void {
  const imgData = canvas.toDataURL('image/png', 0.92);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (options.startNewPage) {
    pdf.addPage();
  }

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  let page = 0;
  while (heightLeft > 0) {
    page += 1;
    position = -page * pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
}

async function flushChunks(pdf: jsPDF, elements: HTMLElement[], first: { value: boolean }): Promise<void> {
  for (const el of elements) {
    document.body.appendChild(el);
    try {
      const canvas = await renderHtmlToCanvas(el);
      addCanvasToPdf(pdf, canvas, { startNewPage: !first.value });
      first.value = false;
    } finally {
      document.body.removeChild(el);
    }
  }
}

export type AnalyticsPdfPayload = {
  periodLine: string;
  presetLine: string;
  kpi: {
    totalRevenue: number;
    totalProfit: number;
    totalCosts: number;
    avgOrderValue: number;
  };
  orders: {
    totalOrdersCount: number;
    fulfilledOrdersCount: number;
    fulfillmentRate: number;
    cancelledOrdersCount: number;
    unfulfilledOrdersCount: number;
    delayedOrdersCount: number;
    fulfilledTodayCount: number;
    totalFulfilledToday: number;
    fulfilledThisWeekCount: number;
    totalFulfilledThisWeek: number;
    fulfilledThisMonthCount: number;
    totalFulfilledThisMonth: number;
  };
  orderStatusRows: { label: string; value: number }[];
  chartRows: { dayLabel: string; revenue: number; orders: number }[];
  categories: { label: string; count: number }[];
  topSellers: { rank: number; name: string; category: string; units: number }[];
  inventoryRows: { name: string; consumption: string; stock: number }[];
};

export async function downloadReportsPdf(opts: {
  filename: string;
  isRTL: boolean;
  currencyUnit: string;
  labels: Record<string, string>;
  mode: 'analytics' | 'sales_transactions' | 'sales_by_product' | 'activities';
  analytics?: AnalyticsPdfPayload;
  salesTransactions?: {
    sales: Sale[];
    filterNote: string;
    getLineItemLabel: (item: SaleItem & { name?: string }) => string;
    getPaymentLabel: (method: string) => string;
    formatSaleDate: (iso: string) => string;
    formatSaleTime: (iso: string) => string;
  };
  salesByProduct?: {
    rows: { name: string; quantity: number; revenue: number; saleCount: number }[];
    filterNote: string;
  };
  activities?: {
    logs: ActivityLog[];
    filterNote: string;
    formatLogTime: (iso: string) => string;
  };
}): Promise<void> {
  const { isRTL, currencyUnit: cu, labels: L } = opts;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const first = { value: true };

  if (opts.mode === 'analytics' && opts.analytics) {
    const a = opts.analytics;
    const headInner =
      banner(L, L.analytics, [a.periodLine, a.presetLine, L.reportPdfFilteredNote]) +
      `<div style="padding:0 22px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          ${kpiCard(L.totalRevenue, `${a.kpi.totalRevenue.toLocaleString()} ${cu}`)}
          ${kpiCard(L.profit, `${a.kpi.totalProfit.toLocaleString()} ${cu}`)}
          ${kpiCard(L.costs, `${a.kpi.totalCosts.toLocaleString()} ${cu}`)}
          ${kpiCard(L.avgOrderValue, `${a.kpi.avgOrderValue.toLocaleString()} ${cu}`)}
        </div>
        <div style="font-size:15px;font-weight:800;margin:8px 0 12px;color:#0f172a;">${esc(L.orderReport)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          ${kpiCard(L.totalOrders, String(a.orders.totalOrdersCount))}
          ${kpiCard(L.fulfilled, String(a.orders.fulfilledOrdersCount))}
          ${kpiCard(L.fulfillmentRate, `${a.orders.fulfillmentRate.toFixed(1)}%`)}
          ${kpiCard(L.cancelled, String(a.orders.cancelledOrdersCount))}
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:800;margin-bottom:12px;">${esc(L.orderSummary)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${kpiCard(L.daily, `${a.orders.fulfilledTodayCount} — ${a.orders.totalFulfilledToday.toLocaleString()} ${cu}`)}
            ${kpiCard(L.weekly, `${a.orders.fulfilledThisWeekCount} — ${a.orders.totalFulfilledThisWeek.toLocaleString()} ${cu}`)}
            ${kpiCard(L.monthly, `${a.orders.fulfilledThisMonthCount} — ${a.orders.totalFulfilledThisMonth.toLocaleString()} ${cu}`)}
            ${kpiCard(L.unfulfilledOrders, String(a.orders.unfulfilledOrdersCount))}
            ${kpiCard(L.delayedOrders, String(a.orders.delayedOrdersCount))}
          </div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:800;margin-bottom:10px;">${esc(L.orderStatusDistribution)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${a.orderStatusRows
              .map(
                (r) =>
                  `<span style="background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:700;color:#9a3412;">${esc(r.label)}: ${r.value}</span>`
              )
              .join('')}
          </div>
        </div>
      </div>`;
    const headEl = document.createElement('div');
    headEl.innerHTML = wrapRoot(isRTL, headInner);

    const chartChunks = chunkArray(a.chartRows, 36);
    const chartEls: HTMLElement[] = chartChunks.map((rows, idx) => {
      const tableRows = rows
        .map(
          (r) =>
            `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;">${esc(r.dayLabel)}</td><td style="padding:8px 10px;text-align:end;">${r.revenue.toLocaleString()} ${esc(cu)}</td><td style="padding:8px 10px;text-align:end;">${r.orders}</td></tr>`
        )
        .join('');
      const inner =
        banner(L, L.salesTrends, [`${L.reportPdfDailyBreakdown} · ${idx + 1}/${chartChunks.length}`, L.reportPdfFilteredNote]) +
        `<div style="padding:0 22px;">
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;font-size:11px;">
            <thead><tr style="background:#f8fafc;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;">
              <th style="padding:10px;text-align:start;">${esc(L.reportPdfDailyBreakdown)}</th>
              <th style="padding:10px;text-align:end;">${esc(L.revenue)}</th>
              <th style="padding:10px;text-align:end;">${esc(L.orders)}</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>`;
      const el = document.createElement('div');
      el.innerHTML = wrapRoot(isRTL, inner);
      return el;
    });

    const catRows = a.categories
      .map(
        (c, i) =>
          `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;"><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${['#3b82f6','#10b981','#ef4444','#f59e0b'][i % 4]};margin-inline-end:8px;"></span>${esc(c.label)}</td><td style="padding:8px 10px;text-align:end;">${c.count} ${esc(L.units)}</td></tr>`
      )
      .join('');
    const topRows = a.topSellers
      .map(
        (p) =>
          `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;font-weight:800;">#${p.rank}</td><td style="padding:8px 10px;">${esc(p.name)}<div style="font-size:10px;color:#64748b;">${esc(p.category)}</div></td><td style="padding:8px 10px;text-align:end;font-weight:700;color:#d97706;">${p.units} ${esc(L.units)}</td></tr>`
      )
      .join('');
    const invRows = a.inventoryRows
      .map(
        (m) =>
          `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;">${esc(m.name)}</td><td style="padding:8px 10px;text-align:end;color:#d97706;font-weight:700;">${esc(m.consumption)} ${esc(L.units)}</td><td style="padding:8px 10px;text-align:end;">${m.stock}</td></tr>`
      )
      .join('');

    const tailInner =
      banner(L, L.salesByCategory + ' / ' + L.topSellers + ' / ' + L.inventoryConsumption, [L.reportPdfFilteredNote]) +
      `<div style="padding:0 22px;display:flex;flex-direction:column;gap:16px;">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <div style="padding:12px 16px;font-weight:800;border-bottom:1px solid #f1f5f9;">${esc(L.salesByCategory)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;"><tbody>${catRows || `<tr><td colspan="2" style="padding:12px;color:#94a3b8;">—</td></tr>`}</tbody></table>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <div style="padding:12px 16px;font-weight:800;border-bottom:1px solid #f1f5f9;">${esc(L.topSellers)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;"><tbody>${topRows || `<tr><td colspan="3" style="padding:12px;color:#94a3b8;">—</td></tr>`}</tbody></table>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <div style="padding:12px 16px;font-weight:800;border-bottom:1px solid #f1f5f9;">${esc(L.inventoryConsumption)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:#f8fafc;font-size:9px;color:#64748b;text-transform:uppercase;"><th style="padding:8px;text-align:start;">${esc(L.material)}</th><th style="padding:8px;text-align:end;">${esc(L.inventoryConsumption)}</th><th style="padding:8px;text-align:end;">${esc(L.stock)}</th></tr></thead>
            <tbody>${invRows || `<tr><td colspan="3" style="padding:12px;color:#94a3b8;">—</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    const tailEl = document.createElement('div');
    tailEl.innerHTML = wrapRoot(isRTL, tailInner);

    await flushChunks(pdf, [headEl, ...chartEls, tailEl], first);
  } else if (opts.mode === 'sales_transactions' && opts.salesTransactions) {
    const { sales, filterNote, getLineItemLabel, getPaymentLabel, formatSaleDate, formatSaleTime } = opts.salesTransactions;
    const title = `${L.salesReport} — ${L.reportPdfSubTabTransactions}`;
    const chunks = chunkArray(sales, 18);
    const elements = chunks.map((batch, idx) => {
      const rows = batch
        .map((sale) => {
          const items = parseSaleItems(sale);
          const prodLines = items
            .map((it) => `${it.quantity}× ${getLineItemLabel(it)}`)
            .join('<br/>');
          return `<tr style="border-bottom:1px solid #f1f5f9;vertical-align:top;">
            <td style="padding:10px 8px;width:12%;font-weight:800;font-family:monospace;font-size:10px;color:#d97706;">${esc(generateTransactionId(sale.createdAt))}</td>
            <td style="padding:10px 8px;width:14%;"><div style="font-weight:800;">${esc(formatSaleDate(sale.createdAt))}</div><div style="font-size:10px;color:#64748b;">${esc(formatSaleTime(sale.createdAt))}</div></td>
            <td style="padding:10px 8px;width:16%;font-weight:700;">${esc(sale.cashierName || '—')}</td>
            <td style="padding:10px 8px;width:12%;"><span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;">${esc(getPaymentLabel(sale.paymentMethod))}</span></td>
            <td style="padding:10px 8px;font-size:10.5px;">${prodLines || '—'}</td>
            <td style="padding:10px 8px;text-align:end;font-weight:800;white-space:nowrap;">${sale.totalAmount.toLocaleString()} ${esc(cu)}</td>
          </tr>`;
        })
        .join('');
      const inner =
        banner(L, title, [filterNote, `${L.records}: ${sales.length} · ${idx + 1}/${chunks.length}`]) +
        `<div style="padding:0 18px;">
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:14px;font-size:11px;">
            <thead><tr style="background:#f8fafc;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;">
              <th style="padding:10px 8px;text-align:start;">${esc(L.transactionId) || 'TRANSACTION ID'}</th>
              <th style="padding:10px 8px;text-align:start;">${esc(L.timestamp)}</th>
              <th style="padding:10px 8px;text-align:start;">${esc(L.cashier)}</th>
              <th style="padding:10px 8px;text-align:start;">${esc(L.payment)}</th>
              <th style="padding:10px 8px;text-align:start;">${esc(L.products)}</th>
              <th style="padding:10px 8px;text-align:end;">${esc(L.amount)}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      const el = document.createElement('div');
      el.innerHTML = wrapRoot(isRTL, inner);
      return el;
    });
    await flushChunks(pdf, elements, first);
  } else if (opts.mode === 'sales_by_product' && opts.salesByProduct) {
    const { rows, filterNote } = opts.salesByProduct;
    const title = `${L.salesReport} — ${L.reportPdfSubTabByProduct}`;
    const chunks = chunkArray(rows, 45);
    const elements = chunks.map((batch, idx) => {
      const body = batch
        .map(
          (r) =>
            `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px;font-weight:700;">${esc(r.name)}</td><td style="padding:10px;">${r.quantity}</td><td style="padding:10px;">${r.revenue.toLocaleString()} ${esc(cu)}</td><td style="padding:10px;text-align:end;font-weight:800;">${r.saleCount}</td></tr>`
        )
        .join('');
      const inner =
        banner(L, title, [filterNote, `${L.products}: ${rows.length} · ${idx + 1}/${chunks.length}`]) +
        `<div style="padding:0 18px;">
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:14px;font-size:11px;">
            <thead><tr style="background:#f8fafc;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;">
              <th style="padding:10px;text-align:start;">${esc(L.products)}</th>
              <th style="padding:10px;text-align:start;">${esc(L.quantity)}</th>
              <th style="padding:10px;text-align:start;">${esc(L.revenue)}</th>
              <th style="padding:10px;text-align:end;">${esc(L.salesContainingProduct)}</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>`;
      const el = document.createElement('div');
      el.innerHTML = wrapRoot(isRTL, inner);
      return el;
    });
    await flushChunks(pdf, elements, first);
  } else if (opts.mode === 'activities' && opts.activities) {
    const { logs, filterNote, formatLogTime } = opts.activities;
    const chunks = chunkArray(logs, 28);
    const elements = chunks.map((batch, idx) => {
      const blocks = batch
        .map((log) => {
          const when = log.timestamp ? formatLogTime(log.timestamp) : '—';
          return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;">
              <span style="font-weight:800;">${esc(log.userName || '—')}</span>
              <span style="font-size:10px;color:#64748b;">${esc(when)}</span>
            </div>
            <div><span style="color:#d97706;font-weight:800;">${esc(log.action)}</span><span style="color:#475569;">: ${esc(log.details || '')}</span></div>
          </div>`;
        })
        .join('');
      const inner =
        banner(L, L.activities, [filterNote, `${L.records}: ${logs.length} · ${idx + 1}/${chunks.length}`]) +
        `<div style="padding:0 18px;">${blocks}</div>`;
      const el = document.createElement('div');
      el.innerHTML = wrapRoot(isRTL, inner);
      return el;
    });
    await flushChunks(pdf, elements, first);
  }

  pdf.save(opts.filename);
}
