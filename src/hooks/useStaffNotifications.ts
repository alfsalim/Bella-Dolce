import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, RawMaterial, Sale } from '../types';
import type { ProductDisplayInput } from '../contexts/LanguageContext';
import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  handleFirestoreError,
  OperationType,
} from '../lib/db';
import { readStaffSystemErrors, clearStaffSystemErrors, type SystemErrorEvent } from '../lib/systemErrorNotifications';
import { QUERY_MAX_ITEMS } from '../constants';

const STAFF_ROLES = ['admin', 'manager', 'cashier', 'baker', 'inventory'] as const;

export type PendingOrderNotif = {
  id: string;
  createdAt?: unknown;
  clientName?: string;
  customerName?: string;
  customerInfo?: { name?: string };
  totalAmount?: number;
};

type PurchaseRow = {
  id: string;
  totalAmount?: number;
  price?: number;
  quantity?: number;
  createdAt?: unknown;
  supplierName?: string;
  materialName?: string;
};

export type StaffNotificationRow = {
  id: string;
  digestPart: string;
  path: string;
  tone: 'danger' | 'warning' | 'info';
  title: string;
  subtitle?: string;
};

function createdAtToMs(createdAt: unknown): number {
  if (createdAt == null) return 0;
  if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof createdAt === 'object' && createdAt !== null) {
    const o = createdAt as { seconds?: number; toDate?: () => Date };
    if (typeof o.seconds === 'number') return o.seconds * 1000;
    if (typeof o.toDate === 'function') return o.toDate().getTime();
  }
  return 0;
}

function orderCustomerLabel(o: PendingOrderNotif, walkIn: string): string {
  return o.clientName || o.customerName || o.customerInfo?.name || walkIn;
}

function purchaseLineAmount(p: PurchaseRow): number {
  const t = Number(p.totalAmount);
  if (Number.isFinite(t) && t > 0) return t;
  const pr = Number(p.price);
  const q = Number(p.quantity);
  if (Number.isFinite(pr) && Number.isFinite(q) && pr * q > 0) return Math.round(pr * q * 100) / 100;
  return 0;
}

/** Recent invoices whose total is much higher than the historical median (same list). */
function unusualPurchaseRows(rows: PurchaseRow[]): PurchaseRow[] {
  const enriched = rows
    .map((r) => ({
      row: r,
      ms: createdAtToMs(r.createdAt),
      amount: purchaseLineAmount(r),
    }))
    .filter((x) => x.amount > 0 && x.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  if (enriched.length < 10) return [];

  const baselineSource = enriched.slice(5);
  const amounts = baselineSource.map((x) => x.amount).sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median = amounts.length ? (amounts[mid] ?? amounts[mid - 1] ?? 0) : 0;
  if (median <= 0) return [];

  const recent = enriched.slice(0, 8);
  return recent
    .filter((x) => x.amount >= median * 2.5 && x.amount >= median + Math.max(5000, median * 0.5))
    .map((x) => x.row);
}

function yesterdaySaleStats(sales: Sale[]): { yCount: number; priorAvg: number; yKey: string } | null {
  const now = new Date();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  y.setHours(0, 0, 0, 0);
  const yEnd = new Date(y);
  yEnd.setHours(23, 59, 59, 999);
  const yKey = y.toISOString().slice(0, 10);

  const yCount = sales.filter((s) => {
    const d = new Date(s.createdAt);
    return d >= y && d <= yEnd;
  }).length;

  const counts: number[] = [];
  for (let i = 2; i <= 15; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    const c = sales.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= day && d <= end;
    }).length;
    counts.push(c);
  }
  const priorAvg = counts.reduce((a, b) => a + b, 0) / counts.length;
  return { yCount, priorAvg, yKey };
}

function digestFromRows(rows: StaffNotificationRow[]): string {
  return rows
    .map((r) => r.digestPart)
    .sort()
    .join('\x1e');
}

const DIGEST_KEY_PREFIX = 'bd_staff_notif_digest_';

export function useStaffNotifications(options: {
  userId: string | undefined;
  profile: { role: string; id: string } | null;
  canAccess: (path: string) => boolean;
  t: (key: string) => string;
  tProduct: (input: ProductDisplayInput) => string;
  currencyUnit: string;
  /** When false (Settings → system alerts off), no data is loaded and the bell is hidden by the parent. */
  enabled: boolean;
}) {
  const { userId, profile, canAccess, t, tProduct, currencyUnit, enabled } = options;

  const isStaff =
    !!profile && (STAFF_ROLES as readonly string[]).includes(profile.role);

  const canNotify =
    !!userId &&
    isStaff &&
    (canAccess('*') ||
      canAccess('/orders') ||
      canAccess('/inventory') ||
      canAccess('/dashboard') ||
      canAccess('/product-management') ||
      canAccess('/production') ||
      canAccess('/pos') ||
      canAccess('/reports') ||
      canAccess('/procurement') ||
      canAccess('/finance'));

  const canOrders = canAccess('*') || canAccess('/orders');
  const canProducts =
    canAccess('*') || canAccess('/dashboard') || canAccess('/inventory') || canAccess('/product-management');
  const canMaterials = canAccess('*') || canAccess('/inventory') || canAccess('/production');
  const canPurchases = canAccess('*') || canAccess('/procurement') || canAccess('/finance');
  const canSales = canAccess('*') || canAccess('/pos') || canAccess('/dashboard') || canAccess('/reports');

  const [pendingOrders, setPendingOrders] = useState<PendingOrderNotif[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [systemErrors, setSystemErrors] = useState<SystemErrorEvent[]>([]);
  const [seenDigest, setSeenDigest] = useState('');

  useEffect(() => {
    if (!userId) {
      setSeenDigest('');
      return;
    }
    setSeenDigest(() => localStorage.getItem(`${DIGEST_KEY_PREFIX}${userId}`) || '');
  }, [userId]);

  const refreshErrors = useCallback(() => {
    readStaffSystemErrors().then(setSystemErrors).catch(() => {});
  }, []);

  const clearEvents = useCallback(async () => {
    await clearStaffSystemErrors();
    setSystemErrors([]);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSystemErrors([]);
      return;
    }
    refreshErrors();
    window.addEventListener('bd-system-notification', refreshErrors);
    return () => window.removeEventListener('bd-system-notification', refreshErrors);
  }, [enabled, refreshErrors]);

  useEffect(() => {
    if (!enabled || !canNotify || !canOrders) {
      setPendingOrders([]);
      return;
    }
    if (!(STAFF_ROLES as readonly string[]).includes(profile?.role || '')) {
      setPendingOrders([]);
      return;
    }
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setPendingOrders(
          snapshot.docs.map(
            (docSnap: { id: string; data: () => Record<string, unknown> }) =>
              ({ id: docSnap.id, ...docSnap.data() }) as PendingOrderNotif
          )
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'orders')
    );
  }, [enabled, canNotify, canOrders, profile?.role]);

  useEffect(() => {
    if (!enabled || !canNotify || !canProducts) {
      setProducts([]);
      return;
    }
    const q = query(collection(db, 'products'), orderBy('name'), limit(QUERY_MAX_ITEMS));
    return onSnapshot(
      q,
      (snapshot) => {
        setProducts(snapshot.docs.map((d: { id: string; data: () => Product }) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'products')
    );
  }, [enabled, canNotify, canProducts]);

  useEffect(() => {
    if (!enabled || !canNotify || !canMaterials) {
      setMaterials([]);
      return;
    }
    if (!['admin', 'manager', 'baker', 'inventory'].includes(profile?.role || '')) {
      setMaterials([]);
      return;
    }
    const q = query(collection(db, 'rawMaterials'), orderBy('name'), limit(QUERY_MAX_ITEMS));
    return onSnapshot(
      q,
      (snapshot) => {
        setMaterials(snapshot.docs.map((d: { id: string; data: () => RawMaterial }) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'rawMaterials')
    );
  }, [enabled, canNotify, canMaterials, profile?.role]);

  useEffect(() => {
    if (!enabled || !canNotify || !canPurchases) {
      setPurchases([]);
      return;
    }
    const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'), limit(120));
    return onSnapshot(
      q,
      (snapshot) => {
        setPurchases(
          snapshot.docs.map((d: { id: string; data: () => PurchaseRow }) => ({ id: d.id, ...d.data() }))
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'purchases')
    );
  }, [enabled, canNotify, canPurchases]);

  useEffect(() => {
    if (!enabled || !canNotify || !canSales) {
      setSales([]);
      return;
    }
    if (!['admin', 'manager', 'cashier'].includes(profile?.role || '')) {
      setSales([]);
      return;
    }
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(
      q,
      (snapshot) => {
        setSales(snapshot.docs.map((d: { id: string; data: () => Sale }) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'sales')
    );
  }, [enabled, canNotify, canSales, profile?.role]);

  const rows = useMemo((): StaffNotificationRow[] => {
    if (!enabled) return [];
    const out: StaffNotificationRow[] = [];

    for (const e of systemErrors.slice(0, 15)) {
      const col = e.collection ? ` · ${e.collection}` : '';
      out.push({
        id: `err-${e.id}`,
        digestPart: `err:${e.id}`,
        path: '/dashboard',
        tone: 'danger',
        title: t('notifSystemErrorTitle'),
        subtitle: `${e.message}${col}`,
      });
    }

    if (canOrders) {
      for (const o of pendingOrders) {
        out.push({
          id: `ord-${o.id}`,
          digestPart: `ord:${o.id}`,
          path: '/orders',
          tone: 'info',
          title: t('systemAlertNewOrderTitle'),
          subtitle: `${orderCustomerLabel(o, t('walkInCustomer'))} · ${(o.totalAmount ?? 0).toLocaleString()} ${currencyUnit}`,
        });
      }
    }

    if (canProducts) {
      const lowP = products.filter((p) => !p.disabled && p.stock < p.minStock);
      for (const p of lowP.slice(0, 12)) {
        out.push({
          id: `lp-${p.id}`,
          digestPart: `lp:${p.id}`,
          path: '/inventory',
          tone: 'warning',
          title: t('notifLowStockProductTitle'),
          subtitle: `${tProduct(p)} · ${p.stock}/${p.minStock} ${t('units')}`,
        });
      }
    }

    if (canMaterials && materials.length) {
      const lowM = materials.filter((m) => !m.disabled && m.currentStock < m.minStock);
      for (const m of lowM.slice(0, 12)) {
        out.push({
          id: `lm-${m.id}`,
          digestPart: `lm:${m.id}`,
          path: '/inventory',
          tone: 'warning',
          title: t('notifLowStockMaterialTitle'),
          subtitle: `${tProduct(m)} · ${m.currentStock}/${m.minStock} ${m.unit || t('units')}`,
        });
      }
    }

    if (canPurchases && purchases.length && ['admin', 'manager'].includes(profile?.role || '')) {
      for (const p of unusualPurchaseRows(purchases)) {
        const amt = purchaseLineAmount(p);
        out.push({
          id: `pur-${p.id}`,
          digestPart: `pur:${p.id}`,
          path: '/procurement',
          tone: 'warning',
          title: t('notifUnusualPurchaseTitle'),
          subtitle: `${p.materialName || '—'} · ${amt.toLocaleString()} ${currencyUnit}`,
        });
      }
    }

    if (canSales && ['admin', 'manager'].includes(profile?.role || '') && sales.length) {
      const stats = yesterdaySaleStats(sales);
      if (stats && stats.priorAvg >= 4 && stats.yCount < Math.max(2, stats.priorAvg * 0.45)) {
        out.push({
          id: `saleslow-${stats.yKey}`,
          digestPart: `saleslow:${stats.yKey}`,
          path: '/dashboard',
          tone: 'warning',
          title: t('notifLowSalesYesterdayTitle'),
          subtitle: t('notifLowSalesYesterdayBody')
            .replace('{{count}}', String(stats.yCount))
            .replace('{{avg}}', stats.priorAvg.toFixed(1)),
        });
      }
    }

    out.sort((a, b) => {
      const rank = (tone: StaffNotificationRow['tone']) =>
        tone === 'danger' ? 0 : tone === 'warning' ? 1 : 2;
      const d = rank(a.tone) - rank(b.tone);
      if (d !== 0) return d;
      return a.title.localeCompare(b.title);
    });

    return out;
  }, [
    systemErrors,
    pendingOrders,
    products,
    materials,
    purchases,
    sales,
    canOrders,
    canProducts,
    canMaterials,
    canPurchases,
    canSales,
    profile?.role,
    t,
    tProduct,
    currencyUnit,
    enabled,
  ]);

  const digest = useMemo(() => digestFromRows(rows), [rows]);
  /** Red dot only when there is at least one active notification the user has not acknowledged (digest match). */
  const hasUnread = enabled && digest.length > 0 && digest !== seenDigest;

  const markNotificationsSeen = useCallback(() => {
    if (!enabled || !userId) return;
    localStorage.setItem(`${DIGEST_KEY_PREFIX}${userId}`, digest);
    setSeenDigest(digest);
  }, [enabled, userId, digest]);

  return {
    rows,
    digest,
    hasUnread,
    markNotificationsSeen,
    clearEvents,
  };
}
