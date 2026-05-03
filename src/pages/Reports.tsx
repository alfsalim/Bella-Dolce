import React, { useState, useEffect } from 'react';
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
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
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
  Activity
} from 'lucide-react';
import { authFetch } from '../lib/api-client';
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
  isBefore,
  isWithinInterval,
  subDays 
} from 'date-fns';
import { db, collection, onSnapshot, query, orderBy, limit } from '../lib/firebase-compat';
import { Sale, Product, Order, RawMaterial, UserProfile, SaleItem, ActivityLog } from '../types';
import { clsx } from 'clsx';
import { CURRENCY, PAGE_SIZE } from '../constants';
import Pagination from '../components/Pagination';

const Reports: React.FC = () => {
  const { t, isRTL, tProduct, tCategory } = useLanguage();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'sales' | 'activities'>('analytics');

  const [sales, setSales] = useState<Sale[]>([]);
  const [cashiers, setCashiers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [chartMode, setChartMode] = useState<'revenue' | 'orders'>('revenue');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

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
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(now, 'yyyy-MM-dd'));
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
        const res = await authFetch('/api/sales', {
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
    
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubscribeMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)));
    });

    const unsubscribeActivities = onSnapshot(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(500)), (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeMaterials();
      unsubscribeActivities();
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

  const filteredSales = filteredSalesByRole.filter(s => {
    const date = new Date(s.createdAt);
    return isWithinInterval(date, {
      start: startOfDay(new Date(startDate)),
      end: new Date(endDate + 'T23:59:59')
    });
  });

  const filteredOrders = filteredOrdersByRole.filter(o => {
    const date = new Date(o.createdAt);
    return isWithinInterval(date, {
      start: startOfDay(new Date(startDate)),
      end: new Date(endDate + 'T23:59:59')
    });
  });

  const [selectedCashier, setSelectedCashier] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const totalSalesCount = filteredSales.length;
  const totalAmount = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPages = Math.ceil(totalSalesCount / PAGE_SIZE) || 1;
  const safeSalesPage = Math.min(currentPage, totalPages);
  const paginatedSales = filteredSales.slice(
    (safeSalesPage - 1) * PAGE_SIZE,
    safeSalesPage * PAGE_SIZE
  );

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      default: return null;
    }
  };

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalSalesCountAll = filteredSales.length; // renamed to disambiguate
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

  // Profit and Costs (Simplified calculation)
  const totalCosts = products.reduce((sum, p) => sum + (p.costPrice || 0) * (p.stock || 0), 0);
  const totalProfit = totalRevenue - totalCosts;

  // Inventory Consumption (Simplified)
  const inventoryConsumption = materials.map(m => ({
    material: m,
    consumption: Math.max(0, m.minStock * 2 - m.currentStock),
    stock: m.currentStock
  })).sort((a, b) => b.consumption - a.consumption).slice(0, 5);

  // Top Sellers based on actual sales
  const topSellers = products.map(p => {
    const unitsSold = filteredSales.reduce((sum, s) => {
      const saleItems: SaleItem[] = Array.isArray(s.items) ? s.items : JSON.parse((s.items as any) || '[]');
      const item = saleItems.find(i => i.productId === p.id);
      return sum + (item ? item.quantity : 0);
    }, 0);
    return { ...p, unitsSold };
  }).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);

  const [isCumulative, setIsCumulative] = useState(false);

  const getChartData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    let current = new Date(start);
    
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    let cumulativeRevenue = 0;
    let cumulativeOrders = 0;

    return days.map(date => {
      const daySales = filteredSales.filter(s => startOfDay(new Date(s.createdAt)).getTime() === startOfDay(date).getTime());
      const dayOrders = filteredOrders.filter(o => startOfDay(new Date(o.createdAt)).getTime() === startOfDay(date).getTime());
      
      const revenue = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
      const ordersCount = dayOrders.length;

      cumulativeRevenue += revenue;
      cumulativeOrders += ordersCount;

      return {
        name: format(date, 'MMM dd'),
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('reports')}</h1>
          <p className="text-slate-500 dark:text-zinc-500 font-medium">{t('reportsDesc')}</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
          <button 
            onClick={() => setActiveTab('analytics')}
            className={clsx(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'analytics' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t('analytics') || 'Analytics'}
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={clsx(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'sales' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t('salesReport') || 'Sales Log'}
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={clsx(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'activities' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t('activities') || 'Activities'}
          </button>
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-slate-400 dark:text-zinc-500">-</span>
                <input 
                  type="date" 
                  className="bg-transparent border-none text-sm font-bold focus:ring-0 text-slate-900 dark:text-white" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <button className="px-6 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              {t('exportPDF')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('totalRevenue')}</p>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{totalRevenue.toLocaleString()} {CURRENCY}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('profit')}</p>
              <h3 className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">{totalProfit.toLocaleString()} {CURRENCY}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('costs')}</p>
              <h3 className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{totalCosts.toLocaleString()} {CURRENCY}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('avgOrderValue')}</p>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{avgOrderValue.toLocaleString()} {CURRENCY}</h3>
            </div>
          </div>


      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-amber-600 rounded-full"></div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">{t('orderReport')}</h2>
        </div>
        
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
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{totalFulfilledToday.toLocaleString()} {CURRENCY}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
              <p className="text-slate-500 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">{t('weekly')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{fulfilledThisWeek.length}</h3>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{totalFulfilledThisWeek.toLocaleString()} {CURRENCY}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
              <p className="text-slate-500 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">{t('monthly')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{fulfilledThisMonth.length}</h3>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{totalFulfilledThisMonth.toLocaleString()} {CURRENCY}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('cashier') || 'Cashier'}</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select 
                  className="input pl-10 h-10 py-0 text-sm"
                  value={selectedCashier}
                  onChange={(e) => {
                    setSelectedCashier(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">{t('allCashiers') || 'All Cashiers'}</option>
                  {cashiers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card p-4 border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('fromDate') || 'From Date'}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="date" 
                  className="input pl-10 h-10 py-0 text-sm" 
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
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
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            <div className="card p-4 bg-primary-600 border-none flex flex-col justify-center">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">{t('totalPeriodSales') || 'Total Period Sales'}</p>
              <h3 className="text-2xl font-display font-bold text-white">{totalAmount.toLocaleString()} {CURRENCY}</h3>
            </div>
          </div>

          {totalSalesCount >= 500 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex items-center gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">
                {t('maxDataReached') || 'Max data limit reached (500 records). Please narrow your date range to see more specific results.'}
              </p>
            </div>
          )}

          <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('transactions') || 'Transactions'}</h2>
              <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full text-xs font-bold uppercase tracking-wider">
                {totalSalesCount} {t('records') || 'Records'}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic">
                        {t('loading') || 'Loading transactions...'}
                      </td>
                    </tr>
                  ) : paginatedSales.length > 0 ? (
                    paginatedSales.map((sale) => {
                      const items = Array.isArray(sale.items) ? sale.items : JSON.parse((sale.items as any) || '[]');
                      return (
                        <tr key={sale.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
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
                            <div className={clsx(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              sale.paymentMethod === 'cash' ? "bg-emerald-100 text-emerald-600" :
                              sale.paymentMethod === 'card' ? "bg-blue-100 text-blue-600" :
                              "bg-purple-100 text-purple-600"
                            )}>
                              {getPaymentIcon(sale.paymentMethod)}
                              {sale.paymentMethod}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col gap-1">
                              {items.map((item: any, idx: number) => (
                                <span key={idx} className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  {item.quantity}x {tProduct(item.name || item.productId)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right font-display font-bold text-lg text-slate-900 dark:text-white">
                            {sale.totalAmount.toLocaleString()} {CURRENCY}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic">
                        {t('noSalesFound') || 'No sales found for the selected criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('showing') || 'Showing'} <span className="text-slate-900 dark:text-white">{totalSalesCount === 0 ? 0 : (safeSalesPage - 1) * PAGE_SIZE + 1}</span> to <span className="text-slate-900 dark:text-white">{Math.min(safeSalesPage * PAGE_SIZE, totalSalesCount)}</span> {t('of') || 'of'} <span className="text-slate-900 dark:text-white">{totalSalesCount}</span> {t('results') || 'results'}
              </p>
              <Pagination
                currentPage={safeSalesPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>
      )}
      {activeTab === 'activities' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-slate-100 dark:border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input pl-10 w-full"
                placeholder={t('search') || 'Search activities...'}
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
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
                {activities.filter(a =>
                  !activitySearch ||
                  a.userName?.toLowerCase().includes(activitySearch.toLowerCase()) ||
                  a.action?.toLowerCase().includes(activitySearch.toLowerCase()) ||
                  a.details?.toLowerCase().includes(activitySearch.toLowerCase())
                ).length} {t('total') || 'total'}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[600px] overflow-y-auto">
              {activities
                .filter(a =>
                  !activitySearch ||
                  a.userName?.toLowerCase().includes(activitySearch.toLowerCase()) ||
                  a.action?.toLowerCase().includes(activitySearch.toLowerCase()) ||
                  a.details?.toLowerCase().includes(activitySearch.toLowerCase())
                )
                .map((log) => (
                <div key={log.id} className="p-6 hover:bg-slate-50 dark:hover:bg-black/40 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-black flex items-center justify-center text-zinc-500">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-slate-900 dark:text-white">{log.userName}</p>
                        <p className="text-xs text-zinc-500 font-medium">
                          {log.timestamp ? format(new Date(log.timestamp), 'MMM dd, HH:mm') : 'N/A'}
                        </p>
                      </div>
                      <p className="text-sm text-zinc-400">
                        <span className="font-bold text-amber-500">{log.action}</span>: {log.details}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="p-12 text-center">
                  <Activity className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-500 font-medium">{t('noActivities') || 'No activity logs found'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
