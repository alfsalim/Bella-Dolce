/**
 * Excel counterpart to `downloadReportsPdf` (src/lib/export.ts). Same `mode` union and
 * payload shapes so Reports.tsx can build one payload and hand it to either exporter.
 * Uses exceljs (not the `xlsx` package used elsewhere) because `xlsx`'s community build
 * silently drops cell styles on write — colored/bold headers require exceljs.
 * Charts are rendered to an offscreen <canvas> and embedded as PNG pictures (exceljs has
 * no native/editable chart object support) — see renderBarChartPng/addChartBelow below.
 */
import ExcelJS from 'exceljs';
import type { ActivityLog, Sale, SaleItem } from '../types';
import type { AnalyticsPdfPayload, SupplierExpensesPdfPayload } from './export';
import { generateTransactionId } from './transactionId';

function parseSaleItems(sale: Sale): (SaleItem & { name?: string })[] {
  try {
    return Array.isArray(sale.items) ? sale.items : JSON.parse((sale.items as unknown as string) || '[]');
  } catch {
    return [];
  }
}

// ─── Brand palette (matches the app's amber/bakery theme) ─────────────────────
const HEADER_FILL = 'FFB45309'; // amber-700
const HEADER_FONT = 'FFFFFFFF';
const TITLE_FILL = 'FFFEF3C7'; // amber-100
const TITLE_FONT = 'FF78350F'; // amber-900
const SUBTITLE_FONT = 'FF64748B'; // slate-500
const ZEBRA_FILL = 'FFF8FAFC'; // slate-50
const BORDER_COLOR = 'FFE2E8F0'; // slate-200
const LABEL_FONT = 'FF334155'; // slate-700
const VALUE_FONT = 'FF0F172A'; // slate-900

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
};

function addTitleBand(ws: ExcelJS.Worksheet, text: string, span: number): void {
  const row = ws.addRow([text]);
  if (span > 1) ws.mergeCells(row.number, 1, row.number, span);
  row.height = 26;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 13, color: { argb: TITLE_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
    cell.alignment = { vertical: 'middle' };
  });
}

function addSubtitleRow(ws: ExcelJS.Worksheet, text: string): void {
  const row = ws.addRow([text]);
  row.getCell(1).font = { italic: true, color: { argb: SUBTITLE_FONT } };
}

function addSpacer(ws: ExcelJS.Worksheet): void {
  ws.addRow([]);
}

function addKpiRow(ws: ExcelJS.Worksheet, label: string, value: number, numFmt?: string): void {
  const row = ws.addRow([label, value]);
  row.getCell(1).font = { bold: true, color: { argb: LABEL_FONT } };
  const valueCell = row.getCell(2);
  valueCell.font = { bold: true, color: { argb: VALUE_FONT } };
  valueCell.alignment = { horizontal: 'right' };
  if (numFmt) valueCell.numFmt = numFmt;
}

/** Column header row for a data table: colored fill, bold white text, frozen in place. */
function addTableHeader(ws: ExcelJS.Worksheet, headers: string[], freeze = true): ExcelJS.Row {
  const row = ws.addRow(headers);
  row.height = 20;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle' };
  });
  if (freeze) ws.views = [{ state: 'frozen', ySplit: row.number }];
  return row;
}

/** Data row with thin borders and alternating (zebra) shading for readability. */
function addTableRow(ws: ExcelJS.Worksheet, values: (string | number)[], zebra: boolean, currencyCols: number[] = [], cu = ''): void {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = THIN_BORDER;
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
    if (currencyCols.includes(colNumber) && typeof cell.value === 'number') {
      cell.numFmt = `#,##0 "${cu}"`;
      cell.alignment = { horizontal: 'right' };
    }
  });
}

function setColumnWidths(ws: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

/**
 * Draws a simple bar chart on an offscreen <canvas> and returns it as a base64 PNG.
 * exceljs has no native (editable) chart object support, so charts are embedded as
 * pictures — the same approach export.ts uses for the PDF's supplier_expenses chart.
 */
function renderBarChartPng(
  data: { label: string; value: number }[],
  opts: { width?: number; height?: number; orientation?: 'vertical' | 'horizontal'; unit?: string } = {}
): string {
  const width = opts.width ?? 720;
  const height = opts.height ?? 320;
  const orientation = opts.orientation ?? 'vertical';
  const color = '#d97706';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const rows = data.length ? data : [{ label: '—', value: 0 }];
  const maxVal = Math.max(1, ...rows.map((d) => d.value));
  const padding =
    orientation === 'vertical'
      ? { top: 16, right: 16, bottom: 56, left: 56 }
      : { top: 12, right: 70, bottom: 12, left: 150 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  ctx.strokeStyle = '#e2e8f0';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px Arial, sans-serif';
  ctx.lineWidth = 1;
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const v = (maxVal / gridCount) * i;
    if (orientation === 'vertical') {
      const y = padding.top + plotH - (v / maxVal) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(v).toLocaleString(), padding.left - 6, y + 4);
    }
  }

  const n = rows.length;
  if (orientation === 'vertical') {
    const slot = plotW / n;
    const barWidth = Math.min(48, slot * 0.6);
    rows.forEach((d, i) => {
      const barH = (d.value / maxVal) * plotH;
      const x = padding.left + i * slot + (slot - barWidth) / 2;
      const y = padding.top + plotH - barH;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, Math.max(1, barH));
      ctx.save();
      ctx.translate(x + barWidth / 2, height - padding.bottom + 14);
      const rotate = n > 8;
      ctx.rotate(rotate ? -Math.PI / 4 : 0);
      ctx.fillStyle = '#475569';
      ctx.font = '10px Arial, sans-serif';
      ctx.textAlign = rotate ? 'right' : 'center';
      const label = d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });
  } else {
    const slot = plotH / n;
    const barHeight = Math.min(26, slot * 0.6);
    rows.forEach((d, i) => {
      const barW = (d.value / maxVal) * plotW;
      const y = padding.top + i * slot + (slot - barHeight) / 2;
      ctx.fillStyle = color;
      ctx.fillRect(padding.left, y, Math.max(1, barW), barHeight);
      ctx.fillStyle = '#334155';
      ctx.font = '11px Arial, sans-serif';
      ctx.textAlign = 'right';
      const label = d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label;
      ctx.fillText(label, padding.left - 8, y + barHeight / 2 + 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px Arial, sans-serif';
      const valueLabel = `${d.value.toLocaleString()}${opts.unit ? ` ${opts.unit}` : ''}`;
      ctx.fillText(valueLabel, padding.left + barW + 6, y + barHeight / 2 + 4);
    });
  }

  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  if (orientation === 'vertical') ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  return canvas.toDataURL('image/png').split(',')[1];
}

/** Appends a bar-chart image below whatever was last added to the sheet. */
function addChartBelow(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  data: { label: string; value: number }[],
  opts: { orientation?: 'vertical' | 'horizontal'; unit?: string; title?: string } = {}
): void {
  if (opts.title) {
    addSpacer(ws);
    addTitleBand(ws, opts.title, 2);
  } else {
    addSpacer(ws);
  }
  const width = 720;
  const height = 320;
  const anchorRow = ws.rowCount;
  const base64 = renderBarChartPng(data, { width, height, orientation: opts.orientation, unit: opts.unit });
  const imageId = wb.addImage({ base64, extension: 'png' });
  ws.addImage(imageId, { tl: { col: 0, row: anchorRow }, ext: { width, height } });
  const rowHeightPx = 20;
  for (let i = 0; i < Math.ceil(height / rowHeightPx); i++) ws.addRow([]);
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadReportsXlsx(opts: {
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
  const { currencyUnit: cu, labels: L } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bella Dolce';
  wb.created = new Date();

  const sheetName = (name: string, fallback: string) => (name || fallback).replace(/[[\]*/\\?:]/g, ' ').slice(0, 31);

  if (opts.mode === 'analytics' && opts.analytics) {
    const a = opts.analytics;

    const summary = wb.addWorksheet(sheetName(L.analytics, 'Summary'));
    setColumnWidths(summary, [28, 20]);
    addTitleBand(summary, L.analytics, 2);
    addSubtitleRow(summary, a.periodLine);
    addSubtitleRow(summary, a.presetLine);
    addSpacer(summary);
    addKpiRow(summary, L.totalRevenue, a.kpi.totalRevenue, `#,##0 "${cu}"`);
    addKpiRow(summary, L.costs, a.kpi.totalCosts, `#,##0 "${cu}"`);
    addKpiRow(summary, L.grossProfit, a.kpi.grossProfit, `#,##0 "${cu}"`);
    addKpiRow(summary, L.operatingExpenses, a.kpi.operatingExpenses, `#,##0 "${cu}"`);
    addKpiRow(summary, L.netProfit, a.kpi.netProfit, `#,##0 "${cu}"`);
    addKpiRow(summary, L.avgOrderValue, a.kpi.avgOrderValue, `#,##0 "${cu}"`);
    addSpacer(summary);
    addTitleBand(summary, L.orderReport, 2);
    addKpiRow(summary, L.totalOrders, a.orders.totalOrdersCount);
    addKpiRow(summary, L.fulfilled, a.orders.fulfilledOrdersCount);
    addKpiRow(summary, L.fulfillmentRate, a.orders.fulfillmentRate, '0.0"%"');
    addKpiRow(summary, L.cancelled, a.orders.cancelledOrdersCount);
    addKpiRow(summary, L.unfulfilledOrders, a.orders.unfulfilledOrdersCount);
    addKpiRow(summary, L.delayedOrders, a.orders.delayedOrdersCount);
    addSpacer(summary);
    addTitleBand(summary, L.orderStatusDistribution, 2);
    addTableHeader(summary, [L.orderStatusDistribution, L.records], false);
    a.orderStatusRows.forEach((r, i) => addTableRow(summary, [r.label, r.value], i % 2 === 1));

    const daily = wb.addWorksheet(sheetName(L.salesTrends, 'Daily Breakdown'));
    setColumnWidths(daily, [16, 18, 12]);
    addTableHeader(daily, [L.reportPdfDailyBreakdown, L.revenue, L.orders]);
    a.chartRows.forEach((r, i) => addTableRow(daily, [r.dayLabel, r.revenue, r.orders], i % 2 === 1, [2], cu));
    addChartBelow(
      wb,
      daily,
      a.chartRows.map((r) => ({ label: r.dayLabel, value: r.revenue })),
      { orientation: 'vertical', unit: cu, title: L.salesTrends }
    );

    const details = wb.addWorksheet(sheetName(L.inventoryConsumption, 'Details'));
    setColumnWidths(details, [26, 22, 16, 12]);
    addTitleBand(details, L.salesByCategory, 2);
    addTableHeader(details, [L.salesByCategory, L.units], false);
    a.categories.forEach((c, i) => addTableRow(details, [c.label, `${c.count} ${L.units}`], i % 2 === 1));
    addSpacer(details);
    addTitleBand(details, L.topSellers, 4);
    addTableHeader(details, ['#', L.products, L.material, L.units], false);
    a.topSellers.forEach((p, i) => addTableRow(details, [p.rank, p.name, p.category, `${p.units} ${L.units}`], i % 2 === 1));
    addChartBelow(
      wb,
      details,
      a.topSellers.map((p) => ({ label: p.name, value: p.units })),
      { orientation: 'horizontal', unit: L.units, title: L.topSellers }
    );
    addSpacer(details);
    addTitleBand(details, L.inventoryConsumption, 3);
    addTableHeader(details, [L.material, L.inventoryConsumption, L.stock], false);
    a.inventoryRows.forEach((m, i) => addTableRow(details, [m.name, `${m.consumption} ${L.units}`, m.stock], i % 2 === 1));

  } else if (opts.mode === 'sales_transactions' && opts.salesTransactions) {
    const { sales, filterNote, getLineItemLabel, getPaymentLabel, formatSaleDate, formatSaleTime } = opts.salesTransactions;
    const ws = wb.addWorksheet(sheetName(L.reportPdfSubTabTransactions, 'Transactions'));
    setColumnWidths(ws, [16, 22, 18, 12, 46, 14]);
    addTitleBand(ws, `${L.salesReport} — ${L.reportPdfSubTabTransactions}`, 6);
    addSubtitleRow(ws, filterNote);
    addSpacer(ws);
    addTableHeader(ws, [L.transactionId || 'Transaction ID', L.timestamp, L.cashier, L.payment, L.products, L.amount]);
    sales.forEach((sale, i) => {
      const items = parseSaleItems(sale);
      const products = items.map((it) => `${it.quantity}x ${getLineItemLabel(it)}`).join(', ');
      addTableRow(
        ws,
        [
          generateTransactionId(sale.createdAt),
          `${formatSaleDate(sale.createdAt)} ${formatSaleTime(sale.createdAt)}`,
          sale.cashierName || '—',
          getPaymentLabel(sale.paymentMethod),
          products,
          sale.totalAmount,
        ],
        i % 2 === 1,
        [6],
        cu
      );
    });

  } else if (opts.mode === 'sales_by_product' && opts.salesByProduct) {
    const { rows, filterNote } = opts.salesByProduct;
    const ws = wb.addWorksheet(sheetName(L.reportPdfSubTabByProduct, 'By Product'));
    setColumnWidths(ws, [32, 12, 18, 16]);
    addTitleBand(ws, `${L.salesReport} — ${L.reportPdfSubTabByProduct}`, 4);
    addSubtitleRow(ws, filterNote);
    addSpacer(ws);
    addTableHeader(ws, [L.products, L.quantity, L.revenue, L.salesContainingProduct]);
    rows.forEach((r, i) => addTableRow(ws, [r.name, r.quantity, r.revenue, r.saleCount], i % 2 === 1, [3], cu));
    addChartBelow(
      wb,
      ws,
      [...rows].sort((x, y) => y.revenue - x.revenue).slice(0, 10).map((r) => ({ label: r.name, value: r.revenue })),
      { orientation: 'horizontal', unit: cu, title: L.revenue }
    );

  } else if (opts.mode === 'activities' && opts.activities) {
    const { logs, filterNote, formatLogTime } = opts.activities;
    const ws = wb.addWorksheet(sheetName(L.activities, 'Activities'));
    setColumnWidths(ws, [20, 20, 20, 50]);
    addTitleBand(ws, L.activities, 4);
    addSubtitleRow(ws, filterNote);
    addSpacer(ws);
    addTableHeader(ws, [L.cashier, L.timestamp, L.records, '']);
    logs.forEach((log, i) =>
      addTableRow(ws, [log.userName || '—', log.timestamp ? formatLogTime(log.timestamp) : '—', log.action, log.details || ''], i % 2 === 1)
    );

  } else if (opts.mode === 'supplier_expenses' && opts.supplierExpenses) {
    const se = opts.supplierExpenses;
    const totalCount =
      se.groupBy === 'list' ? se.listRows.length : se.groupBy === 'supplier' ? se.supplierRows.reduce((s, r) => s + r.count, 0) : se.bucketRows.reduce((s, r) => s + r.count, 0);

    const summary = wb.addWorksheet(sheetName(L.supplierExpenses, 'Summary'));
    setColumnWidths(summary, [28, 20]);
    addTitleBand(summary, L.supplierExpenses, 2);
    addSubtitleRow(summary, se.filterNote);
    addSpacer(summary);
    addKpiRow(summary, L.supplierExpenses, se.total, `#,##0 "${cu}"`);
    addKpiRow(summary, L.invoiceCount, totalCount);

    if (se.groupBy === 'list') {
      const ws = wb.addWorksheet(sheetName(L.supplierExpenses, 'Expenses').slice(0, 24) + ' (List)');
      setColumnWidths(ws, [16, 26, 18, 16]);
      addTableHeader(ws, [L.fromDate, L.supplier, L.invoiceNumber, L.amount]);
      se.listRows.forEach((r, i) => addTableRow(ws, [r.date, r.supplierName, r.invoiceNumber, r.amount], i % 2 === 1, [4], cu));
      addChartBelow(
        wb,
        ws,
        se.bucketRows.map((r) => ({ label: r.periodLabel, value: r.total })),
        { orientation: 'vertical', unit: cu, title: L.supplierExpenses }
      );
    } else if (se.groupBy === 'supplier') {
      const ws = wb.addWorksheet(sheetName(L.supplierExpenses, 'Expenses').slice(0, 20) + ' (Supplier)');
      setColumnWidths(ws, [28, 16, 18]);
      addTableHeader(ws, [L.supplier, L.invoiceCount, L.amount]);
      se.supplierRows.forEach((r, i) => addTableRow(ws, [r.supplierName, r.count, r.total], i % 2 === 1, [3], cu));
      addChartBelow(
        wb,
        ws,
        se.supplierRows.slice(0, 10).map((r) => ({ label: r.supplierName, value: r.total })),
        { orientation: 'horizontal', unit: cu, title: L.supplierExpenses }
      );
    } else {
      const ws = wb.addWorksheet(sheetName(L.supplierExpenses, 'Expenses').slice(0, 22) + ' (Period)');
      setColumnWidths(ws, [16, 16, 18]);
      addTableHeader(ws, [L.period, L.invoiceCount, L.amount]);
      se.bucketRows.forEach((r, i) => addTableRow(ws, [r.periodLabel, r.count, r.total], i % 2 === 1, [3], cu));
      addChartBelow(
        wb,
        ws,
        se.bucketRows.map((r) => ({ label: r.periodLabel, value: r.total })),
        { orientation: 'vertical', unit: cu, title: L.supplierExpenses }
      );
    }
  }

  await downloadWorkbook(wb, opts.filename);
}
