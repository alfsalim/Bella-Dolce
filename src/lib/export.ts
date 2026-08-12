/**
 * Unified export module — all PDF and document generation goes through here.
 * Adding a new export type: add a function below using the shared engine helpers.
 * Changing the template design: edit `banner()`, `wrapRoot()`, or `kpiCard()` once.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { ActivityLog, Sale, SaleItem } from '../types';
import { generateTransactionId } from './transactionId';

// ─── Shared primitives ────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseSaleItems(sale: Sale): (SaleItem & { name?: string })[] {
  try {
    return Array.isArray(sale.items) ? sale.items : JSON.parse((sale.items as unknown as string) || '[]');
  } catch {
    return [];
  }
}

// ─── Shared HTML templates ────────────────────────────────────────────────────

// A4 at 96 dpi = 794px. This must match PDF_PAGE_PX exactly.
const PDF_PAGE_PX = 794;

// Banner palette — warm cream matching the logo's ivory background
const BANNER_BG = '#fffdf8';
const BANNER_BORDER = '#e8dcc8';
const BANNER_TEXT = '#3b2a14';
const BANNER_MUTED = '#8b7355';

let _logoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string> {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const res = await fetch('/images/logo-white-light.png');
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }).then((url) => { _logoDataUrl = url; return url; });
  } catch {
    return '';
  }
}

function wrapRoot(rtl: boolean, inner: string, bg = '#faf7f2'): string {
  const fontStack = rtl
    ? '"Cairo", sans-serif'
    : "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  return `<div dir="${rtl ? 'rtl' : 'ltr'}" style="width:${PDF_PAGE_PX}px;background:${bg};padding:0 0 28px;box-sizing:border-box;font-family:${fontStack};color:#1c1208;font-size:12px;line-height:1.45;">${inner}</div>`;
}

function banner(L: Record<string, string>, title: string, lines: string[], logoSrc: string): string {
  const lineHtml = lines.map((l) => `<div style="color:${BANNER_MUTED};font-size:11px;margin-top:3px;">${esc(l)}</div>`).join('');
  const logoHtml = logoSrc
    ? `<div style="text-align:center;margin-bottom:12px;"><img src="${logoSrc}" style="height:72px;width:auto;object-fit:contain;" /></div>`
    : '';
  return `
<div style="background:${BANNER_BG};border-bottom:2px solid ${BANNER_BORDER};padding:24px 32px 20px;margin-bottom:20px;">
  ${logoHtml}
  <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-top:${logoSrc ? '12px' : '0'};border-top:${logoSrc ? `1px solid ${BANNER_BORDER}` : 'none'};">
    <div>
      <div style="font-size:16px;font-weight:800;color:${BANNER_TEXT};letter-spacing:-0.01em;">${esc(title)}</div>
      ${lineHtml}
    </div>
    <div style="background:#f0e8d8;border:1px solid ${BANNER_BORDER};border-radius:6px;padding:5px 12px;font-size:9px;font-weight:800;letter-spacing:0.06em;color:${BANNER_MUTED};white-space:nowrap;text-transform:uppercase;">${esc(L.reports || 'Reports')}</div>
  </div>
</div>`;
}

function kpiCard(label: string, value: string): string {
  return `<div style="flex:1 1 42%;min-width:160px;background:#fff;border:1px solid #e8dcc8;border-radius:12px;padding:14px 16px;">
    <div style="font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${esc(label)}</div>
    <div style="font-size:17px;font-weight:800;margin-top:6px;color:#1c1208;">${esc(value)}</div>
  </div>`;
}

// ─── Rendering engine ─────────────────────────────────────────────────────────

const UNSUPPORTED_COLOR_FN = /\b(oklch|lch|lab|color\(|hwb)\s*\(/i;

function hasUnsupportedColor(v: string | null | undefined): boolean {
  if (!v || v === 'none') return false;
  return UNSUPPORTED_COLOR_FN.test(v);
}

function sanitizeClone(clonedDoc: Document, root: HTMLElement): void {
  const win = clonedDoc.defaultView;
  if (!win) return;
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    const cs = win.getComputedStyle(el);
    const bgImg = cs.backgroundImage;
    const fullBg = cs.getPropertyValue('background');
    if (
      hasUnsupportedColor(cs.backgroundColor) || hasUnsupportedColor(bgImg) ||
      hasUnsupportedColor(fullBg) || hasUnsupportedColor(cs.color) ||
      hasUnsupportedColor(cs.borderColor) || hasUnsupportedColor(cs.outlineColor) ||
      hasUnsupportedColor(cs.boxShadow)
    ) {
      if (hasUnsupportedColor(bgImg) || hasUnsupportedColor(fullBg)) {
        el.style.backgroundImage = 'none';
        el.style.background = '';
      }
      if (hasUnsupportedColor(cs.backgroundColor)) el.style.backgroundColor = el === root ? '#faf7f2' : '#ffffff';
      if (hasUnsupportedColor(cs.color)) el.style.color = '#0f172a';
      if (hasUnsupportedColor(cs.borderColor)) el.style.borderColor = '#e2e8f0';
      if (hasUnsupportedColor(cs.outlineColor)) el.style.outlineColor = '#e2e8f0';
      if (hasUnsupportedColor(cs.boxShadow)) el.style.boxShadow = 'none';
    }
  }
}

async function renderHtmlToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  // Wait two frames so the browser fully lays out the element at PDF_PAGE_PX width.
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  return html2canvas(el, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: '#faf7f2',
    width: PDF_PAGE_PX,
    windowWidth: PDF_PAGE_PX,
    onclone: (clonedDoc, clonedEl) => {
      const style = clonedDoc.createElement('style');
      style.textContent = `
        html,body{background:#faf7f2!important;color:#1c1208!important;margin:0;padding:0;}
        *{box-shadow:none!important;background-image:none!important;}
      `.replace(/\s+/g, ' ').trim();
      (clonedDoc.head || clonedDoc.documentElement).appendChild(style);
      sanitizeClone(clonedDoc, clonedEl as HTMLElement);
    },
  });
}

function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, startNewPage: boolean): void {
  const imgData = canvas.toDataURL('image/jpeg', 0.85);
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;

  if (startNewPage) pdf.addPage();

  let left = imgH;
  pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH);
  left -= pageH;
  let page = 0;
  while (left > 0) {
    page++;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, -page * pageH, pageW, imgH);
    left -= pageH;
  }
}

async function flushChunks(pdf: jsPDF, elements: HTMLElement[], first: { value: boolean }): Promise<void> {
  for (const el of elements) {
    // Must be in-document for correct layout, but hidden from view.
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '-9999px';
    el.style.width = `${PDF_PAGE_PX}px`;
    document.body.appendChild(el);
    try {
      const canvas = await renderHtmlToCanvas(el);
      addCanvasToPdf(pdf, canvas, !first.value);
      first.value = false;
    } finally {
      document.body.removeChild(el);
    }
  }
}

function newA4Pdf(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

// 80mm at 96 dpi — matches the receipt printer's PaperWidth (see PrintAgent appsettings.json).
const RECEIPT_WIDTH_MM = 80;
const RECEIPT_PAGE_PX = 302;

async function renderReceiptHtmlToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: RECEIPT_PAGE_PX,
    windowWidth: RECEIPT_PAGE_PX,
    onclone: (clonedDoc, clonedEl) => {
      const style = clonedDoc.createElement('style');
      style.textContent = `html,body{background:#ffffff!important;color:#000000!important;margin:0;padding:0;}*{box-shadow:none!important;background-image:none!important;}`;
      (clonedDoc.head || clonedDoc.documentElement).appendChild(style);
      sanitizeClone(clonedDoc, clonedEl as HTMLElement);
    },
  });
}

/** Renders a narrow single-column receipt to its own continuous-length PDF page (no A4 pagination — this is a paper roll, not a fixed sheet). */
async function saveReceiptPdf(filename: string, innerHtml: string): Promise<void> {
  const el = document.createElement('div');
  el.innerHTML = innerHtml;
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '-9999px';
  el.style.width = `${RECEIPT_PAGE_PX}px`;
  document.body.appendChild(el);
  try {
    const canvas = await renderReceiptHtmlToCanvas(el);
    const heightMM = (canvas.height * RECEIPT_WIDTH_MM) / canvas.width;
    const pdf = new jsPDF({ unit: 'mm', format: [RECEIPT_WIDTH_MM, heightMM] });
    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    pdf.addImage(imgData, 'JPEG', 0, 0, RECEIPT_WIDTH_MM, heightMM);
    pdf.save(filename);
  } finally {
    document.body.removeChild(el);
  }
}

// ─── Public exports ───────────────────────────────────────────────────────────

export type AnalyticsPdfPayload = {
  periodLine: string;
  presetLine: string;
  kpi: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
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

export type SupplierExpensesPdfPayload = {
  groupBy: 'list' | 'supplier' | 'day' | 'month' | 'year';
  filterNote: string;
  total: number;
  listRows: { date: string; supplierName: string; invoiceNumber: string; amount: number }[];
  supplierRows: { supplierName: string; count: number; total: number }[];
  bucketRows: { periodLabel: string; count: number; total: number }[];
};

export async function downloadReportsPdf(opts: {
  filename: string;
  isRTL: boolean;
  currencyUnit: string;
  labels: Record<string, string>;
  mode: 'analytics' | 'sales_transactions' | 'sales_by_product' | 'activities' | 'supplier_expenses';
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
  supplierExpenses?: SupplierExpensesPdfPayload;
}): Promise<void> {
  const { isRTL, currencyUnit: cu, labels: L } = opts;
  const pdf = newA4Pdf();
  const first = { value: true };
  const logo = await getLogoDataUrl();

  if (opts.mode === 'analytics' && opts.analytics) {
    const a = opts.analytics;
    const headInner =
      banner(L, L.analytics, [a.periodLine, a.presetLine, L.reportPdfFilteredNote], logo) +
      `<div style="padding:0 22px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          ${kpiCard(L.totalRevenue, `${a.kpi.totalRevenue.toLocaleString()} ${cu}`)}
          ${kpiCard(L.costs, `${a.kpi.totalCosts.toLocaleString()} ${cu}`)}
          ${kpiCard(L.grossProfit, `${a.kpi.grossProfit.toLocaleString()} ${cu}`)}
          ${kpiCard(L.operatingExpenses, `${a.kpi.operatingExpenses.toLocaleString()} ${cu}`)}
          ${kpiCard(L.netProfit, `${a.kpi.netProfit.toLocaleString()} ${cu}`)}
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
            ${a.orderStatusRows.map((r) => `<span style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:700;color:#334155;">${esc(r.label)}: ${r.value}</span>`).join('')}
          </div>
        </div>
      </div>`;
    const headEl = document.createElement('div');
    headEl.innerHTML = wrapRoot(isRTL, headInner);

    const chartChunks = chunkArray(a.chartRows, 36);
    const chartEls: HTMLElement[] = chartChunks.map((rows, idx) => {
      const tableRows = rows.map((r) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;">${esc(r.dayLabel)}</td><td style="padding:8px 10px;text-align:end;">${r.revenue.toLocaleString()} ${esc(cu)}</td><td style="padding:8px 10px;text-align:end;">${r.orders}</td></tr>`).join('');
      const inner =
        banner(L, L.salesTrends, [`${L.reportPdfDailyBreakdown} · ${idx + 1}/${chartChunks.length}`, L.reportPdfFilteredNote], logo) +
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

    const catRows = a.categories.map((c, i) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;"><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${['#3b82f6','#10b981','#6366f1','#06b6d4'][i % 4]};margin-inline-end:8px;"></span>${esc(c.label)}</td><td style="padding:8px 10px;text-align:end;">${c.count} ${esc(L.units)}</td></tr>`).join('');
    const topRows = a.topSellers.map((p) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;font-weight:800;color:#475569;">#${p.rank}</td><td style="padding:8px 10px;">${esc(p.name)}<div style="font-size:10px;color:#64748b;">${esc(p.category)}</div></td><td style="padding:8px 10px;text-align:end;font-weight:700;color:#1e293b;">${p.units} ${esc(L.units)}</td></tr>`).join('');
    const invRows = a.inventoryRows.map((m) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;">${esc(m.name)}</td><td style="padding:8px 10px;text-align:end;color:#1e293b;font-weight:700;">${esc(m.consumption)} ${esc(L.units)}</td><td style="padding:8px 10px;text-align:end;">${m.stock}</td></tr>`).join('');

    const tailInner =
      banner(L, `${L.salesByCategory} / ${L.topSellers} / ${L.inventoryConsumption}`, [L.reportPdfFilteredNote], logo) +
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
      const rows = batch.map((sale) => {
        const items = parseSaleItems(sale);
        const prodLines = items.map((it) => `${it.quantity}× ${getLineItemLabel(it)}`).join('<br/>');
        return `<tr style="border-bottom:1px solid #f1f5f9;vertical-align:top;">
          <td style="padding:10px 8px;width:12%;font-weight:800;font-family:monospace;font-size:10px;color:#334155;">${esc(generateTransactionId(sale.createdAt))}</td>
          <td style="padding:10px 8px;width:14%;"><div style="font-weight:800;">${esc(formatSaleDate(sale.createdAt))}</div><div style="font-size:10px;color:#64748b;">${esc(formatSaleTime(sale.createdAt))}</div></td>
          <td style="padding:10px 8px;width:16%;font-weight:700;">${esc(sale.cashierName || '—')}</td>
          <td style="padding:10px 8px;width:12%;"><span style="background:#f1f5f9;color:#334155;font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;border:1px solid #cbd5e1;">${esc(getPaymentLabel(sale.paymentMethod))}</span></td>
          <td style="padding:10px 8px;font-size:10.5px;">${prodLines || '—'}</td>
          <td style="padding:10px 8px;text-align:end;font-weight:800;white-space:nowrap;">${sale.totalAmount.toLocaleString()} ${esc(cu)}</td>
        </tr>`;
      }).join('');
      const inner =
        banner(L, title, [filterNote, `${L.records}: ${sales.length} · ${idx + 1}/${chunks.length}`], logo) +
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
      const body = batch.map((r) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px;font-weight:700;">${esc(r.name)}</td><td style="padding:10px;">${r.quantity}</td><td style="padding:10px;">${r.revenue.toLocaleString()} ${esc(cu)}</td><td style="padding:10px;text-align:end;font-weight:800;">${r.saleCount}</td></tr>`).join('');
      const inner =
        banner(L, title, [filterNote, `${L.products}: ${rows.length} · ${idx + 1}/${chunks.length}`], logo) +
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
      const blocks = batch.map((log) => {
        const when = log.timestamp ? formatLogTime(log.timestamp) : '—';
        return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <span style="font-weight:800;">${esc(log.userName || '—')}</span>
            <span style="font-size:10px;color:#64748b;">${esc(when)}</span>
          </div>
          <div><span style="color:#1e293b;font-weight:800;">${esc(log.action)}</span><span style="color:#475569;">: ${esc(log.details || '')}</span></div>
        </div>`;
      }).join('');
      const inner =
        banner(L, L.activities, [filterNote, `${L.records}: ${logs.length} · ${idx + 1}/${chunks.length}`], logo) +
        `<div style="padding:0 18px;">${blocks}</div>`;
      const el = document.createElement('div');
      el.innerHTML = wrapRoot(isRTL, inner);
      return el;
    });
    await flushChunks(pdf, elements, first);

  } else if (opts.mode === 'supplier_expenses' && opts.supplierExpenses) {
    const se = opts.supplierExpenses;
    const chartRows =
      se.groupBy === 'supplier'
        ? se.supplierRows.map((r) => ({ label: r.supplierName, total: r.total }))
        : se.groupBy === 'list'
          ? []
          : se.bucketRows.map((r) => ({ label: r.periodLabel, total: r.total }));
    const maxTotal = Math.max(1, ...chartRows.map((r) => r.total));
    const totalCount =
      se.groupBy === 'list' ? se.listRows.length : se.groupBy === 'supplier' ? se.supplierRows.reduce((s, r) => s + r.count, 0) : se.bucketRows.reduce((s, r) => s + r.count, 0);

    const chartInner = chartRows.length
      ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:800;margin-bottom:12px;">${esc(L.supplierExpenses)}</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${chartRows
              .map(
                (r) => `<div style="display:flex;align-items:center;gap:8px;">
              <div style="width:110px;font-size:10px;font-weight:700;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.label)}</div>
              <div style="flex:1;background:#f1f5f9;border-radius:6px;overflow:hidden;height:14px;">
                <div style="height:100%;background:#d97706;width:${Math.max(2, (r.total / maxTotal) * 100)}%;"></div>
              </div>
              <div style="width:90px;text-align:end;font-size:10px;font-weight:800;">${r.total.toLocaleString()} ${esc(cu)}</div>
            </div>`
              )
              .join('')}
          </div>
        </div>`
      : '';

    const headInner =
      banner(L, L.supplierExpenses, [se.filterNote, L.reportPdfFilteredNote], logo) +
      `<div style="padding:0 22px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          ${kpiCard(L.supplierExpenses, `${se.total.toLocaleString()} ${cu}`)}
          ${kpiCard(L.invoiceCount, String(totalCount))}
        </div>
        ${chartInner}
      </div>`;
    const headEl = document.createElement('div');
    headEl.innerHTML = wrapRoot(isRTL, headInner);

    let tableElements: HTMLElement[] = [];
    if (se.groupBy === 'list') {
      const chunks = chunkArray(se.listRows, 30);
      tableElements = chunks.map((batch, idx) => {
        const body = batch
          .map(
            (r) =>
              `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;">${esc(r.date)}</td><td style="padding:8px 10px;">${esc(r.supplierName)}</td><td style="padding:8px 10px;font-family:monospace;font-size:10px;">${esc(r.invoiceNumber)}</td><td style="padding:8px 10px;text-align:end;font-weight:800;">${r.amount.toLocaleString()} ${esc(cu)}</td></tr>`
          )
          .join('');
        const inner =
          banner(L, L.supplierExpenses, [se.filterNote, `${idx + 1}/${chunks.length}`], logo) +
          `<div style="padding:0 18px;">
            <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:14px;font-size:11px;">
              <thead><tr style="background:#f8fafc;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;">
                <th style="padding:10px;text-align:start;">${esc(L.fromDate)}</th>
                <th style="padding:10px;text-align:start;">${esc(L.supplier)}</th>
                <th style="padding:10px;text-align:start;">${esc(L.invoiceNumber)}</th>
                <th style="padding:10px;text-align:end;">${esc(L.amount)}</th>
              </tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>`;
        const el = document.createElement('div');
        el.innerHTML = wrapRoot(isRTL, inner);
        return el;
      });
    } else if (se.groupBy === 'supplier') {
      const body = se.supplierRows
        .map(
          (r) =>
            `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;font-weight:700;">${esc(r.supplierName)}</td><td style="padding:8px 10px;text-align:end;">${r.count}</td><td style="padding:8px 10px;text-align:end;font-weight:800;">${r.total.toLocaleString()} ${esc(cu)}</td></tr>`
        )
        .join('');
      const inner = `<div style="padding:0 18px;">
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:14px;font-size:11px;">
          <thead><tr style="background:#f8fafc;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;">
            <th style="padding:10px;text-align:start;">${esc(L.supplier)}</th>
            <th style="padding:10px;text-align:end;">${esc(L.invoiceCount)}</th>
            <th style="padding:10px;text-align:end;">${esc(L.amount)}</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
      const el = document.createElement('div');
      el.innerHTML = wrapRoot(isRTL, inner);
      tableElements = [el];
    } else {
      const body = se.bucketRows
        .map(
          (r) =>
            `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 10px;font-weight:700;">${esc(r.periodLabel)}</td><td style="padding:8px 10px;text-align:end;">${r.count}</td><td style="padding:8px 10px;text-align:end;font-weight:800;">${r.total.toLocaleString()} ${esc(cu)}</td></tr>`
        )
        .join('');
      const inner = `<div style="padding:0 18px;">
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:14px;font-size:11px;">
          <thead><tr style="background:#f8fafc;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;">
            <th style="padding:10px;text-align:start;">${esc(L.period)}</th>
            <th style="padding:10px;text-align:end;">${esc(L.invoiceCount)}</th>
            <th style="padding:10px;text-align:end;">${esc(L.amount)}</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
      const el = document.createElement('div');
      el.innerHTML = wrapRoot(isRTL, inner);
      tableElements = [el];
    }

    await flushChunks(pdf, [headEl, ...tableElements], first);
  }

  pdf.save(opts.filename);
}

export async function downloadInvoicePdf(opts: {
  filename: string;
  isRTL: boolean;
  currencyUnit: string;
  labels: Record<string, string>;
  orderId: string;
  date: string;
  status: string;
  clientName: string;
  customerId?: string;
  items: { name: string; quantity: number; price: number; specifications?: string[] }[];
  totalAmount: number;
  notes?: string;
  amountPaid?: number;
  showBalance?: boolean;
}): Promise<void> {
  const { isRTL, currencyUnit: cu, labels: L } = opts;

  const itemBlocks = opts.items.map((item) => `
    <div style="margin-bottom:8px;">
      <div style="font-weight:700;">${esc(item.name)}</div>
      ${item.specifications && item.specifications.length ? `<div style="color:#555;font-size:10px;">${esc(item.specifications.join(' · '))}</div>` : ''}
      <div style="display:flex;justify-content:space-between;">
        <span>×${item.quantity} @ ${item.price.toLocaleString()} ${esc(cu)}</span>
        <span style="font-weight:700;">${(item.quantity * item.price).toLocaleString()} ${esc(cu)}</span>
      </div>
    </div>`).join('');

  const balanceRows = opts.showBalance ? `
    <div style="display:flex;justify-content:space-between;">
      <span>${esc(L.amountPaid || 'AMOUNT PAID')}</span>
      <span>${(opts.amountPaid || 0).toLocaleString()} ${esc(cu)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>${esc(L.balanceDue || 'BALANCE DUE')}</span>
      <span>${Math.max(0, opts.totalAmount - (opts.amountPaid || 0)).toLocaleString()} ${esc(cu)}</span>
    </div>` : '';

  const notesHtml = opts.notes ? `
    <div style="border-top:1px solid #999;margin:8px 0;"></div>
    <div style="font-weight:700;">${esc(L.notes || 'NOTES')}</div>
    <div style="white-space:pre-wrap;">${esc(opts.notes)}</div>` : '';

  const fontStack = isRTL ? '"Cairo", sans-serif' : "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  const inner = `
    <div dir="${isRTL ? 'rtl' : 'ltr'}" style="width:${RECEIPT_PAGE_PX}px;background:#fff;color:#000;font-family:${fontStack};font-size:11px;line-height:1.5;padding:8px;box-sizing:border-box;">
      <div style="text-align:center;margin-bottom:8px;">
        <div style="font-weight:700;font-size:13px;">Bella Dolce</div>
        <div>123 Bakery Street</div>
        <div>City, Country</div>
        <div>Phone: +123 456 789</div>
      </div>
      <div style="border-top:1px solid #999;margin:8px 0;"></div>
      <div style="font-weight:700;">${esc(L.invoiceDocumentTitle || 'INVOICE')} #${esc(opts.orderId)}</div>
      <div>${esc(L.date || 'DATE')}: ${esc(opts.date)}</div>
      <div>${esc(L.status || 'STATUS')}: ${esc(opts.status)}</div>
      <div>${esc(L.billTo || 'BILL TO')}: ${esc(opts.clientName || L.walkInCustomer || 'Walk-in Customer')}</div>
      ${opts.customerId ? `<div>${esc(L.customerIdLabel?.replace('{{id}}', opts.customerId) || opts.customerId)}</div>` : ''}
      <div style="border-top:1px solid #999;margin:8px 0;"></div>
      ${itemBlocks || `<div style="color:#888;">—</div>`}
      <div style="border-top:1px solid #999;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;">
        <span>${esc(L.subtotal || 'SUBTOTAL')}</span>
        <span>${opts.totalAmount.toLocaleString()} ${esc(cu)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>${esc(L.taxZeroPercent || 'TAX (0%)')}</span>
        <span>0 ${esc(cu)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;margin-top:4px;">
        <span>${esc(L.totalAmount || 'TOTAL')}</span>
        <span>${opts.totalAmount.toLocaleString()} ${esc(cu)}</span>
      </div>
      ${balanceRows}
      ${notesHtml}
      <div style="border-top:1px solid #999;margin:8px 0;"></div>
      <div style="text-align:center;font-style:italic;">${esc(L.invoiceThankYou || 'Thank you for your business.')}</div>
    </div>`;

  await saveReceiptPdf(opts.filename, inner);
}

// ─── Payslip PDF ──────────────────────────────────────────────────────────────

export async function downloadPayslipPdf(opts: {
  filename: string;
  isRTL: boolean;
  currencyUnit: string;
  labels: Record<string, string>;
  configSnapshot?: string;
  slip: {
    employeeName: string;
    period: string;
    matricule?: string;
    nin?: string;
    cnasNumber?: string;
    bankRIB?: string;
    baseSalary: number;
    transportAllowance: number;
    performanceBonus: number;
    otherAllowances: number;
    grossSalary: number;
    cnasEmployee: number;
    taxableGross: number;
    irgAbatement?: number;
    irgRetained: number;
    otherDeductions?: number;
    netSalary: number;
    cnasEmployer: number;
    totalEmployerCost: number;
  };
}): Promise<void> {
  const { isRTL, currencyUnit: cu, labels: L, slip } = opts;
  const logo = await getLogoDataUrl();

  // Parse employer data from configSnapshot (falls back to empty strings)
  let cfg: { companyName?: string; companyAddress?: string; nif?: string; nis?: string; rc?: string; cnasRegistration?: string } = {};
  try { if (opts.configSnapshot) cfg = JSON.parse(opts.configSnapshot); } catch { /* ignore */ }

  const locale = isRTL ? 'ar-DZ' : 'fr-DZ';
  const fmt = (n: number) => `${n.toLocaleString(locale)} ${cu}`;
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const C = {
    bg: '#ffffff', white: '#ffffff', border: '#d1d5db',
    headBg: '#f9fafb', text: '#000000', muted: '#6b7280', label: '#4b5563',
    earn: '#000000', earnBg: '#f3f4f6', earnBdr: '#d1d5db',
    ded: '#000000', dedBg: '#f3f4f6', dedBdr: '#d1d5db',
    net: '#000000', netBg: '#f3f4f6', netBdr: '#000000',
    rule: '#9ca3af',
  };

  const row = (label: string, value: string, o: { bold?: boolean; color?: string; bg?: string; size?: string } = {}) =>
    `<tr style="${o.bg ? `background:${o.bg};` : ''}">
      <td style="padding:7px 12px;font-size:${o.size || '11px'};color:${o.color || C.text};font-weight:${o.bold ? '700' : '400'};">${esc(label)}</td>
      <td style="padding:7px 12px;text-align:end;font-size:${o.size || '11px'};color:${o.color || C.text};font-weight:700;">${value}</td>
    </tr>`;

  const section = (title: string, accent: string, bg: string, bdr: string, rows: string) =>
    `<div style="border:1px solid ${bdr};border-radius:6px;overflow:hidden;margin-bottom:8px;">
      <div style="background:${bg};padding:8px 12px;border-bottom:1px solid ${bdr};">
        <span style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${C.text};">${esc(title)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:${C.white};">
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  const logoHtml = logo
    ? `<img src="${logo}" style="height:48px;width:auto;object-fit:contain;" />`
    : `<span style="font-size:16px;font-weight:800;color:${C.text};">Bella Dolce</span>`;

  // Employer identity block — read from configSnapshot
  const employerName = cfg.companyName || 'Bella Dolce';
  const employerAddress = cfg.companyAddress || '';
  const employerIds = [
    cfg.nif ? `NIF : ${cfg.nif}` : '',
    cfg.nis ? `NIS : ${cfg.nis}` : '',
    cfg.rc ? `RC : ${cfg.rc}` : '',
    cfg.cnasRegistration ? `CNAS : ${cfg.cnasRegistration}` : '',
  ].filter(Boolean).join(' | ');

  // Deduction rows
  const irgExempt = slip.irgRetained === 0 && slip.taxableGross <= 10000;
  const irgRows =
    irgExempt
      ? row(L.irgExemptLabel || 'IRG : Non imposable (revenu ≤ 10 000 DA)', '0 ' + cu, { color: C.text })
      : (slip.irgAbatement !== undefined && slip.irgAbatement > 0
          ? row(L.irgBeforeRebateLabel || 'IRG brut (avant abattement)', fmt(slip.irgRetained + slip.irgAbatement), { color: C.text }) +
            row(L.irgRebateLabel || 'Abattement', `– ${fmt(slip.irgAbatement)}`, { color: C.text }) +
            row(L.irgAfterRebateLabel || 'IRG net retenu', fmt(slip.irgRetained), { bold: true, color: C.text, size: '13px' })
          : row(L.irgRetained || 'IRG Retenu', fmt(slip.irgRetained), { bold: true, color: C.text, size: '13px' })
        );

  const otherDedRow = (slip.otherDeductions ?? 0) > 0
    ? row(L.otherDeductionsLabel || 'Autres retenues', `– ${fmt(slip.otherDeductions!)}`, { color: C.text })
    : '';

  const fontFamily = isRTL ? '"Cairo",Arial,sans-serif' : 'Arial,Helvetica,sans-serif';

  const html = `<div dir="${isRTL ? 'rtl' : 'ltr'}" style="font-family:${fontFamily};width:${PDF_PAGE_PX}px;background:${C.bg};box-sizing:border-box;">

  <!-- HEADER -->
  <div style="background:${C.headBg};border-bottom:2px solid ${C.border};padding:16px 28px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      ${logoHtml}
      <div style="text-align:end;">
        <div style="font-size:9px;font-weight:800;letter-spacing:0.10em;text-transform:uppercase;color:${C.label};margin-bottom:4px;">${esc(L.payslip || 'BULLETIN DE PAIE')}</div>
        <div style="font-size:18px;font-weight:800;color:${C.text};font-family:monospace;">${esc(slip.period)}</div>
      </div>
    </div>
  </div>

  <!-- EMPLOYER / EMPLOYEE -->
  <div style="background:${C.white};border-bottom:2px solid ${C.border};padding:12px 28px;display:flex;gap:0;">
    <div style="flex:1;padding-inline-end:20px;border-inline-end:2px solid ${C.border};">
      <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.09em;color:${C.label};margin-bottom:4px;">${esc(L.payslipEmployerLabel || 'EMPLOYEUR')}</div>
      <div style="font-size:12px;font-weight:800;color:${C.text};margin-bottom:3px;">${esc(employerName)}</div>
      <div style="font-size:9px;color:${C.muted};line-height:1.5;">
        ${employerAddress ? esc(employerAddress) + '<br/>' : ''}
        ${employerIds ? esc(employerIds) : ''}
      </div>
    </div>
    <div style="flex:1;padding-inline-start:20px;">
      <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.09em;color:${C.label};margin-bottom:4px;">${esc(L.employee || 'EMPLOYÉ')}</div>
      <div style="font-size:13px;font-weight:800;color:${C.text};margin-bottom:4px;">${esc(slip.employeeName)}</div>
      <div style="font-size:9px;color:${C.muted};line-height:1.5;">
        ${slip.matricule ? `<div><span style="font-weight:700;color:${C.text};">${esc(L.matriculeLabel || 'Matricule')} :</span> ${esc(slip.matricule)}</div>` : ''}
        ${slip.nin ? `<div><span style="font-weight:700;color:${C.text};">${esc(L.ninLabel || 'NIN')} :</span> ${esc(slip.nin)}</div>` : ''}
        ${slip.cnasNumber ? `<div><span style="font-weight:700;color:${C.text};">${esc(L.cnasNumberLabel || 'N° CNAS')} :</span> ${esc(slip.cnasNumber)}</div>` : ''}
        ${slip.bankRIB ? `<div><span style="font-weight:700;color:${C.text};">RIB :</span> ${esc(slip.bankRIB)}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div style="padding:12px 28px 0;">

    ${section(
      L.earningsSectionLabel || 'RÉMUNÉRATIONS', C.earn, C.earnBg, C.earnBdr,
      row(L.baseSalary || 'Salaire de Base', fmt(slip.baseSalary), { bold: true }) +
      row(L.transportAllowanceLabel || 'Indemnité Transport', fmt(slip.transportAllowance)) +
      row(L.payrollBonusLabel || 'Prime de Performance', fmt(slip.performanceBonus)) +
      row(L.otherAllowancesLabel || 'Autres Indemnités', fmt(slip.otherAllowances)) +
      row(L.grossSalary || 'Salaire Brut', fmt(slip.grossSalary), { bold: true, color: C.earn, bg: C.earnBg, size: '13px' })
    )}

    ${section(
      L.deductionsSectionLabel || 'RETENUES OBLIGATOIRES', C.ded, C.dedBg, C.dedBdr,
      row(L.cnasBaseLabel || 'Assiette CNAS', fmt(slip.grossSalary - slip.transportAllowance)) +
      row(L.cnasEmployee || 'CNAS Salarié (9%)', `– ${fmt(slip.cnasEmployee)}`, { color: C.ded }) +
      row(L.taxableGross || 'Brut Imposable', fmt(slip.taxableGross)) +
      irgRows +
      otherDedRow
    )}

    ${section(
      L.employerCostSectionLabel || 'COÛT EMPLOYEUR', C.muted, C.headBg, C.border,
      row(L.cnasEmployerLabel || 'CNAS Patronale (26%)', fmt(slip.cnasEmployer)) +
      row(L.employerCost || 'Coût Total Employeur', fmt(slip.totalEmployerCost), { bold: true, size: '13px' })
    )}

    <!-- NET TO PAY -->
    <div style="background:${C.netBg};border:2px solid ${C.netBdr};border-radius:6px;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${C.net};">${esc(L.payslipNetToPayLabel || 'NET À PAYER')}</div>
      <div style="font-size:24px;font-weight:800;color:${C.net};font-family:monospace;">${fmt(slip.netSalary)}</div>
    </div>

    <!-- FOOTER -->
    <div style="border-top:2px solid ${C.rule};padding:12px 0;margin-top:10px;">
      <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:8px;">
        <div style="flex:1;">
          <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:${C.label};margin-bottom:3px;">${esc(L.payslipEmployerLabel || 'CONTACT')}</div>
          <div style="font-size:9px;color:${C.text};line-height:1.6;">
            ${esc(employerName)}<br/>
            ${employerAddress ? esc(employerAddress) + '<br/>' : ''}
            ${cfg.shopPhone ? '<strong style="color:' + C.text + ';">Tél :</strong> ' + esc(cfg.shopPhone) + '<br/>' : ''}
            ${cfg.shopEmail ? '<strong style="color:' + C.text + ';">Email :</strong> ' + esc(cfg.shopEmail) : ''}
          </div>
        </div>
        <div style="flex:1;">
          <div style="font-size:8px;color:${C.label};line-height:1.6;">
            <div style="margin-bottom:8px;">
              <div style="font-weight:800;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">${esc(L.payslipSignatureLabel || 'Signature & cachet')}</div>
              <div style="border-top:1px solid ${C.rule};width:100%;margin-top:6px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div style="font-size:7px;color:${C.muted};line-height:1.5;margin-top:8px;border-top:1px solid ${C.rule};padding-top:6px;">
        ${esc(L.payslipGeneratedOn || 'Document généré le')} ${today}<br/>
        ${esc(L.payslipLegalNote || 'Ce bulletin est établi conformément à la législation algérienne en vigueur.')}
      </div>
    </div>

  </div>
</div>`;

  const pdf = newA4Pdf();
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '-9999px';
  el.style.width = `${PDF_PAGE_PX}px`;
  el.innerHTML = html;
  document.body.appendChild(el);
  try {
    const canvas = await renderHtmlToCanvas(el);
    addCanvasToPdf(pdf, canvas, false);
  } finally {
    document.body.removeChild(el);
  }
  pdf.save(opts.filename);
}

// ─── IFU G12 Annual Summary PDF ────────────────────────────────────────────────

export async function downloadG12Pdf(opts: {
  filename: string;
  isRTL: boolean;
  currencyUnit: string;
  labels: Record<string, string>;
  declaration: {
    year: number;
    grossTurnover: number;
    taxRatePercent: number;
    taxAmountDue: number;
    status: string;
    submittedAt?: string;
    configSnapshot?: string;
  };
  monthlyTurnover: Record<number, number>;
  companyName?: string;
  companyAddress?: string;
  nif?: string;
  nis?: string;
  rc?: string;
  submissionDate?: string;
}): Promise<void> {
  const { isRTL, currencyUnit: cu, labels: L, declaration, monthlyTurnover, submissionDate } = opts;
  const pdf = newA4Pdf();
  const first = { value: true };
  const logo = await getLogoDataUrl();

  // Parse company info from configSnapshot or use defaults
  let cfg: Record<string, any> = {};
  try { if (declaration.configSnapshot) cfg = JSON.parse(declaration.configSnapshot); } catch { /* ignore */ }

  const companyName = opts.companyName || cfg.companyName || 'Bella Dolce';
  const companyAddress = opts.companyAddress || cfg.companyAddress || '';
  const nif = opts.nif || cfg.nif || '';
  const nis = opts.nis || cfg.nis || '';
  const rc = opts.rc || cfg.rc || '';

  // Format values for display
  const fmt = (n: number) => `${n.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} ${cu}`;
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  // Month names in French/Arabic
  const monthNames = [
    isRTL
      ? ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  ][0];

  // Build monthly table rows
  const monthRows = Object.entries(monthlyTurnover)
    .map(([monthStr, amount]) => {
      const monthNum = parseInt(monthStr);
      return `<tr style="border-bottom:1px solid #e8dcc8;">
        <td style="padding:10px 12px;color:#8b7355;font-size:11px;">${esc(monthNames[monthNum - 1])}</td>
        <td style="padding:10px 12px;text-align:end;color:#1c1208;font-weight:700;font-family:monospace;font-size:11px;">${fmt(amount)}</td>
      </tr>`;
    })
    .join('');

  const monthTotalRow = `<tr style="background:#f0e8d8;border-bottom:1px solid #e8dcc8;">
    <td style="padding:12px;font-weight:800;color:#1c1208;">${esc(L.total || 'Total')}</td>
    <td style="padding:12px;text-align:end;font-weight:800;color:#1c1208;font-family:monospace;font-size:12px;">${fmt(declaration.grossTurnover)}</td>
  </tr>`;

  const statusColor = declaration.status === 'SOUMIS'
    ? '#059669'
    : declaration.status === 'FINALISÉ'
      ? '#0284c7'
      : '#b45309';

  const inner =
    banner(L, `${L.ifuG12Annual || 'DÉCLARATION IFU (G12)'} — ${declaration.year}`, [
      companyName,
      companyAddress,
      nif ? `NIF: ${nif}` : '',
      nis ? `NIS: ${nis}` : '',
      rc ? `RC: ${rc}` : '',
    ].filter(Boolean), logo) +
    `<div style="padding:0 22px;">

    <!-- STATUS BADGE -->
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;background:#fff;border:1px solid #e8dcc8;border-radius:12px;padding:12px 16px;">
        <div style="font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${esc(L.ifuStatus || 'Statut')}</div>
        <div style="font-size:13px;font-weight:800;margin-top:4px;color:${statusColor};">${esc(
          declaration.status === 'SOUMIS' ? (L.ifuStatusSubmitted || 'SOUMIS') :
          declaration.status === 'FINALISÉ' ? (L.ifuStatusFinalized || 'FINALISÉ') :
          (L.ifuStatusDraft || 'BROUILLON')
        )}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e8dcc8;border-radius:12px;padding:12px 16px;">
        <div style="font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${esc(L.date || 'Date de soumission')}</div>
        <div style="font-size:12px;font-weight:700;margin-top:4px;color:#1c1208;">${esc(submissionDate || '—')}</div>
      </div>
    </div>

    <!-- MONTHLY BREAKDOWN TABLE -->
    <div style="background:#fff;border:1px solid #e8dcc8;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:12px 16px;font-weight:800;border-bottom:1px solid #e8dcc8;background:#f0e8d8;">
        ${esc(L.ifuMonthlyBreakdown || 'Détail mensuel')}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #e8dcc8;background:#faf7f2;">
            <th style="padding:10px 12px;text-align:start;font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;">${esc(L.month || 'Mois')}</th>
            <th style="padding:10px 12px;text-align:end;font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;">${esc(L.amount || 'Montant')}</th>
          </tr>
        </thead>
        <tbody>${monthRows}${monthTotalRow}</tbody>
      </table>
    </div>

    <!-- SUMMARY CARDS -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
      ${kpiCard(L.ifuAnnualTurnover || 'CA Annuel', fmt(declaration.grossTurnover))}
      ${kpiCard(L.ifuApplicableRate || 'Taux IFU', fmtPct(declaration.taxRatePercent))}
      ${kpiCard(L.ifuTaxDue || 'IFU à payer', fmt(declaration.taxAmountDue))}
    </div>

    <!-- FOOTER -->
    <div style="border-top:1px solid #e8dcc8;padding-top:16px;margin-top:20px;font-size:9px;color:#8b7355;">
      <p>${esc(L.ifuDeclaration || 'Déclaration établie conformément à la réglementation fiscale algérienne')}</p>
      <p style="margin-top:6px;">Généré le ${esc(new Date().toLocaleDateString(isRTL ? 'ar-DZ' : 'fr-DZ'))}</p>
    </div>

    </div>`;

  const el = document.createElement('div');
  el.innerHTML = wrapRoot(isRTL, inner);
  await flushChunks(pdf, [el], first);
  pdf.save(opts.filename);
}

// ─── IFU G50ter Quarterly Summary PDF ──────────────────────────────────────────

export async function downloadG50TerPdf(opts: {
  filename: string;
  isRTL: boolean;
  currencyUnit: string;
  labels: Record<string, string>;
  declaration: {
    year: number;
    quarter: number;
    employeeCount: number;
    totalGrossPayroll: number;
    totalIrgWithheld: number;
    status: string;
    submittedAt?: string;
    configSnapshot?: string;
  };
  companyName?: string;
  companyAddress?: string;
  nif?: string;
  nis?: string;
  rc?: string;
  submissionDate?: string;
}): Promise<void> {
  const { isRTL, currencyUnit: cu, labels: L, declaration, submissionDate } = opts;
  const pdf = newA4Pdf();
  const first = { value: true };
  const logo = await getLogoDataUrl();

  // Parse company info from configSnapshot or use defaults
  let cfg: Record<string, any> = {};
  try { if (declaration.configSnapshot) cfg = JSON.parse(declaration.configSnapshot); } catch { /* ignore */ }

  const companyName = opts.companyName || cfg.companyName || 'Bella Dolce';
  const companyAddress = opts.companyAddress || cfg.companyAddress || '';
  const nif = opts.nif || cfg.nif || '';
  const nis = opts.nis || cfg.nis || '';
  const rc = opts.rc || cfg.rc || '';

  // Format values for display
  const fmt = (n: number) => `${n.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} ${cu}`;

  // Quarter name
  const quarterLabel = isRTL
    ? ['Q1 (يناير–مارس)', 'Q2 (أبريل–يونيو)', 'Q3 (يوليو–سبتمبر)', 'Q4 (أكتوبر–ديسمبر)'][declaration.quarter - 1]
    : [`Q${declaration.quarter} (Jan–Mar)`, `Q${declaration.quarter} (Avr–Jun)`, `Q${declaration.quarter} (Jul–Sep)`, `Q${declaration.quarter} (Oct–Dec)`][declaration.quarter - 1];

  const statusColor = declaration.status === 'SOUMIS'
    ? '#059669'
    : declaration.status === 'FINALISÉ'
      ? '#0284c7'
      : '#b45309';

  const inner =
    banner(L, `${L.ifuG50Quarterly || 'DÉCLARATION G50 TER'} — ${declaration.year}`, [
      companyName,
      companyAddress,
      nif ? `NIF: ${nif}` : '',
      nis ? `NIS: ${nis}` : '',
      rc ? `RC: ${rc}` : '',
    ].filter(Boolean), logo) +
    `<div style="padding:0 22px;">

    <!-- PERIOD & STATUS -->
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;background:#fff;border:1px solid #e8dcc8;border-radius:12px;padding:12px 16px;">
        <div style="font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${esc(L.period || 'Période')}</div>
        <div style="font-size:13px;font-weight:800;margin-top:4px;color:#1c1208;">${esc(quarterLabel)}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e8dcc8;border-radius:12px;padding:12px 16px;">
        <div style="font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${esc(L.ifuStatus || 'Statut')}</div>
        <div style="font-size:12px;font-weight:800;margin-top:4px;color:${statusColor};">${esc(
          declaration.status === 'SOUMIS' ? (L.ifuStatusSubmitted || 'SOUMIS') :
          declaration.status === 'FINALISÉ' ? (L.ifuStatusFinalized || 'FINALISÉ') :
          (L.ifuStatusDraft || 'BROUILLON')
        )}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e8dcc8;border-radius:12px;padding:12px 16px;">
        <div style="font-size:9px;color:#8b7355;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${esc(L.date || 'Date de soumission')}</div>
        <div style="font-size:11px;font-weight:700;margin-top:4px;color:#1c1208;">${esc(submissionDate || '—')}</div>
      </div>
    </div>

    <!-- PAYROLL BREAKDOWN TABLE -->
    <div style="background:#fff;border:1px solid #e8dcc8;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:12px 16px;font-weight:800;border-bottom:1px solid #e8dcc8;background:#f0e8d8;">
        ${esc(L.ifuQuarterlyBreakdown || 'Résumé trimestriel')}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr style="border-bottom:1px solid #e8dcc8;">
            <td style="padding:12px 16px;color:#8b7355;font-weight:700;">${esc(L.ifuEmployeeCount || 'Nombre d\'employés')}</td>
            <td style="padding:12px 16px;text-align:end;color:#1c1208;font-weight:800;font-family:monospace;font-size:12px;">${declaration.employeeCount}</td>
          </tr>
          <tr style="border-bottom:1px solid #e8dcc8;">
            <td style="padding:12px 16px;color:#8b7355;font-weight:700;">${esc(L.ifuTotalGrossPayroll || 'Masse salariale brute')}</td>
            <td style="padding:12px 16px;text-align:end;color:#1c1208;font-weight:800;font-family:monospace;font-size:12px;">${fmt(declaration.totalGrossPayroll)}</td>
          </tr>
          <tr style="background:#f0e8d8;">
            <td style="padding:12px 16px;font-weight:800;color:#1c1208;">${esc(L.ifuTotalIrgWithheld || 'IRG retenu')}</td>
            <td style="padding:12px 16px;text-align:end;font-weight:800;color:#1c1208;font-family:monospace;font-size:13px;">${fmt(declaration.totalIrgWithheld)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="border-top:1px solid #e8dcc8;padding-top:16px;margin-top:20px;font-size:9px;color:#8b7355;">
      <p>${esc(L.ifuG50TerNote || 'Déclaration G50 ter établie conformément à la réglementation fiscale algérienne')}</p>
      <p style="margin-top:6px;">Généré le ${esc(new Date().toLocaleDateString(isRTL ? 'ar-DZ' : 'fr-DZ'))}</p>
    </div>

    </div>`;

  const el = document.createElement('div');
  el.innerHTML = wrapRoot(isRTL, inner);
  await flushChunks(pdf, [el], first);
  pdf.save(opts.filename);
}
