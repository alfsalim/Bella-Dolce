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

function invoiceBanner(title: string, orderId: string, storeAddress: string[], logoSrc: string): string {
  const addrLines = storeAddress.map((l) => `<div style="font-size:11px;color:${BANNER_MUTED};margin-top:2px;">${esc(l)}</div>`).join('');
  const logoHtml = logoSrc
    ? `<div style="text-align:center;margin-bottom:16px;"><img src="${logoSrc}" style="height:80px;width:auto;object-fit:contain;" /></div>`
    : '';
  return `
<div style="background:${BANNER_BG};border-bottom:2px solid ${BANNER_BORDER};padding:28px 32px 24px;margin-bottom:0;">
  ${logoHtml}
  <div style="display:flex;align-items:flex-start;justify-content:space-between;border-top:1px solid ${BANNER_BORDER};padding-top:16px;">
    <div>
      <div style="font-size:24px;font-weight:800;color:${BANNER_TEXT};letter-spacing:-0.02em;">${esc(title)}</div>
      <div style="font-family:monospace;font-size:11px;color:${BANNER_MUTED};margin-top:5px;letter-spacing:0.08em;">#${esc(orderId)}</div>
    </div>
    <div style="text-align:end;">${addrLines}</div>
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
    if (el.closest('[data-pdf-gradient="1"]')) continue;
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
    scale: 2,
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
  const imgData = canvas.toDataURL('image/png', 0.92);
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

// ─── Public exports ───────────────────────────────────────────────────────────

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
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
}): Promise<void> {
  const { isRTL, currencyUnit: cu, labels: L } = opts;
  const pdf = newA4Pdf();
  const first = { value: true };
  const logo = await getLogoDataUrl();

  const itemRows = opts.items.map((item) => `
    <tr style="border-bottom:1px solid #e8dcc8;">
      <td style="padding:12px 16px;font-weight:700;color:#1c1208;">${esc(item.name)}</td>
      <td style="padding:12px 16px;text-align:center;color:#8b7355;">×${item.quantity}</td>
      <td style="padding:12px 16px;text-align:end;color:#8b7355;">${item.price.toLocaleString()} ${esc(cu)}</td>
      <td style="padding:12px 16px;text-align:end;font-weight:800;color:#1c1208;">${(item.quantity * item.price).toLocaleString()} ${esc(cu)}</td>
    </tr>`).join('');

  const inner =
    invoiceBanner(
      L.invoiceDocumentTitle || 'INVOICE',
      opts.orderId,
      ['123 Bakery Street', 'City, Country', 'Phone: +123 456 789'],
      logo,
    ) +
    `<div style="background:#fff;padding:28px 32px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:32px;">
        <div>
          <div style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">${esc(L.billTo || 'BILL TO')}</div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;">${esc(opts.clientName || L.walkInCustomer || 'Walk-in Customer')}</div>
          ${opts.customerId ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">${esc(L.customerIdLabel?.replace('{{id}}', opts.customerId) || opts.customerId)}</div>` : ''}
        </div>
        <div style="text-align:end;">
          <div style="display:flex;justify-content:flex-end;gap:16px;margin-bottom:6px;">
            <span style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.date || 'DATE')}</span>
            <span style="font-size:12px;font-weight:700;color:#0f172a;">${esc(opts.date)}</span>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:16px;">
            <span style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.status || 'STATUS')}</span>
            <span style="font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;">${esc(opts.status)}</span>
          </div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;">
            <th style="padding:10px 16px;text-align:start;font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.invoiceItem || 'ITEM')}</th>
            <th style="padding:10px 16px;text-align:center;font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.qtyAbbrev || 'QTY')}</th>
            <th style="padding:10px 16px;text-align:end;font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.price || 'PRICE')}</th>
            <th style="padding:10px 16px;text-align:end;font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.total || 'TOTAL')}</th>
          </tr>
        </thead>
        <tbody>${itemRows || `<tr><td colspan="4" style="padding:16px;color:#94a3b8;">—</td></tr>`}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;">
        <div style="width:260px;">
          <div style="display:flex;justify-content:space-between;padding:8px 0;color:#64748b;font-size:12px;">
            <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.subtotal || 'SUBTOTAL')}</span>
            <span style="font-weight:700;">${opts.totalAmount.toLocaleString()} ${esc(cu)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;color:#64748b;font-size:12px;">
            <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">${esc(L.taxZeroPercent || 'TAX (0%)')}</span>
            <span style="font-weight:700;">0 ${esc(cu)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:16px 0;border-top:2px solid #e2e8f0;margin-top:4px;">
            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#0f172a;">${esc(L.totalAmount || 'TOTAL')}</span>
            <span style="font-size:20px;font-weight:800;color:#1e293b;">${opts.totalAmount.toLocaleString()} ${esc(cu)}</span>
          </div>
        </div>
      </div>
      <div style="margin-top:48px;padding-top:24px;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:11px;font-style:italic;">
        ${esc(L.invoiceThankYou || 'Thank you for your business.')}
      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = wrapRoot(isRTL, inner, '#ffffff');
  await flushChunks(pdf, [el], first);
  pdf.save(opts.filename);
}

// ─── Payslip PDF ──────────────────────────────────────────────────────────────

export async function downloadPayslipPdf(opts: {
  filename: string;
  currencyUnit: string;
  labels: Record<string, string>;
  slip: {
    employeeName: string;
    period: string;
    matricule?: string;
    nin?: string;
    baseSalary: number;
    transportAllowance: number;
    performanceBonus: number;
    otherAllowances: number;
    grossSalary: number;
    cnasEmployee: number;
    taxableGross: number;
    irgRetained: number;
    netSalary: number;
    totalEmployerCost: number;
  };
}): Promise<void> {
  const { currencyUnit: cu, labels: L, slip } = opts;
  const fmt = (n: number) => `${n.toLocaleString('fr-DZ')} ${cu}`;
  const logoUrl = `${window.location.origin}/images/bella-dolce-wordmark.png`;

  const earningRow = (label: string, value: number, muted = false) =>
    `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 16px;font-size:12px;${muted ? 'color:#64748b;' : 'font-weight:600;color:#1e293b;'}">${esc(label)}</td>
      <td style="padding:10px 16px;text-align:end;font-size:12px;font-weight:700;color:#1e293b;">${fmt(value)}</td>
    </tr>`;

  const deductRow = (label: string, value: number) =>
    `<tr style="border-bottom:1px solid #fff1f2;">
      <td style="padding:10px 16px;font-size:12px;color:#64748b;">${esc(label)}</td>
      <td style="padding:10px 16px;text-align:end;font-size:12px;font-weight:700;color:#e11d48;">${fmt(value)}</td>
    </tr>`;

  const infoRow = (label: string, value: string) =>
    value ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px;"><span style="color:#64748b;font-weight:600;">${esc(label)}</span><span style="color:#1e293b;font-weight:700;">${esc(value)}</span></div>` : '';

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;min-height:297mm;padding:0;">

  <!-- Header -->
  <div data-pdf-gradient="1" style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:32px 40px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <img src="${logoUrl}" style="height:44px;object-fit:contain;filter:brightness(0) invert(1);" crossorigin="anonymous" />
      <div style="margin-top:8px;font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.06em;text-transform:uppercase;">Artisanal Atelier de Pâtisserie</div>
    </div>
    <div style="text-align:end;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">${esc(L.payslip)}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:4px;font-weight:600;">${esc(slip.period)}</div>
    </div>
  </div>

  <!-- Employee info band -->
  <div style="background:#fff;border-bottom:2px solid #f1f5f9;padding:20px 40px;display:flex;gap:48px;">
    <div style="flex:1;">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;">${esc(L.employee)}</div>
      <div style="font-size:18px;font-weight:800;color:#0f172a;">${esc(slip.employeeName)}</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
      ${infoRow(L.matriculeLabel, slip.matricule || '')}
      ${infoRow(L.ninLabel, slip.nin || '')}
    </div>
  </div>

  <!-- Body -->
  <div style="padding:24px 40px;display:flex;flex-direction:column;gap:20px;">

    <!-- Earnings -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#3b82f6;">${esc(L.sectionFinancial)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${earningRow(L.baseSalary, slip.baseSalary)}
          ${earningRow(L.transportAllowanceLabel, slip.transportAllowance, true)}
          ${earningRow(L.payrollBonusLabel, slip.performanceBonus, true)}
          ${earningRow(L.otherAllowancesLabel, slip.otherAllowances, true)}
          <tr style="background:#eff6ff;">
            <td style="padding:12px 16px;font-size:13px;font-weight:800;color:#1e40af;">${esc(L.grossSalary)}</td>
            <td style="padding:12px 16px;text-align:end;font-size:13px;font-weight:800;color:#1e40af;">${fmt(slip.grossSalary)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Deductions -->
    <div style="background:#fff;border:1px solid #fecdd3;border-radius:16px;overflow:hidden;">
      <div style="padding:12px 16px;background:#fff1f2;border-bottom:1px solid #fecdd3;">
        <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#e11d48;">${esc(L.deductions)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${deductRow(L.cnasEmployee, slip.cnasEmployee)}
          ${deductRow(L.taxableGross + ' →', slip.taxableGross)}
          ${deductRow(L.irgRetained, slip.irgRetained)}
        </tbody>
      </table>
    </div>

    <!-- Net salary -->
    <div style="background:linear-gradient(135deg,#059669,#047857);border-radius:16px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.7);">${esc(L.netSalary)}</div>
        <div style="font-size:30px;font-weight:800;color:#fff;margin-top:4px;letter-spacing:-0.02em;">${fmt(slip.netSalary)}</div>
      </div>
      <div style="text-align:end;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.7);">${esc(L.employerCost)}</div>
        <div style="font-size:16px;font-weight:800;color:rgba(255,255,255,0.9);margin-top:4px;">${fmt(slip.totalEmployerCost)}</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:8px 0;font-size:10px;color:#94a3b8;">
      Bella Dolce · ${esc(slip.period)} · ${new Date().toLocaleDateString('fr-DZ')}
    </div>
  </div>
</div>`;

  const pdf = newA4Pdf();
  const el = document.createElement('div');
  el.style.width = '794px';
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
