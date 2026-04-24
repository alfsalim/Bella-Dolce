import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  TrendingUp, 
  Package, 
  ChefHat, 
  AlertTriangle, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  ShoppingCart
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
  Area
} from 'recharts';
import { db, collection, onSnapshot, query, orderBy, limit, where, handleFirestoreError, OperationType } from '../lib/firebase';
import { ProductionBatch, Sale, Product, RawMaterial, Order } from '../types';
import { CURRENCY } from '../constants';
import { clsx } from 'clsx';

const Dashboard: React.FC = () => {
  const { t, isRTL, tProduct, tCategory } = useLanguage();
  const { profile } = useAuth();
  
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayActivity, setTodayActivity] = useState<number>(0);

  useEffect(() => {
    if (!profile) return;

    const unsubscribes: (() => void)[] = [];

    // Today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Activity logs for "Access" stat
    if (['admin', 'manager'].includes(profile.role)) {
      const qLogs = query(
        collection(db, 'activityLogs'),
        where('timestamp', '>=', today.toISOString())
      );
      const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
        // Count unique users who had activity today
        const uniqueUsers = new Set(snapshot.docs.map(doc => doc.data().userId));
        setTodayActivity(uniqueUsers.size);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'activityLogs'));
      unsubscribes.push(unsubscribeLogs);
    }

    // Only subscribe to batches if staff or admin/manager
    if (['admin', 'manager', 'baker', 'cashier'].includes(profile.role)) {
      const qBatches = query(collection(db, 'batches'), orderBy('startDate', 'desc'));
      const unsubscribeBatches = onSnapshot(qBatches, (snapshot) => {
        setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionBatch)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'batches'));
      unsubscribes.push(unsubscribeBatches);
    }

    // Only subscribe to sales if staff or admin/manager
    if (['admin', 'manager', 'cashier'].includes(profile.role)) {
      const qSales = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
      const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'sales'));
      unsubscribes.push(unsubscribeSales);
    }

    // Products are usually public or available to all authenticated users
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));
    unsubscribes.push(unsubscribeProducts);

    // Raw materials for staff/admin
    if (['admin', 'manager', 'baker', 'inventory'].includes(profile.role)) {
      const unsubscribeMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
        setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'rawMaterials'));
      unsubscribes.push(unsubscribeMaterials);
    }

    // Orders subscription with role-based query
    let oq: any = collection(db, 'orders');
    if (profile.role === 'customer_business' || profile.role === 'customer_customers') {
      oq = query(collection(db, 'orders'), where('customerId', '==', profile.id));
    } else if (profile.role === 'delivery_guy') {
      oq = query(collection(db, 'orders'), where('deliveryId', '==', profile.id));
    }

    const unsubscribeOrders = onSnapshot(oq, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));
    unsubscribes.push(unsubscribeOrders);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [profile]);

  // Role-based filtering
  const filteredSales = sales.filter(sale => {
    if (profile?.role === 'admin' || profile?.role === 'manager') return true;
    if (profile?.role === 'cashier') return sale.cashierId === profile.id || sale.cashierId === 'system';
    return false;
  });

  const filteredBatches = batches.filter(batch => {
    if (profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'baker') return true;
    return false;
  });

  const filteredOrders = orders.filter(order => {
    if (profile?.role === 'admin' || profile?.role === 'manager') return true;
    if (profile?.role === 'delivery_guy') return order.deliveryId === profile.id;
    if (profile?.role === 'customer_business' || profile?.role === 'customer_customers') return order.customerId === profile.id;
    return false;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySales = filteredSales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    return saleDate >= today;
  });

  const todaySalesAmount = todaySales.reduce((acc, sale) => acc + sale.totalAmount, 0);

  const todayBatches = filteredBatches.filter(batch => {
    const batchDate = new Date(batch.startDate);
    return batchDate >= today;
  });

  const todayConsumption = todayBatches.reduce((acc, batch) => {
    return acc + (batch.ingredients?.reduce((sum, ing) => sum + ing.quantity, 0) || 0);
  }, 0);

  const stats = [
    { 
      label: t('todaySales'), 
      value: `${todaySalesAmount.toLocaleString()} ${CURRENCY}`, 
      change: todaySales.length > 0 ? `+${todaySales.length} ${t('orders')}` : t('noSalesYet'), 
      icon: TrendingUp, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      visible: ['admin', 'manager', 'cashier'].includes(profile?.role || '')
    },
    { 
      label: t('todayConsumption'), 
      value: `${todayConsumption.toLocaleString()} ${t('units')}`, 
      change: `${todayBatches.length} ${t('batches')}`, 
      icon: ChefHat, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      visible: ['admin', 'manager', 'baker'].includes(profile?.role || '')
    },
    { 
      label: t('todayAccess'), 
      value: todayActivity.toString(), 
      change: t('activeUsers'), 
      icon: CheckCircle2, 
      color: 'text-primary-600', 
      bg: 'bg-primary-50',
      visible: ['admin', 'manager'].includes(profile?.role || '')
    },
    { 
      label: t('stockAlerts'), 
      value: products.filter(p => p.stock < p.minStock).length.toString(), 
      change: t('lowStock'), 
      icon: Package, 
      color: 'text-red-600', 
      bg: 'bg-red-50',
      visible: ['admin', 'manager', 'baker', 'inventory'].includes(profile?.role || '')
    },
  ].filter(s => s.visible);

  // Real chart data from sales
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
    const daySales = filteredSales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate.toDateString() === date.toDateString();
    });
    return {
      name: dayName,
      sales: daySales.reduce((acc, s) => acc + s.totalAmount, 0)
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('dashboard')}</h1>
          <p className="text-zinc-500 font-medium">{t('welcome')}, {profile?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 group hover:border-amber-500/30 transition-all duration-300 shadow-sm dark:shadow-none">
            <div className="flex items-start justify-between mb-4">
              <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 border border-slate-100 dark:border-white/5", stat.bg, stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={clsx(
                "px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1",
                stat.change.startsWith('+') ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              )}>
                {stat.change.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : null}
                {stat.change}
              </div>
            </div>
            <h3 className="text-zinc-500 text-sm font-semibold uppercase tracking-wider mb-1">{stat.label}</h3>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('salesTrends')}</h2>
            <select className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold px-4 py-2 focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white appearance-none">
              <option>{t('last7Days')}</option>
              <option>{t('last30Days')}</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7Days}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-white/10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{backgroundColor: 'var(--tooltip-bg, #09090b)', borderRadius: '16px', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)'}}
                  itemStyle={{color: '#d97706', fontWeight: 'bold'}}
                />
                <Area type="monotone" dataKey="sales" stroke="#d97706" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('activeBatches')}</h2>
          <div className="space-y-4">
            {filteredBatches.length > 0 ? filteredBatches.slice(0, 5).map((batch) => (
              <div key={batch.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 hover:border-amber-500/20 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                    {tProduct(products.find(p => p.id === batch.productId)?.name || 'Product')}
                  </span>
                  <div className={clsx(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                    batch.status === 'in-progress' ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-400"
                  )}>
                    {t(batch.status)}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-zinc-500 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{batch.plannedQty} {t('units')}</span>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <ChefHat className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                <p className="text-zinc-500 font-medium">{t('noActiveBatches')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('recentOrders')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-zinc-600 text-xs font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                  <th className="pb-4">{t('name')}</th>
                  <th className="pb-4">{t('total')}</th>
                  <th className="pb-4">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredSales.slice(0, 10).map((sale) => (
                  <tr key={sale.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 border border-slate-100 dark:border-white/5">
                          #{sale.id.slice(-4)}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-zinc-300 text-sm">{t('sale')} {sale.id.slice(-4)}</span>
                      </div>
                    </td>
                    <td className="py-4 font-bold text-slate-900 dark:text-white text-sm">{sale.totalAmount.toLocaleString()} {CURRENCY}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('paid')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('stockStatus')}</h2>
          <div className="space-y-4">
            {products.filter(p => p.stock < p.minStock).map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-red-400 border border-slate-100 dark:border-white/5 shadow-sm">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tProduct(product.name)}</h4>
                    <p className="text-xs text-red-400 font-semibold">{product.stock} {t('units')} {t('left')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-1">{t('minStock')}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-zinc-300">{product.minStock}</p>
                </div>
              </div>
            ))}
            {products.filter(p => p.stock < p.minStock).length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-900/30 mx-auto mb-3" />
                <p className="text-zinc-500 font-medium">{t('stockHealthy')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
