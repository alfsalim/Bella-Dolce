import { QUERY_MAX_ITEMS } from '../constants';

export type PurchaseSortCol = 'date' | 'supplier' | 'total';

type BuildPurchasesUrlOpts = {
  sortCol: PurchaseSortCol;
  sortDir: 'asc' | 'desc';
  take?: number;
} & (
  | { scope: 'all' }
  | {
      scope: 'window';
      dateFromYmd: string;
      dateToYmd: string;
    }
);

/** Build GET /api/db/purchases query (SupplierInvoice: sort by date, supplierName, totalAmount). */
export function buildPurchasesListUrl(opts: BuildPurchasesUrlOpts): string {
  const take = opts.take ?? QUERY_MAX_ITEMS;
  const orderField =
    opts.sortCol === 'date'
      ? 'date'
      : opts.sortCol === 'supplier'
        ? 'supplierName'
        : 'totalAmount';
  const orderBy = { [orderField]: opts.sortDir };
  const q = new URLSearchParams();
  if (opts.scope === 'window') {
    q.set(
      'where',
      JSON.stringify({
        date: {
          gte: opts.dateFromYmd,
          lte: `${opts.dateToYmd}T23:59:59.999Z`,
        },
      })
    );
  }
  q.set('orderBy', JSON.stringify(orderBy));
  q.set('take', String(take));
  return `/api/db/purchases?${q.toString()}`;
}
