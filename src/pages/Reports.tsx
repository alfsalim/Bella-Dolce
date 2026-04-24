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
  XCircle
} from 'lucide-react';
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
import { db, collection, onSnapshot, query, orderBy, limit } from '../lib/firebase';
import { Sale, Product, Order, RawMaterial } from '../types';
import { clsx } from 'clsx';
import { CURRENCY } from '../constants';

const Reports: React.FC = () => {
  const { t, isRTL, tProduct, tCategory } = useLanguage();
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
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
    const unsubscribeSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubscribeMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)));
    });

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeMaterials();
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

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalSalesCount = filteredSales.length;
  const avgOrderValue = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

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
    name: m.name,
    consumption: Math.max(0, m.minStock * 2 - m.currentStock),
    stock: m.currentStock
  })).sort((a, b) => b.consumption - a.consumption).slice(0, 5);

  // Top Sellers based on actual sales
  const topSellers = products.map(p => {
    const unitsSold = filteredSales.reduce((sum, s) => {
      const item = s.items.find(i => i.productId === p.id);
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
          <button className="px-6 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            {t('exportPDF')}
          </button>
        </div>
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
                  <span className="text-slate-700 dark:text-zinc-300">{tProduct(item.name)}</span>
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
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{tProduct(product.name)}</h4>
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
  );
};

export default Reports;
