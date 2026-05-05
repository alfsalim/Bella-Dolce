import * as XLSX from 'xlsx';
import type { FixedAssetDbRow } from '../types';

export const FIXED_ASSET_EXCEL_HEADERS = [
  'id',
  'code',
  'name',
  'category',
  'location',
  'acquisitionDate',
  'acquisitionCost',
  'usefulLifeYears',
  'salvageValue',
  'depreciationMethod',
  'status',
  'notes',
  'lastMaintenanceAt',
  'nextMaintenanceAt',
  'maintenanceNotes',
] as const;

function normalizeHeader(h: string): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function excelSerialToIso(n: number): string {
  const utc = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function cellToDateString(cell: unknown): string {
  if (cell == null || cell === '') return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  if (typeof cell === 'number') return excelSerialToIso(cell);
  const s = String(cell).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

export function assetToExcelRow(a: FixedAssetDbRow): (string | number)[] {
  return [
    a.id ?? '',
    a.code ?? '',
    a.name ?? '',
    a.category ?? 'other',
    a.location ?? '',
    typeof a.acquisitionDate === 'string' ? a.acquisitionDate.slice(0, 10) : '',
    a.acquisitionCost ?? 0,
    a.usefulLifeYears ?? 5,
    a.salvageValue ?? 0,
    a.depreciationMethod ?? 'LINEAR',
    a.status ?? 'IN_SERVICE',
    a.notes ?? '',
    a.lastMaintenanceAt ? String(a.lastMaintenanceAt).slice(0, 10) : '',
    a.nextMaintenanceAt ? String(a.nextMaintenanceAt).slice(0, 10) : '',
    a.maintenanceNotes ?? '',
  ];
}

export function exportFixedAssetsWorkbook(assets: FixedAssetDbRow[]): XLSX.WorkBook {
  const headers = [...FIXED_ASSET_EXCEL_HEADERS];
  const rows: (string | number)[][] = [headers];
  for (const a of assets) {
    rows.push(assetToExcelRow(a));
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Assets');
  return wb;
}

export function downloadFixedAssetsXlsx(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

export type ParsedAssetImportRow = {
  rowIndex: number;
  id?: string;
  code?: string;
  name?: string;
  category?: string;
  location?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  usefulLifeYears?: number;
  salvageValue?: number;
  depreciationMethod?: string;
  status?: string;
  notes?: string;
  lastMaintenanceAt?: string;
  nextMaintenanceAt?: string;
  maintenanceNotes?: string;
};

function mapAliasedKey(k: string): string {
  const m: Record<string, string> = {
    assetid: 'id',
    assetcode: 'code',
  };
  return m[k] ?? k;
}

export function parseFixedAssetsImportWorkbook(buffer: ArrayBuffer): ParsedAssetImportRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  if (!aoa.length) return [];

  const headerRow = (aoa[0] as unknown[]).map((c) => mapAliasedKey(normalizeHeader(String(c ?? ''))));
  const canonical = FIXED_ASSET_EXCEL_HEADERS.map((h) => h.toLowerCase());
  const idx: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    if (h && canonical.includes(h)) idx[h] = i;
  });
  if (idx['name'] == null && idx['code'] == null) {
    return [];
  }

  const out: ParsedAssetImportRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const line = aoa[r] as unknown[];
    if (!line || !line.length) continue;
    const get = (key: (typeof FIXED_ASSET_EXCEL_HEADERS)[number]): string => {
      const i = idx[key.toLowerCase()];
      if (i == null) return '';
      const v = line[i];
      if (v == null || v === '') return '';
      if (key === 'acquisitionDate' || key === 'lastMaintenanceAt' || key === 'nextMaintenanceAt') {
        return cellToDateString(v);
      }
      return String(v).trim();
    };
    const name = get('name');
    const code = get('code');
    if (!name && !code) continue;

    const costRaw = get('acquisitionCost');
    const salvageRaw = get('salvageValue');
    const yearsRaw = get('usefulLifeYears');
    const acquisitionCost = costRaw === '' ? undefined : Number(costRaw.replace(',', '.'));
    const salvageValue = salvageRaw === '' ? undefined : Number(salvageRaw.replace(',', '.'));
    const usefulLifeYears = yearsRaw === '' ? undefined : parseInt(yearsRaw, 10);

    out.push({
      rowIndex: r + 1,
      id: get('id') || undefined,
      code: code || undefined,
      name: name || undefined,
      category: get('category') || undefined,
      location: get('location') || undefined,
      acquisitionDate: get('acquisitionDate') || undefined,
      acquisitionCost: Number.isFinite(acquisitionCost) ? acquisitionCost : undefined,
      usefulLifeYears: Number.isFinite(usefulLifeYears) ? usefulLifeYears : undefined,
      salvageValue: Number.isFinite(salvageValue) ? salvageValue : undefined,
      depreciationMethod: get('depreciationMethod') || undefined,
      status: get('status') || undefined,
      notes: get('notes') || undefined,
      lastMaintenanceAt: get('lastMaintenanceAt') || undefined,
      nextMaintenanceAt: get('nextMaintenanceAt') || undefined,
      maintenanceNotes: get('maintenanceNotes') || undefined,
    });
  }
  return out;
}
