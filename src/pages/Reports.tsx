import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReceiptPreview from '../components/ReceiptPreview';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Calendar,
  Download,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Smartphone,
  Banknote,
  CreditCard,
  AlertTriangle,
  User as UserIcon,
  Search,
  Activity,
  Printer
} from 'lucide-react';
import { authFetch } from '../lib/api-client';
import { PAGE_SIZE, QUERY_MAX_ITEMS } from '../constants';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Cell,
  Pie
} from 'recharts';
import { 
  format, 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  isAfter,
  isWithinInterval,
} from 'date-fns';
import { fr as dateFnsFr, arSA as dateFnsArSA } from 'date-fns/locale';
import { db, collection, onSnapshot, query, orderBy, limit } from '../lib/db';
import { Sale, Product, Order, RawMaterial, UserProfile, SaleItem, ActivityLog, Supplier, SupplierInvoice } from '../types';
import { clsx } from 'clsx';
import Pagination from '../components/Pagination';
import { downloadReportsPdf } from '../lib/export';
import { downloadReportsXlsx } from '../lib/reportsExcel';

/** Activities list uses a smaller page size so pagination is usable with typical log volumes. */
const ACTIVITIES_PAGE_SIZE = 25;
const LINE_ITEMS_PREVIEW = 3;

function parseSaleItems(sale: Sale): (SaleItem & { name?: string })[] {
  try {
    return Array.isArray(sale.items) ? sale.items : JSON.parse((sale.items as unknown as string) || '[]');
  } catch {
    return [];
  }
}

const Reports: React.FC = () => {
  const { t, tProduct, tCategory, currencyUnit, formatCurrency, isRTL, language } = useLanguage();
  const dateLocale = language === 'ar' ? dateFnsArSA : dateFnsFr;
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'sales' | 'activities' | 'expenses'>('analytics');

  const [sales, setSales] = useState<Sale[]>([]);
  const [cashiers, setCashiers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedCashier, setSelectedCashier] = useState('all');
  const [salesSubTab, setSalesSubTab] = useState<'transactions' | 'byProduct'>('transactions');
  const [transactionPage, setTransactionPage] = useState(1);
  const [productReportPage, setProductReportPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [productFilterIds, setProductFilterIds] = useState<string[]>([]);
  const [chartMode, setChartMode] = useState<'revenue' | 'orders'>('revenue');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'b2b' | 'special'>('all');
  const [isCumulative, setIsCumulative] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const todayYmd = format(new Date(), 'yyyy-MM-dd');
  const [analyticsStart, setAnalyticsStart] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [analyticsEnd, setAnalyticsEnd] = useState<string>(todayYmd);
  const [reportStart, setReportStart] = useState<string>(todayYmd);
  const [reportEnd, setReportEnd] = useState<string>(todayYmd);
  const [purchases, setPurchases] = useState<SupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [utilities, setUtilities] = useState<{ periodStart: string; amount: number }[]>([]);
  const [maintenances, setMaintenances] = useState<{ date: string; cost: number }[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<{ period: string; totalGross: number; totalCNASEmployer: number }[]>([]);
  const [expenseStart, setExpenseStart] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [expenseEnd, setExpenseEnd] = useState<string>(todayYmd);
  const [expenseSupplierId, setExpenseSupplierId] = useState<string>('all');
  const [expenseGroupBy, setExpenseGroupBy] = useState<'list' | 'supplier' | 'day' | 'month' | 'year'>('list');
  const [expensePage, setExpensePage] = useState(1);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    const now = new Date();
    let start;
    switch (timeFilter) {
      case 'day': start = startOfDay(now); break;
      case 'week': start = startOfWeek(now); break;
      case 'month': start = startOfMonth(now); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); break;
      default: start = startOfMonth(now);
    }
    setAnalyticsStart(format(start, 'yyyy-MM-dd'));
    setAnalyticsEnd(format(now, 'yyyy-MM-dd'));
  }, [timeFilter]);

  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        const token = localStorage.getItem('bakery_token');
        const res = await authFetch('/api/cashiers', {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (!res.ok) throw new Error('Failed to fetch cashiers');
        const data = await res.json();
        setCashiers(data);
      } catch (err) {
        console.error('Error fetching cashiers:', err);
      }
    };
    fetchCashiers();
  }, []);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('bakery_token');
        // Use the wider of analytics or report range so both tabs are covered
        const from = analyticsStart < reportStart ? analyticsStart : reportStart;
        const to = analyticsEnd > reportEnd ? analyticsEnd : reportEnd;
        const params = new URLSearchParams({ from, to });
        const res = await authFetch(`/api/sales?${params}`, {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (!res.ok) throw new Error('Failed to fetch sales');
        const data = await res.json();
        setSales(data);
      } catch (err) {
        console.error('Error fetching sales:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [analyticsStart, analyticsEnd, reportStart, reportEnd]);

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubscribeMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)));
    });

    const unsubscribeActivities = onSnapshot(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(QUERY_MAX_ITEMS)), (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    });

    const unsubscribePurchases = onSnapshot(query(collection(db, 'purchases'), orderBy('date', 'desc'), limit(QUERY_MAX_ITEMS)), (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierInvoice)));
    });

    const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    const unsubscribeUtilities = onSnapshot(collection(db, 'utilities'), (snapshot) => {
      setUtilities(snapshot.docs.map(doc => doc.data() as { periodStart: string; amount: number }));
    });

    const unsubscribeMaintenances = onSnapshot(collection(db, 'fixedAssetMaintenances'), (snapshot) => {
      setMaintenances(snapshot.docs.map(doc => doc.data() as { date: string; cost: number }));
    });

    const unsubscribePayrollRuns = onSnapshot(collection(db, 'payrollRuns'), (snapshot) => {
      setPayrollRuns(snapshot.docs.map(doc => doc.data() as { period: string; totalGross: number; totalCNASEmployer: number }));
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeMaterials();
      unsubscribeActivities();
      unsubscribePurchases();
      unsubscribeSuppliers();
      unsubscribeUtilities();
      unsubscribeMaintenances();
      unsubscribePayrollRuns();
    };
  }, []);

  // Role-based filtering
  const filteredSalesByRole = sales.filter(sale => {
    if (profile?.role === 'admin' || profile?.role === 'manager') return true;
    if (profile?.role === 'cashier') return sale.cashierId === profile.id || sale.cashierId === 'system';
    return false;
  });

  const filteredOrdersByRole = orders.filter(order => {
    if (profile?.role === 'admin' || profile?.role === 'manager') return true;
    if (profile?.role === 'cashier') return order.createdBy === profile.id;
    if (profile?.role === 'delivery_guy') return order.deliveryId === profile.id;
    if (profile?.role === 'customer_business' || profile?.role === 'customer_customers') return order.customerId === profile.id;
    return false;
  });

  const filteredSalesAnalytics = filteredSalesByRole.filter(s => {
    if (s.status === 'cancelled') return false;
    const date = new Date(s.createdAt);
    return isWithinInterval(date, {
      start: startOfDay(new Date(analyticsStart)),
      end: new Date(analyticsEnd + 'T23:59:59')
    });
  });

  const filteredOrders = filteredOrdersByRole.filter(o => {
    const date = new Date(o.createdAt);
    const inRange = isWithinInterval(date, {
      start: startOfDay(new Date(analyticsStart)),
      end: new Date(analyticsEnd + 'T23:59:59')
    });
    if (!inRange) return false;
    if (orderTypeFilter === 'special') return o.type === 'special';
    if (orderTypeFilter === 'b2b') return o.type !== 'special';
    return true;
  });

  const specialOrdersInRange = filteredOrders.filter(o => o.type === 'special');
  const specialOrdersDownpaymentCollected = specialOrdersInRange.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
  const specialOrdersBalanceOutstanding = specialOrdersInRange.reduce(
    (sum, o) => sum + Math.max(0, o.totalAmount - (o.amountPaid || 0)), 0
  );

  const reportSalesByDate = filteredSalesByRole.filter(s => {
    const date = new Date(s.createdAt);
    return isWithinInterval(date, {
      start: startOfDay(new Date(reportStart)),
      end: new Date(reportEnd + 'T23:59:59')
    });
  });

  // Orders (even not yet closed) carry real cash collected via amountPaid — fold
  // qualifying ones in as pseudo-sale rows so a downpayment shows up as a transaction
  // here too. Scoped to this list only (not filteredSalesAnalytics) since the
  // Analytics tab already surfaces order downpayments separately via
  // specialOrdersDownpaymentCollected — merging here too would double-count there.
  const reportOrdersByDate: Sale[] = filteredOrdersByRole
    .filter((o) => o.status !== 'cancelled' && (o.amountPaid ?? 0) > 0)
    .filter((o) => {
      const date = new Date(o.createdAt);
      return isWithinInterval(date, {
        start: startOfDay(new Date(reportStart)),
        end: new Date(reportEnd + 'T23:59:59')
      });
    })
    .map((o) => ({
      id: o.id,
      cashierId: o.createdBy || 'order',
      cashierName: (o.type === 'special' ? [o.firstName, o.lastName].filter(Boolean).join(' ') : o.clientName) || t('newSpecialOrder'),
      totalAmount: o.amountPaid || 0,
      paymentMethod: 'cash',
      items: o.items,
      comment: o.paymentStatus === 'closed' ? t('closeOrder') : t('downpayment'),
      createdAt: o.createdAt,
    }));

  const transactionsListSales = [...reportSalesByDate, ...reportOrdersByDate]
    .filter(s => selectedCashier === 'all' || s.cashierId === selectedCashier)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const transactionTotalPages = Math.ceil(transactionsListSales.length / PAGE_SIZE) || 1;
  const safeTransactionPage = Math.min(transactionPage, transactionTotalPages);
  const paginatedTransactions = transactionsListSales.slice(
    (safeTransactionPage - 1) * PAGE_SIZE,
    safeTransactionPage * PAGE_SIZE
  );

  const activeTransactions = transactionsListSales.filter(s => s.status !== 'cancelled');
  const totalTransactionCount = activeTransactions.length;
  const totalAmountTransactions = activeTransactions.reduce((sum, s) => sum + s.totalAmount, 0);

  const getLineItemLabel = (item: SaleItem & { name?: string }) => {
    const p = products.find(x => x.id === item.productId);
    if (p) return tProduct(p);
    if (item.name) return tProduct(item.name);
    return '—';
  };

  const getPaymentLabel = useCallback((method: string) => {
    if (method === 'cash') return t('cash');
    if (method === 'card') return t('card');
    if (method === 'mobile') return t('mobile');
    return method || '—';
  }, [t]);

  const productReportRows = useMemo(() => {
    const map = new Map<string, { productId: string; quantity: number; revenue: number; saleCount: number }>();
    for (const sale of reportSalesByDate) {
      const items = parseSaleItems(sale);
      for (const item of items) {
        const rev = item.quantity * (item.price || 0);
        const cur = map.get(item.productId) ?? { productId: item.productId, quantity: 0, revenue: 0, saleCount: 0 };
        cur.quantity += item.quantity;
        cur.revenue += rev;
        map.set(item.productId, cur);
      }
      const seenInSale = new Set(items.map(i => i.productId));
      for (const pid of seenInSale) {
        const cur = map.get(pid)!;
        cur.saleCount += 1;
      }
    }
    let rows = Array.from(map.values());
    if (productFilterIds.length > 0) {
      const allow = new Set(productFilterIds);
      rows = rows.filter(r => allow.has(r.productId));
    }
    rows.sort((a, b) => b.revenue - a.revenue);
    return rows;
  }, [reportSalesByDate, productFilterIds]);

  const productReportTotalPages = Math.ceil(productReportRows.length / PAGE_SIZE) || 1;
  const safeProductReportPage = Math.min(productReportPage, productReportTotalPages);
  const paginatedProductReport = productReportRows.slice(
    (safeProductReportPage - 1) * PAGE_SIZE,
    safeProductReportPage * PAGE_SIZE
  );

  /** Sum of line revenue for rows currently shown (respects product multi-select on By product tab). */
  const totalProductReportRevenue = productReportRows.reduce((sum, r) => sum + r.revenue, 0);

  const displayPeriodTotal =
    salesSubTab === 'transactions' ? totalAmountTransactions : totalProductReportRevenue;

  const expensePurchasesInRange = useMemo(() => {
    const interval = { start: startOfDay(new Date(expenseStart)), end: new Date(expenseEnd + 'T23:59:59') };
    return purchases.filter((p) => {
      if (!isWithinInterval(new Date(p.date), interval)) return false;
      if (expenseSupplierId !== 'all' && p.supplierId !== expenseSupplierId) return false;
      return true;
    });
  }, [purchases, expenseStart, expenseEnd, expenseSupplierId]);

  const expenseListRows = useMemo(
    () => [...expensePurchasesInRange].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [expensePurchasesInRange]
  );

  const expenseSupplierRows = useMemo(() => {
    const map = new Map<string, { supplierId: string; supplierName: string; count: number; total: number }>();
    for (const p of expensePurchasesInRange) {
      const cur = map.get(p.supplierId) ?? {
        supplierId: p.supplierId,
        supplierName: p.supplierName || suppliers.find((s) => s.id === p.supplierId)?.name || '—',
        count: 0,
        total: 0,
      };
      cur.count += 1;
      cur.total += p.totalAmount || 0;
      map.set(p.supplierId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expensePurchasesInRange, suppliers]);

  const expenseBucketFormat = expenseGroupBy === 'year' ? 'yyyy' : expenseGroupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd';

  const expenseBucketRows = useMemo(() => {
    const map = new Map<string, { periodLabel: string; count: number; total: number }>();
    for (const p of expensePurchasesInRange) {
      const key = format(new Date(p.date), expenseBucketFormat);
      const cur = map.get(key) ?? { periodLabel: key, count: 0, total: 0 };
      cur.count += 1;
      cur.total += p.totalAmount || 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.periodLabel.localeCompare(b.periodLabel));
  }, [expensePurchasesInRange, expenseBucketFormat]);

  /** List mode has no natural axis, so its chart falls back to a daily breakdown. */
  const expenseChartData = useMemo(() => {
    if (expenseGroupBy === 'supplier') {
      return expenseSupplierRows.slice(0, 10).map((r) => ({ name: r.supplierName, total: r.total }));
    }
    if (expenseGroupBy === 'list') {
      const map = new Map<string, number>();
      for (const p of expensePurchasesInRange) {
        const key = format(new Date(p.date), 'yyyy-MM-dd');
        map.set(key, (map.get(key) || 0) + (p.totalAmount || 0));
      }
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, total]) => ({ name, total }));
    }
    return expenseBucketRows.map((r) => ({ name: r.periodLabel, total: r.total }));
  }, [expenseGroupBy, expenseSupplierRows, expenseBucketRows, expensePurchasesInRange]);

  const expenseTotal = expensePurchasesInRange.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  const expenseListTotalPages = Math.ceil(expenseListRows.length / PAGE_SIZE) || 1;
  const safeExpensePage = Math.min(expensePage, expenseListTotalPages);
  const paginatedExpenseList = expenseListRows.slice(
    (safeExpensePage - 1) * PAGE_SIZE,
    safeExpensePage * PAGE_SIZE
  );

  const activityMatchesSearch = (a: ActivityLog) => {
    if (!activitySearch) return true;
    const q = activitySearch.toLowerCase();
    return Boolean(
      a.userName?.toLowerCase().includes(q) ||
        a.action?.toLowerCase().includes(q) ||
        a.details?.toLowerCase().includes(q)
    );
  };

  const filteredActivities = activities.filter(a => {
    if (!a.timestamp) return false;
    const inRange = isWithinInterval(new Date(a.timestamp), {
      start: startOfDay(new Date(reportStart)),
      end: new Date(reportEnd + 'T23:59:59')
    });
    return inRange && activityMatchesSearch(a);
  });

  const activityTotalPages = Math.ceil(filteredActivities.length / ACTIVITIES_PAGE_SIZE) || 1;
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const paginatedActivities = filteredActivities.slice(
    (safeActivityPage - 1) * ACTIVITIES_PAGE_SIZE,
    safeActivityPage * ACTIVITIES_PAGE_SIZE
  );

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      default: return null;
    }
  };

  const totalRevenue = filteredSalesAnalytics.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalDiscount = filteredSalesAnalytics.reduce((sum, s) => sum + (s.discount ?? 0), 0);
  const totalSalesCountAll = filteredSalesAnalytics.length;
  const avgOrderValue = totalSalesCountAll > 0 ? totalRevenue / totalSalesCountAll : 0;

  // Order Stats
  const now = new Date();
  const today = startOfDay(now);
  const thisWeek = startOfWeek(now);
  const thisMonth = startOfMonth(now);

  const fulfilledToday = filteredOrders.filter(o => o.status === 'delivered' && o.updatedAt && isAfter(new Date(o.updatedAt), today));
  const fulfilledThisWeek = filteredOrders.filter(o => o.status === 'delivered' && o.updatedAt && isAfter(new Date(o.updatedAt), thisWeek));
  const fulfilledThisMonth = filteredOrders.filter(o => o.status === 'delivered' && o.updatedAt && isAfter(new Date(o.updatedAt), thisMonth));

  const unfulfilledOrdersCount = filteredOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;
  const delayedOrdersCount = filteredOrders.filter(o => {
    if (o.status === 'delivered' || o.status === 'cancelled') return false;
    if (!o.expectedDate) return false;
    const expected = new Date(`${o.expectedDate}T${o.expectedTime || '23:59'}`);
    return expected < now;
  }).length;

  const totalFulfilledToday = fulfilledToday.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalFulfilledThisWeek = fulfilledThisWeek.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalFulfilledThisMonth = fulfilledThisMonth.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const totalOrdersCount = filteredOrders.length;
  const fulfilledOrdersCount = filteredOrders.filter(o => o.status === 'delivered').length;
  const cancelledOrdersCount = filteredOrders.filter(o => o.status === 'cancelled').length;
  const fulfillmentRate = totalOrdersCount > 0 ? (fulfilledOrdersCount / totalOrdersCount) * 100 : 0;

  // Profit: period-matched against totalRevenue (analyticsStart..analyticsEnd), not current inventory value.
  const analyticsInterval = {
    start: startOfDay(new Date(analyticsStart)),
    end: new Date(analyticsEnd + 'T23:59:59')
  };
  const totalCosts = purchases
    .filter(p => isWithinInterval(new Date(p.date), analyticsInterval))
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const grossProfit = totalRevenue - totalCosts;

  const utilitiesTotal = utilities
    .filter(u => isWithinInterval(new Date(u.periodStart), analyticsInterval))
    .reduce((sum, u) => sum + (u.amount || 0), 0);
  const maintenanceTotal = maintenances
    .filter(m => isWithinInterval(new Date(m.date), analyticsInterval))
    .reduce((sum, m) => sum + (m.cost || 0), 0);
  const payrollTotal = payrollRuns
    .filter(r => isWithinInterval(new Date(`${r.period}-01`), {
      start: startOfMonth(analyticsInterval.start),
      end: analyticsInterval.end
    }))
    .reduce((sum, r) => sum + (r.totalGross || 0) + (r.totalCNASEmployer || 0), 0);
  const operatingExpenses = utilitiesTotal + maintenanceTotal + payrollTotal;
  const netProfit = grossProfit - operatingExpenses;

  // Inventory Consumption (Simplified)
  const inventoryConsumption = materials.map(m => ({
    material: m,
    consumption: Math.max(0, m.minStock * 2 - m.currentStock),
    stock: m.currentStock
  })).sort((a, b) => b.consumption - a.consumption).slice(0, 5);

  // Top Sellers based on actual sales
  const topSellers = products.map(p => {
    const unitsSold = filteredSalesAnalytics.reduce((sum, s) => {
      const saleItems: SaleItem[] = Array.isArray(s.items) ? s.items : JSON.parse((s.items as any) || '[]');
      const item = saleItems.find(i => i.productId === p.id);
      return sum + (item ? item.quantity : 0);
    }, 0);
    return { ...p, unitsSold };
  }).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);

  const getChartData = () => {
    const start = new Date(analyticsStart);
    const end = new Date(analyticsEnd);
    const days = [];
    let current = new Date(start);
    
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    let cumulativeRevenue = 0;
    let cumulativeOrders = 0;

    return days.map(date => {
      const daySales = filteredSalesAnalytics.filter(s => startOfDay(new Date(s.createdAt)).getTime() === startOfDay(date).getTime());
      const dayOrders = filteredOrders.filter(o => startOfDay(new Date(o.createdAt)).getTime() === startOfDay(date).getTime());
      
      const revenue = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
      const ordersCount = dayOrders.length;

      cumulativeRevenue += revenue;
      cumulativeOrders += ordersCount;

      return {
        name: format(date, 'd MMM', { locale: dateLocale }),
        revenue: isCumulative ? cumulativeRevenue : revenue,
        orders: isCumulative ? cumulativeOrders : ordersCount
      };
    });
  };

  const chartData = getChartData();

  const categoryData = products.reduce((acc: {name: string, value: number}[], p) => {
    const existing = acc.find(item => item.name === p.category);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: p.category, value: 1 });
    }
    return acc;
  }, []).slice(0, 4);

  const orderStatusData = [
    { name: t('ordered'), value: filteredOrders.filter(o => o.status === 'ordered').length },
    { name: t('in-progress'), value: filteredOrders.filter(o => o.status === 'in-progress').length },
    { name: t('delayed'), value: filteredOrders.filter(o => o.status === 'delayed').length },
    { name: t('delivered'), value: filteredOrders.filter(o => o.status === 'delivered').length },
    { name: t('cancelled'), value: filteredOrders.filter(o => o.status === 'cancelled').length },
  ].filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];

  const pdfLabels = useMemo(
    () =>
      ({
        reports: t('reports'),
        analytics: t('analytics'),
        salesReport: t('salesReport'),
        activities: t('activities'),
        reportPdfFilteredNote: t('reportPdfFilteredNote'),
        orderReport: t('orderReport'),
        totalRevenue: t('totalRevenue'),
        costs: t('costs'),
        grossProfit: t('grossProfit'),
        netProfit: t('netProfit'),
        operatingExpenses: t('operatingExpenses'),
        avgOrderValue: t('avgOrderValue'),
        totalOrders: t('totalOrders'),
        fulfilled: t('fulfilled'),
        fulfillmentRate: t('fulfillmentRate'),
        cancelled: t('cancelled'),
        orderSummary: t('orderSummary'),
        daily: t('daily'),
        weekly: t('weekly'),
        monthly: t('monthly'),
        unfulfilledOrders: t('unfulfilledOrders'),
        delayedOrders: t('delayedOrders'),
        orderStatusDistribution: t('orderStatusDistribution'),
        salesTrends: t('salesTrends'),
        reportPdfDailyBreakdown: t('reportPdfDailyBreakdown'),
        revenue: t('revenue'),
        orders: t('orders'),
        salesByCategory: t('salesByCategory'),
        units: t('units'),
        topSellers: t('topSellers'),
        inventoryConsumption: t('inventoryConsumption'),
        material: t('material'),
        stock: t('stock'),
        salesContainingProduct: t('salesContainingProduct'),
        quantity: t('quantity'),
        timestamp: t('timestamp'),
        cashier: t('cashier'),
        payment: t('payment'),
        products: t('products'),
        amount: t('amount'),
        records: t('records'),
        reportPdfSubTabTransactions: t('reportPdfSubTabTransactions'),
        reportPdfSubTabByProduct: t('reportPdfSubTabByProduct'),
        fromDate: t('fromDate'),
        toDate: t('toDate'),
        search: t('search'),
        cash: t('cash'),
        card: t('card'),
        mobile: t('mobile'),
        supplierExpenses: t('supplierExpenses'),
        supplier: t('supplier'),
        allSuppliers: t('allSuppliers'),
        invoiceNumber: t('invoiceNumber'),
        invoiceCount: t('invoiceCount'),
        period: t('period'),
      }) as Record<string, string>,
    [t]
  );

  const handleExport = useCallback(async () => {
    if (loading) {
      toast.error(t('loading'));
      return;
    }
    const toastId = toast.loading(t('exportGenerating'));
    const exportFn = exportFormat === 'pdf' ? downloadReportsPdf : downloadReportsXlsx;
    const filename = `BellaDolce-report-${activeTab}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.${exportFormat}`;

    const timePresetLabel =
      timeFilter === 'day'
        ? t('day')
        : timeFilter === 'week'
          ? t('week')
          : timeFilter === 'month'
            ? t('month')
            : t('year');
    const periodLine = `${t('fromDate')}: ${format(new Date(analyticsStart), 'PP', { locale: dateLocale })} — ${t('toDate')}: ${format(new Date(analyticsEnd), 'PP', { locale: dateLocale })}`;
    const presetLine = `${t('reportPdfPresetTime')}: ${timePresetLabel}`;

    try {
      if (activeTab === 'analytics') {
        await exportFn({
          filename,
          isRTL,
          currencyUnit,
          labels: pdfLabels,
          mode: 'analytics',
          analytics: {
            periodLine,
            presetLine,
            kpi: {
              totalRevenue,
              totalCosts,
              grossProfit,
              operatingExpenses,
              netProfit,
              avgOrderValue,
            },
            orders: {
              totalOrdersCount,
              fulfilledOrdersCount,
              fulfillmentRate,
              cancelledOrdersCount,
              unfulfilledOrdersCount,
              delayedOrdersCount,
              fulfilledTodayCount: fulfilledToday.length,
              totalFulfilledToday,
              fulfilledThisWeekCount: fulfilledThisWeek.length,
              totalFulfilledThisWeek,
              fulfilledThisMonthCount: fulfilledThisMonth.length,
              totalFulfilledThisMonth,
            },
            orderStatusRows: orderStatusData.map((d) => ({ label: d.name, value: d.value })),
            chartRows: chartData.map((d) => ({
              dayLabel: d.name,
              revenue: d.revenue,
              orders: d.orders,
            })),
            categories: categoryData.map((c) => ({ label: tCategory(c.name), count: c.value })),
            topSellers: topSellers.map((product, i) => ({
              rank: i + 1,
              name: tProduct(product),
              category: tCategory(product.category),
              units: product.unitsSold,
            })),
            inventoryRows: inventoryConsumption.map((item) => ({
              name: tProduct(item.material),
              consumption: item.consumption.toFixed(1),
              stock: item.stock,
            })),
          },
        });
      } else if (activeTab === 'sales') {
        const salesPeriodNote = `${t('fromDate')}: ${format(new Date(reportStart), 'PP', { locale: dateLocale })} — ${t('toDate')}: ${format(new Date(reportEnd), 'PP', { locale: dateLocale })}`;
        if (salesSubTab === 'transactions') {
          if (transactionsListSales.length === 0) {
            toast.error(t('reportExportEmpty'), { id: toastId });
            return;
          }
          const cashierLabel =
            selectedCashier === 'all'
              ? t('allCashiers')
              : cashiers.find((c) => c.id === selectedCashier)?.name || t('cashier');
          const filterNote = `${salesPeriodNote} · ${t('cashier')}: ${cashierLabel}`;
          await exportFn({
            filename,
            isRTL,
            currencyUnit,
            labels: pdfLabels,
            mode: 'sales_transactions',
            salesTransactions: {
              sales: transactionsListSales,
              filterNote,
              getLineItemLabel,
              getPaymentLabel,
              formatSaleDate: (iso: string) => format(new Date(iso), 'PP', { locale: dateLocale }),
              formatSaleTime: (iso: string) => format(new Date(iso), 'HH:mm:ss'),
            },
          });
        } else {
          if (productReportRows.length === 0) {
            toast.error(t('reportExportEmpty'), { id: toastId });
            return;
          }
          const productNote =
            productFilterIds.length > 0
              ? `${salesPeriodNote} · ${t('products')}: ${productFilterIds.length}`
              : salesPeriodNote;
          await exportFn({
            filename,
            isRTL,
            currencyUnit,
            labels: pdfLabels,
            mode: 'sales_by_product',
            salesByProduct: {
              rows: productReportRows.map((row) => {
                const p = products.find((x) => x.id === row.productId);
                const name = p
                  ? tProduct(p)
                  : getLineItemLabel({
                      productId: row.productId,
                      quantity: row.quantity,
                      price: row.quantity ? row.revenue / row.quantity : 0,
                    });
                return {
                  name,
                  quantity: row.quantity,
                  revenue: row.revenue,
                  saleCount: row.saleCount,
                };
              }),
              filterNote: productNote,
            },
          });
        }
      } else if (activeTab === 'activities') {
        if (filteredActivities.length === 0) {
          toast.error(t('reportExportEmpty'), { id: toastId });
          return;
        }
        const actPeriod = `${t('fromDate')}: ${format(new Date(reportStart), 'PP', { locale: dateLocale })} — ${t('toDate')}: ${format(new Date(reportEnd), 'PP', { locale: dateLocale })}`;
        const filterNote = activitySearch.trim()
          ? `${actPeriod} · ${t('search')}: ${activitySearch.trim()}`
          : actPeriod;
        await exportFn({
          filename,
          isRTL,
          currencyUnit,
          labels: pdfLabels,
          mode: 'activities',
          activities: {
            logs: filteredActivities,
            filterNote,
            formatLogTime: (iso: string) => format(new Date(iso), 'PPp', { locale: dateLocale }),
          },
        });
      } else {
        if (expensePurchasesInRange.length === 0) {
          toast.error(t('reportExportEmpty'), { id: toastId });
          return;
        }
        const supplierLabel =
          expenseSupplierId === 'all'
            ? t('allSuppliers')
            : suppliers.find((s) => s.id === expenseSupplierId)?.name || t('supplier');
        const expensePeriodNote = `${t('fromDate')}: ${format(new Date(expenseStart), 'PP', { locale: dateLocale })} — ${t('toDate')}: ${format(new Date(expenseEnd), 'PP', { locale: dateLocale })}`;
        const filterNote = `${expensePeriodNote} · ${t('suppliers')}: ${supplierLabel}`;
        await exportFn({
          filename,
          isRTL,
          currencyUnit,
          labels: pdfLabels,
          mode: 'supplier_expenses',
          supplierExpenses: {
            groupBy: expenseGroupBy,
            filterNote,
            total: expenseTotal,
            listRows: expenseListRows.map((p) => ({
              date: format(new Date(p.date), 'PP', { locale: dateLocale }),
              supplierName: p.supplierName || suppliers.find((s) => s.id === p.supplierId)?.name || '—',
              invoiceNumber: p.invoiceNumber,
              amount: p.totalAmount,
            })),
            supplierRows: expenseSupplierRows.map((r) => ({ supplierName: r.supplierName, count: r.count, total: r.total })),
            bucketRows: expenseBucketRows.map((r) => ({ periodLabel: r.periodLabel, count: r.count, total: r.total })),
          },
        });
      }
      toast.success(t('reportDownloaded'), { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error(t('reportDownloadError'), { id: toastId });
    }
  }, [
    loading,
    t,
    activeTab,
    salesSubTab,
    isRTL,
    currencyUnit,
    pdfLabels,
    dateLocale,
    analyticsStart,
    analyticsEnd,
    timeFilter,
    chartData,
    orderStatusData,
    categoryData,
    topSellers,
    inventoryConsumption,
    totalRevenue,
    totalCosts,
    grossProfit,
    operatingExpenses,
    netProfit,
    avgOrderValue,
    totalOrdersCount,
    fulfilledOrdersCount,
    fulfillmentRate,
    cancelledOrdersCount,
    unfulfilledOrdersCount,
    delayedOrdersCount,
    fulfilledToday,
    totalFulfilledToday,
    fulfilledThisWeek,
    totalFulfilledThisWeek,
    fulfilledThisMonth,
    totalFulfilledThisMonth,
    reportStart,
    reportEnd,
    transactionsListSales,
    selectedCashier,
    cashiers,
    productReportRows,
    productFilterIds,
    products,
    filteredActivities,
    activitySearch,
    getLineItemLabel,
    getPaymentLabel,
    tProduct,
    tCategory,
    exportFormat,
    expensePurchasesInRange,
    expenseListRows,
    expenseSupplierRows,
    expenseBucketRows,
    expenseTotal,
    expenseGroupBy,
    expenseSupplierId,
    expenseStart,
    expenseEnd,
    suppliers,
  ]);

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('reports')}</h1>
          <p className="text-slate-500 dark:text-zinc-500 font-medium">{t('reportsDesc')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex">
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="px-3.5 py-1.5 bg-amber-600 text-white text-sm font-bold rounded-s-lg hover:bg-amber-500 transition-all shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none"
            >
              <Download className="w-3.5 h-3.5" />
              {exportFormat === 'xlsx' ? t('exportExcel') : t('exportPDF')}
            </button>
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={loading}
              aria-label={t('exportFormat') || 'Export format'}
              className="px-1.5 bg-amber-700 text-white text-xs rounded-e-lg hover:bg-amber-600 transition-all shadow-sm flex items-center justify-center border-s border-amber-500/40 disabled:opacity-50 disabled:pointer-events-none"
            >
              ▾
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full mt-2 end-0 z-20 w-36 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExportFormat('xlsx'); setExportMenuOpen(false); }}
                  className={clsx("w-full text-start px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5", exportFormat === 'xlsx' && "text-amber-600")}
                >
                  {t('exportFormatExcel')}
                </button>
                <button
                  type="button"
                  onClick={() => { setExportFormat('pdf'); setExportMenuOpen(false); }}
                  className={clsx("w-full text-start px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5", exportFormat === 'pdf' && "text-amber-600")}
                >
                  {t('exportFormatPdf')}
                </button>
              </div>
            )}
          </div>
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setActiveTab('analytics')}
              className={clsx(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'analytics' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t('analytics')}
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={clsx(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'sales' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t('salesReport')}
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={clsx(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'expenses' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t('supplierExpenses')}
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={clsx(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'activities' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t('activities')}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-white/[0.02] p-4 rounded-3xl border border-slate-100 dark:border-white/5">
            <div className="flex flex-col sm:flex-row gap-3">
              <select 
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm font-bold rounded-xl px-4 py-2 focus:ring-amber-500"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
              >
                <option value="day">{t('day')}</option>
                <option value="week">{t('week')}</option>
                <option value="month">{t('month')}</option>
                <option value="year">{t('year')}</option>
              </select>
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                <Calendar className="w-4 h-4 text-amber-500" />
                <input 
                  type="date" 
                  className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-900 dark:text-white" 
                  value={analyticsStart}
                  onChange={(e) => setAnalyticsStart(e.target.value)}
                />
                <span className="text-slate-400 dark:text-zinc-500">-</span>
                <input 
                  type="date" 
                  className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-900 dark:text-white" 
                  value={analyticsEnd}
                  onChange={(e) => setAnalyticsEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('totalRevenue')}</p>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{totalRevenue.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('costs')}</p>
              <h3 className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{totalCosts.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('grossProfit')}</p>
              <h3 className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">{grossProfit.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('operatingExpenses')}</p>
              <h3 className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{operatingExpenses.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center border", netProfit >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20")}>
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('netProfit')}</p>
              <h3 className={clsx("text-2xl font-display font-bold", netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{netProfit.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('avgOrderValue')}</p>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{avgOrderValue.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                  <Banknote className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('totalDiscount')}</p>
              <h3 className="text-2xl font-display font-bold text-orange-600 dark:text-orange-400">{totalDiscount.toLocaleString()} {currencyUnit}</h3>
            </div>
          </div>


      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-amber-600 rounded-full"></div>
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{t('orderReport')}</h2>
          </div>
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
            {(['all', 'b2b', 'special'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setOrderTypeFilter(tf)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  orderTypeFilter === tf ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t(tf === 'all' ? 'ordersTypeAll' : tf === 'b2b' ? 'ordersTypeB2B' : 'ordersTypeSpecial')}
              </button>
            ))}
          </div>
        </div>

        {specialOrdersInRange.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('downpayment')}</p>
              <h3 className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">{specialOrdersDownpaymentCollected.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('balanceDue')}</p>
              <h3 className="text-2xl font-display font-bold text-amber-600 dark:text-amber-500">{specialOrdersBalanceOutstanding.toLocaleString()} {currencyUnit}</h3>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('totalOrders')}</p>
            <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{totalOrdersCount}</h3>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('fulfilled')}</p>
            <h3 className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">{fulfilledOrdersCount}</h3>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('fulfillmentRate')}</p>
            <h3 className="text-2xl font-display font-bold text-amber-600 dark:text-amber-500">{fulfillmentRate.toFixed(1)}%</h3>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('cancelled')}</p>
            <h3 className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{cancelledOrdersCount}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('orderSummary')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
              <p className="text-slate-500 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">{t('daily')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{fulfilledToday.length}</h3>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{totalFulfilledToday.toLocaleString()} {currencyUnit}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
              <p className="text-slate-500 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">{t('weekly')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{fulfilledThisWeek.length}</h3>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{totalFulfilledThisWeek.toLocaleString()} {currencyUnit}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
              <p className="text-slate-500 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">{t('monthly')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{fulfilledThisMonth.length}</h3>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{totalFulfilledThisMonth.toLocaleString()} {currencyUnit}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-500" />
                <p className="text-amber-600 dark:text-amber-500 text-[10px] font-bold uppercase tracking-widest">{t('unfulfilledOrders')}</p>
              </div>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{unfulfilledOrdersCount}</h3>
            </div>
            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                <p className="text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest">{t('delayedOrders')}</p>
              </div>
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">{delayedOrdersCount}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{t('orderStatusDistribution')}</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--tooltip-bg)', 
                        borderRadius: '16px', 
                        border: '1px solid var(--tooltip-border)', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        color: 'var(--tooltip-text)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-3 flex flex-col justify-center">
              {orderStatusData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                    <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{item.value} {t('orders')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('salesTrends')}</h2>
              <button 
                onClick={() => setIsCumulative(!isCumulative)}
                className={clsx(
                  "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                  isCumulative ? "bg-amber-600 border-amber-600 text-white" : "bg-slate-50 dark:bg-black border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-500"
                )}
              >
                {t('cumulative')}
              </button>
            </div>
            <div className="flex gap-2 p-1 bg-slate-50 dark:bg-black rounded-xl w-fit border border-slate-200 dark:border-white/5">
              <button 
                onClick={() => setChartMode('revenue')}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  chartMode === 'revenue' ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
                )}
              >
                {t('revenue')}
              </button>
              <button 
                onClick={() => setChartMode('orders')}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  chartMode === 'orders' ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
                )}
              >
                {t('orders')}
              </button>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorChart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--tooltip-bg)', 
                    borderRadius: '16px', 
                    border: '1px solid var(--tooltip-border)', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    color: 'var(--tooltip-text)'
                  }}
                  itemStyle={{color: '#d97706', fontWeight: 'bold'}}
                />
                <Area 
                  type="monotone" 
                  dataKey={chartMode} 
                  stroke="#d97706" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorChart)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8">{t('salesByCategory')}</h2>
          <div className="h-[250px] w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--tooltip-bg)', 
                    borderRadius: '16px', 
                    border: '1px solid var(--tooltip-border)', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    color: 'var(--tooltip-text)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {categoryData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                  <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{tCategory(item.name)}</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.value} {t('units')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('inventoryConsumption')}</h2>
          <div className="space-y-6">
            {inventoryConsumption.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                   <span className="text-slate-700 dark:text-zinc-300">{tProduct(item.material)}</span>
                   <span className="text-amber-600 dark:text-amber-500">{item.consumption.toFixed(1)} {t('units')}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-black rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                  <div 
                    className="h-full bg-amber-600 rounded-full transition-all shadow-[0_0_10px_rgba(217,119,6,0.3)]"
                    style={{ width: `${Math.min((item.consumption / (item.stock + item.consumption)) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('topSellers')}</h2>
          <div className="space-y-4">
            {topSellers.map((product, i) => (
              <div key={product.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center font-bold text-amber-600 dark:text-amber-500 shadow-sm border border-slate-100 dark:border-white/10">
                  #{i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{tProduct(product)}</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-medium">{tCategory(product.category)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-500">{product.unitsSold} {t('units')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
      )}
      {activeTab === 'sales' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 w-fit">
            <button
              type="button"
              onClick={() => {
                setSalesSubTab('transactions');
                setTransactionPage(1);
              }}
              className={clsx(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all',
                salesSubTab === 'transactions'
                  ? 'bg-white dark:bg-zinc-900 text-primary-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {t('transactions') || 'Transactions'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSalesSubTab('byProduct');
                setProductReportPage(1);
              }}
              className={clsx(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all',
                salesSubTab === 'byProduct'
                  ? 'bg-white dark:bg-zinc-900 text-primary-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {t('reportByProduct')}
            </button>
          </div>

          <div
            className={clsx(
              'grid grid-cols-1 gap-4',
              salesSubTab === 'transactions' ? 'md:grid-cols-4' : 'md:grid-cols-3'
            )}
          >
            {salesSubTab === 'transactions' && (
              <div className="card p-4 border-slate-100 dark:border-white/10 flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('cashier') || 'Cashier'}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <select
                    className="input pl-10 h-10 py-0 text-sm"
                    value={selectedCashier}
                    onChange={(e) => {
                      setSelectedCashier(e.target.value);
                      setTransactionPage(1);
                    }}
                  >
                    <option value="all">{t('allCashiers') || 'All Cashiers'}</option>
                    {cashiers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="card p-4 border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('fromDate') || 'From Date'}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  className="input pl-10 h-10 py-0 text-sm"
                  value={reportStart}
                  onChange={(e) => {
                    setReportStart(e.target.value);
                    setTransactionPage(1);
                    setProductReportPage(1);
                    setActivityPage(1);
                  }}
                />
              </div>
            </div>

            <div className="card p-4 border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('toDate') || 'To Date'}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  className="input pl-10 h-10 py-0 text-sm"
                  value={reportEnd}
                  onChange={(e) => {
                    setReportEnd(e.target.value);
                    setTransactionPage(1);
                    setProductReportPage(1);
                    setActivityPage(1);
                  }}
                />
              </div>
            </div>

            <div className="card p-4 bg-primary-600 border-none flex flex-col justify-center">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">{t('totalPeriodSales') || 'Total Period Sales'}</p>
              <h3 className="text-2xl font-display font-bold text-white">{displayPeriodTotal.toLocaleString()} {currencyUnit}</h3>
            </div>
          </div>

          {salesSubTab === 'byProduct' && (
            <div className="card p-4 border-slate-100 dark:border-white/10 space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('products')}</label>
              <select
                multiple
                size={8}
                value={productFilterIds}
                onChange={(e) => {
                  const next = Array.from(e.target.selectedOptions, o => o.value);
                  setProductFilterIds(next);
                  setProductReportPage(1);
                }}
                className="input w-full min-h-[160px] text-sm"
              >
                {[...products]
                  .sort((a, b) =>
                    tProduct(a).localeCompare(tProduct(b), undefined, { sensitivity: 'base' })
                  )
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {tProduct(p)}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-slate-400 dark:text-zinc-500">{t('productsFilterHint')}</p>
              {productFilterIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setProductFilterIds([]);
                    setProductReportPage(1);
                  }}
                  className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {t('productsFilterAll')}
                </button>
              )}
            </div>
          )}

          {reportSalesByDate.length >= QUERY_MAX_ITEMS && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex items-center gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">
                {t('maxDataReached') || 'Max data limit reached (500 records). Please narrow your date range to see more specific results.'}
              </p>
            </div>
          )}

          {salesSubTab === 'transactions' && (
            <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('transactions') || 'Transactions'}</h2>
                <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full text-xs font-bold uppercase tracking-wider">
                  {totalTransactionCount} {t('records') || 'Records'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                      <th className="px-8 py-4">{t('timestamp') || 'Timestamp'}</th>
                      <th className="px-8 py-4">{t('cashier') || 'Cashier'}</th>
                      <th className="px-8 py-4">{t('payment') || 'Payment'}</th>
                      <th className="px-8 py-4">{t('products') || 'Products'}</th>
                      <th className="px-8 py-4 text-right">{t('amount') || 'Amount'}</th>
                      <th className="px-8 py-4 text-right">{t('discount') || 'Discount'}</th>
                      <th className="px-8 py-4">{t('comment') || 'Comment'}</th>
                      <th className="px-8 py-4">{t('status')}</th>
                      <th className="px-8 py-4">Reprint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-8 py-12 text-center text-slate-400 italic">
                          {t('loading') || 'Loading transactions...'}
                        </td>
                      </tr>
                    ) : paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map((sale) => {
                        const items = parseSaleItems(sale);
                        const rest = items.length - LINE_ITEMS_PREVIEW;
                        return (
                          <tr key={sale.id} className={`group transition-all ${sale.status === 'cancelled' ? 'opacity-60 bg-red-50/30 dark:bg-red-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'}`}>
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white">{format(new Date(sale.createdAt), 'MMM dd, yyyy')}</span>
                                <span className="text-xs text-slate-400 font-medium">{format(new Date(sale.createdAt), 'HH:mm:ss')}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs">
                                  {(sale.cashierName || 'U').charAt(0)}
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{sale.cashierName || 'Unknown'}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div
                                className={clsx(
                                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                  sale.paymentMethod === 'cash'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : sale.paymentMethod === 'card'
                                      ? 'bg-blue-100 text-blue-600'
                                      : 'bg-purple-100 text-purple-600'
                                )}
                              >
                                {getPaymentIcon(sale.paymentMethod)}
                                {getPaymentLabel(sale.paymentMethod)}
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex flex-col gap-1">
                                {items.slice(0, LINE_ITEMS_PREVIEW).map((item, idx) => (
                                  <span key={idx} className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    {item.quantity}x {getLineItemLabel(item)}
                                  </span>
                                ))}
                                {rest > 0 && (
                                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                                    +{rest} {t('additionalLineItems')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right font-display font-bold text-lg text-slate-900 dark:text-white">
                              {sale.totalAmount.toLocaleString()} {currencyUnit}
                            </td>
                            <td className="px-8 py-5 text-right text-sm font-medium">
                              {sale.discount ? (
                                <span className="text-rose-600 font-bold">
                                  {`-${sale.discount.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyUnit}`}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-8 py-5 text-xs font-medium text-slate-600 dark:text-slate-400">
                              {sale.comment || '—'}
                            </td>
                            <td className="px-8 py-5">
                              {sale.status === 'cancelled' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  {t('cancelled')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  {t('completed') || 'Completed'}
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-5">
                              {sale.status !== 'cancelled' && (
                                <button onClick={() => setSelectedSaleForReceipt(sale)} className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title={t('reprint')}>
                                  <Printer className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-8 py-12 text-center text-slate-400 italic">
                          {t('noSalesFound') || 'No sales found for the selected criteria.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {t('showing') || 'Showing'}{' '}
                  <span className="text-slate-900 dark:text-white">
                    {totalTransactionCount === 0 ? 0 : (safeTransactionPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  {t('rangeTo')}{' '}
                  <span className="text-slate-900 dark:text-white">
                    {Math.min(safeTransactionPage * PAGE_SIZE, totalTransactionCount)}
                  </span>{' '}
                  {t('of') || 'of'}{' '}
                  <span className="text-slate-900 dark:text-white">{totalTransactionCount}</span>{' '}
                  {t('results') || 'results'}
                </p>
                <Pagination
                  currentPage={safeTransactionPage}
                  totalPages={transactionTotalPages}
                  onPageChange={setTransactionPage}
                  variant="footer"
                />
              </div>
            </div>
          )}

          {salesSubTab === 'byProduct' && (
            <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('reportByProduct')}</h2>
                <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full text-xs font-bold uppercase tracking-wider">
                  {productReportRows.length} {t('products') || 'Products'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                      <th className="px-8 py-4">{t('products') || 'Product'}</th>
                      <th className="px-8 py-4">{t('quantity') || 'Quantity'}</th>
                      <th className="px-8 py-4">{t('revenue')}</th>
                      <th className="px-8 py-4 text-right">{t('salesContainingProduct')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic">
                          {t('loading') || 'Loading...'}
                        </td>
                      </tr>
                    ) : paginatedProductReport.length > 0 ? (
                      paginatedProductReport.map(row => {
                        const p = products.find(x => x.id === row.productId);
                        return (
                          <tr key={row.productId} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                            <td className="px-8 py-5 font-bold text-slate-900 dark:text-white">
                              {p ? tProduct(p) : getLineItemLabel({ productId: row.productId, quantity: 0, price: 0 })}
                            </td>
                            <td className="px-8 py-5 text-slate-700 dark:text-slate-300">{row.quantity}</td>
                            <td className="px-8 py-5 text-slate-700 dark:text-slate-300">
                              {row.revenue.toLocaleString()} {currencyUnit}
                            </td>
                            <td className="px-8 py-5 text-right font-bold text-slate-900 dark:text-white">{row.saleCount}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic">
                          {t('noSalesFound') || 'No sales found for the selected criteria.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {t('showing') || 'Showing'}{' '}
                  <span className="text-slate-900 dark:text-white">
                    {productReportRows.length === 0 ? 0 : (safeProductReportPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  {t('rangeTo')}{' '}
                  <span className="text-slate-900 dark:text-white">
                    {Math.min(safeProductReportPage * PAGE_SIZE, productReportRows.length)}
                  </span>{' '}
                  {t('of') || 'of'}{' '}
                  <span className="text-slate-900 dark:text-white">{productReportRows.length}</span>{' '}
                  {t('results') || 'results'}
                </p>
                <Pagination
                  currentPage={safeProductReportPage}
                  totalPages={productReportTotalPages}
                  onPageChange={setProductReportPage}
                  variant="footer"
                />
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'activities' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4 border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('fromDate')}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  className="input pl-10 h-10 py-0 text-sm"
                  value={reportStart}
                  onChange={(e) => {
                    setReportStart(e.target.value);
                    setActivityPage(1);
                  }}
                />
              </div>
            </div>
            <div className="card p-4 border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('toDate')}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  className="input pl-10 h-10 py-0 text-sm"
                  value={reportEnd}
                  onChange={(e) => {
                    setReportEnd(e.target.value);
                    setActivityPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-slate-100 dark:border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input pl-10 w-full"
                placeholder={t('search') || 'Search activities...'}
                value={activitySearch}
                onChange={(e) => {
                  setActivitySearch(e.target.value);
                  setActivityPage(1);
                }}
              />
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] overflow-hidden border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                {t('activities') || 'User Activities'}
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {filteredActivities.length} {t('total') || 'total'}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {paginatedActivities.map((log) => (
                <div key={log.id} className="p-6 hover:bg-slate-50 dark:hover:bg-black/40 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-black flex items-center justify-center text-zinc-500">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{log.userName}</p>
                        <p className="text-xs text-zinc-500 font-medium shrink-0">
                          {log.timestamp ? format(new Date(log.timestamp), 'MMM dd, HH:mm', { locale: dateLocale }) : t('notAvailableShort')}
                        </p>
                      </div>
                      <p className="text-sm text-zinc-400 break-words">
                        <span className="font-bold text-amber-500">{log.action}</span>: {log.details}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredActivities.length === 0 && activities.length > 0 && (
                <div className="p-12 text-center">
                  <Activity className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-500 font-medium">{t('searchNoResults') || 'No matching activities'}</p>
                </div>
              )}
              {activities.length === 0 && (
                <div className="p-12 text-center">
                  <Activity className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-500 font-medium">{t('noActivities') || 'No activity logs found'}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('showing') || 'Showing'}{' '}
                <span className="text-slate-900 dark:text-white">
                  {filteredActivities.length === 0 ? 0 : (safeActivityPage - 1) * ACTIVITIES_PAGE_SIZE + 1}
                </span>{' '}
                {t('rangeTo')}{' '}
                <span className="text-slate-900 dark:text-white">
                  {Math.min(safeActivityPage * ACTIVITIES_PAGE_SIZE, filteredActivities.length)}
                </span>{' '}
                {t('of') || 'of'}{' '}
                <span className="text-slate-900 dark:text-white">{filteredActivities.length}</span>{' '}
                {t('results') || 'results'}
              </p>
              <Pagination
                currentPage={safeActivityPage}
                totalPages={activityTotalPages}
                onPageChange={setActivityPage}
                variant="footer"
              />
            </div>
          </div>
        </div>
      )}
      {activeTab === 'expenses' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-white/[0.02] p-4 rounded-3xl border border-slate-100 dark:border-white/5">
            <div className="flex flex-wrap gap-3">
              <select
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm font-bold rounded-xl px-4 py-2 focus:ring-amber-500"
                value={expenseSupplierId}
                onChange={(e) => { setExpenseSupplierId(e.target.value); setExpensePage(1); }}
              >
                <option value="all">{t('allSuppliers')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm font-bold rounded-xl px-4 py-2 focus:ring-amber-500"
                value={expenseGroupBy}
                onChange={(e) => { setExpenseGroupBy(e.target.value as any); setExpensePage(1); }}
              >
                <option value="list">{t('reportGroupByList')}</option>
                <option value="supplier">{t('reportGroupBySupplier')}</option>
                <option value="day">{t('day')}</option>
                <option value="month">{t('month')}</option>
                <option value="year">{t('year')}</option>
              </select>
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                <Calendar className="w-4 h-4 text-amber-500" />
                <input
                  type="date"
                  className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-900 dark:text-white"
                  value={expenseStart}
                  onChange={(e) => setExpenseStart(e.target.value)}
                />
                <span className="text-slate-400 dark:text-zinc-500">-</span>
                <input
                  type="date"
                  className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-900 dark:text-white"
                  value={expenseEnd}
                  onChange={(e) => setExpenseEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('supplierExpenses')}</p>
              <h3 className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{expenseTotal.toLocaleString()} {currencyUnit}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <Banknote className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('invoiceCount')}</p>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{expensePurchasesInRange.length}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8">{t('supplierExpenses')}</h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg)',
                      borderRadius: '16px',
                      border: '1px solid var(--tooltip-border)',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      color: 'var(--tooltip-text)'
                    }}
                    itemStyle={{ color: '#d97706', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="total" fill="#d97706" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden">
            {expenseGroupBy === 'list' && (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase">
                    <tr>
                      <th className="px-6 py-4 text-start">{t('fromDate')}</th>
                      <th className="px-6 py-4 text-start">{t('supplier')}</th>
                      <th className="px-6 py-4 text-start">{t('invoiceNumber')}</th>
                      <th className="px-6 py-4 text-end">{t('amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExpenseList.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 dark:border-white/5">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{format(new Date(p.date), 'PP', { locale: dateLocale })}</td>
                        <td className="px-6 py-4">{p.supplierName || suppliers.find((s) => s.id === p.supplierId)?.name || '—'}</td>
                        <td className="px-6 py-4 font-mono text-xs">{p.invoiceNumber}</td>
                        <td className="px-6 py-4 text-end font-bold">{p.totalAmount.toLocaleString()} {currencyUnit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {expenseListRows.length === 0 && (
                  <div className="p-12 text-center text-slate-500 dark:text-zinc-500 font-medium">{t('reportExportEmpty')}</div>
                )}
                <div className="p-6 border-t border-slate-100 dark:border-white/5 flex justify-end">
                  <Pagination currentPage={safeExpensePage} totalPages={expenseListTotalPages} onPageChange={setExpensePage} variant="footer" />
                </div>
              </>
            )}
            {expenseGroupBy === 'supplier' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase">
                  <tr>
                    <th className="px-6 py-4 text-start">{t('supplier')}</th>
                    <th className="px-6 py-4 text-end">{t('invoiceCount')}</th>
                    <th className="px-6 py-4 text-end">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseSupplierRows.map((r) => (
                    <tr key={r.supplierId} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{r.supplierName}</td>
                      <td className="px-6 py-4 text-end">{r.count}</td>
                      <td className="px-6 py-4 text-end font-bold">{r.total.toLocaleString()} {currencyUnit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(expenseGroupBy === 'day' || expenseGroupBy === 'month' || expenseGroupBy === 'year') && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase">
                  <tr>
                    <th className="px-6 py-4 text-start">{t('period')}</th>
                    <th className="px-6 py-4 text-end">{t('invoiceCount')}</th>
                    <th className="px-6 py-4 text-end">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseBucketRows.map((r) => (
                    <tr key={r.periodLabel} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{r.periodLabel}</td>
                      <td className="px-6 py-4 text-end">{r.count}</td>
                      <td className="px-6 py-4 text-end font-bold">{r.total.toLocaleString()} {currencyUnit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>

    {selectedSaleForReceipt && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
          <ReceiptPreview
            receiptNumber={`${new Date(selectedSaleForReceipt.createdAt).toISOString().split('T')[0].replace(/-/g, '')}-001`}
            storeName="Boulangerie Bella-Dolce"
            storeAddress="SIDI-ABDELLAH ALGER"
            items={parseSaleItems(selectedSaleForReceipt).map(i => ({
              name: i.name || i.productId,
              quantity: i.quantity,
              unitPrice: i.price,
              lineTotal: i.quantity * i.price,
            }))}
            totalAmount={selectedSaleForReceipt.totalAmount}
            paymentMethod={selectedSaleForReceipt.paymentMethod === 'card' ? 'card' : 'cash'}
            cashierName={selectedSaleForReceipt.cashierName || ''}
            dateTime={new Date(selectedSaleForReceipt.createdAt)}
            saleId={selectedSaleForReceipt.id}
            onClose={() => setSelectedSaleForReceipt(null)}
            autoCloseDelay={5000}
          />
        </div>
      </div>
    )}
    </>
  );
};

export default Reports;
