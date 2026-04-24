import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { db, collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, handleFirestoreError, OperationType, limit, getCountFromServer, where } from '../lib/firebase';
import { Order, Delivery, UserProfile } from '../types';
import { Truck, Search, MapPin, Clock, CheckCircle, User, MessageSquare, MoreVertical, Navigation, Package, Plus, LayoutGrid, LayoutList, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import Pagination from '../components/Pagination';

const DeliveryManagement: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(25);
  const [deliveryGuys, setDeliveryGuys] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'assigned' | 'delivered'>('pending');
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    return (localStorage.getItem('deliveryViewMode') as 'list' | 'card') || 'card';
  });

  useEffect(() => {
    localStorage.setItem('deliveryViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const fetchCounts = async () => {
      let q = query(collection(db, 'orders'));
      
      // Apply tab filter to count
      if (activeTab === 'pending') {
        q = query(q, where('status', 'in', ['pending', 'confirmed']));
      } else if (activeTab === 'assigned') {
        q = query(q, where('status', 'in', ['preparing', 'out-for-delivery']));
      } else if (activeTab === 'delivered') {
        q = query(q, where('status', '==', 'delivered'));
      }

      const snapshot = await getCountFromServer(q);
      setTotalPages(Math.ceil(snapshot.data().count / pageSize));
    };
    fetchCounts();

    let oq = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(pageSize * currentPage));
    
    // Apply tab filter to query
    if (activeTab === 'pending') {
      oq = query(oq, where('status', 'in', ['pending', 'confirmed']));
    } else if (activeTab === 'assigned') {
      oq = query(oq, where('status', 'in', ['preparing', 'out-for-delivery']));
    } else if (activeTab === 'delivered') {
      oq = query(oq, where('status', '==', 'delivered'));
    }

    const oUnsubscribe = onSnapshot(oq, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      const startIndex = (currentPage - 1) * pageSize;
      setOrders(allOrders.slice(startIndex, startIndex + pageSize));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    const dq = query(collection(db, 'deliveries'), orderBy('updatedAt', 'desc'));
    const dUnsubscribe = onSnapshot(dq, (snapshot) => {
      const allDeliveries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery));
      setDeliveries(allDeliveries);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'deliveries'));

    const uq = query(collection(db, 'users'), orderBy('name'));
    const uUnsubscribe = onSnapshot(uq, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setDeliveryGuys(allUsers.filter(u => u.role === 'delivery_guy' || u.role === 'admin'));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => {
      oUnsubscribe();
      dUnsubscribe();
      uUnsubscribe();
    };
  }, [currentPage, pageSize, activeTab]);

  const assignDelivery = async (orderId: string, deliveryGuyId: string) => {
    try {
      const deliveryRef = await addDoc(collection(db, 'deliveries'), {
        orderId,
        deliveryGuyId,
        status: 'assigned',
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'out-for-delivery',
        deliveryId: deliveryRef.id
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deliveries/orders');
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, orderId: string, status: Delivery['status']) => {
    try {
      await updateDoc(doc(db, 'deliveries', deliveryId), {
        status,
        updatedAt: new Date().toISOString()
      });
      if (status === 'delivered') {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'delivered'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'deliveries/orders');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setActiveTab('pending');
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('delivery')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('manageTeam')}</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
          <button 
            onClick={() => setViewMode('list')}
            className={clsx(
              "p-2 rounded-lg transition-all",
              viewMode === 'list' ? "bg-slate-900 dark:bg-primary-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
            title={t('listView')}
          >
            <LayoutList className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('card')}
            className={clsx(
              "p-2 rounded-lg transition-all",
              viewMode === 'card' ? "bg-slate-900 dark:bg-primary-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
            title={t('cardView')}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="card flex flex-col sm:flex-row items-stretch sm:items-center gap-4 py-4 border-slate-100 dark:border-white/10">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('searchOrders')} 
            className="input pl-12 bg-slate-50/50 dark:bg-zinc-900/50 border-none w-full dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('pending')}
              className={clsx(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'pending' 
                  ? "bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              {t('pending')}
            </button>
            <button 
              onClick={() => setActiveTab('assigned')}
              className={clsx(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'assigned' 
                  ? "bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              {t('inProgress')}
            </button>
            <button 
              onClick={() => setActiveTab('delivered')}
              className={clsx(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'delivered' 
                  ? "bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {t('delivered')}
            </button>
          </div>
          <button 
            onClick={resetFilters}
            className="btn-secondary gap-2 justify-center"
          >
            <Filter className="w-4 h-4" />
            {t('reset')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {viewMode === 'card' ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const delivery = deliveries.find(d => d.orderId === order.id);
                    const deliveryGuy = deliveryGuys.find(u => u.id === delivery?.deliveryGuyId);

                    return (
                      <div key={order.id} className="card border-slate-100 dark:border-white/10 hover:border-primary-200 dark:hover:border-primary-800 transition-all">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400">
                              <Package className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 dark:text-white">{t('order')} #{order.id.slice(-6)}</h3>
                                <span className={clsx(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                  order.deliveryType === 'business' ? "bg-slate-900 dark:bg-slate-800 text-white" : "bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                                )}>
                                  {order.deliveryType}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                {format(new Date(order.createdAt), 'MMM dd, HH:mm')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{order.totalAmount} DA</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{order.items.length} {t('items')}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="space-y-3">
                            <div className="flex items-start gap-2 text-sm">
                              <MapPin className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-0.5" />
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('deliveryAddress')}: {order.notes || 'N/A'}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                              <p className="text-slate-600 dark:text-slate-400">{t('customer')}: {order.customerId}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {delivery ? (
                              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('assignedTo')}</p>
                                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase">
                                    {t(delivery.status)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs">
                                    {deliveryGuy?.name?.charAt(0)}
                                  </div>
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">{deliveryGuy?.name || 'Unknown'}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('assignDeliveryGuy')}</label>
                                <select 
                                  className="input text-sm bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                  onChange={(e) => assignDelivery(order.id, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="" disabled>{t('selectDeliveryPersonnel')}</option>
                                  {deliveryGuys.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-zinc-900">
                          <div className="flex gap-2">
                            <button className="btn-ghost p-2 h-auto text-primary-600 dark:text-primary-400">
                              <MessageSquare className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => setTrackingOrder(order)}
                              className="btn-ghost p-2 h-auto text-primary-600 dark:text-primary-400"
                            >
                              <Navigation className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            {delivery && delivery.status !== 'delivered' && (
                              <button 
                                onClick={() => updateDeliveryStatus(delivery.id, order.id, 'delivered')}
                                className="btn-primary py-2 text-xs"
                              >
                                {t('markDelivered')}
                              </button>
                            )}
                            <button className="btn-secondary py-2 text-xs">
                              {t('orderDetails')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Pagination 
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            ) : (
              <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/10">
                        <th className="px-8 py-5 whitespace-nowrap">{t('order')}</th>
                        <th className="px-8 py-5 whitespace-nowrap">{t('customer')}</th>
                        <th className="px-8 py-5 whitespace-nowrap">{t('assignedTo')}</th>
                        <th className="px-8 py-5 whitespace-nowrap">{t('status')}</th>
                        <th className="px-8 py-5 text-right whitespace-nowrap">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                      {filteredOrders.map((order) => {
                        const delivery = deliveries.find(d => d.orderId === order.id);
                        const deliveryGuy = deliveryGuys.find(u => u.id === delivery?.deliveryGuyId);
                        return (
                          <tr key={order.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-all">
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white">#{order.id.slice(-6)}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{order.deliveryType}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{order.customerId}</span>
                            </td>
                            <td className="px-8 py-5">
                              {deliveryGuy ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-[10px]">
                                    {deliveryGuy.name.charAt(0)}
                                  </div>
                                  <span className="text-sm font-bold text-slate-900 dark:text-white">{deliveryGuy.name}</span>
                                </div>
                              ) : (
                                <select 
                                  className="input py-1 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                                  onChange={(e) => assignDelivery(order.id, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="" disabled>{t('assign')}</option>
                                  {deliveryGuys.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-8 py-5">
                              <span className={clsx(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                delivery 
                                  ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" 
                                  : "bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400"
                              )}>
                                {delivery ? t(delivery.status) : t('pending')}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setTrackingOrder(order)} className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all">
                                  <Navigation className="w-4 h-4" />
                                </button>
                                {delivery && delivery.status !== 'delivered' && (
                                  <button onClick={() => updateDeliveryStatus(delivery.id, order.id, 'delivered')} className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination 
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card border-slate-100 dark:border-white/10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              {t('deliveryStats')}
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{t('activeDeliveries')}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {deliveries.filter(d => d.status !== 'delivered').length}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{t('avgDeliveryTime')}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">42m</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{t('todayCompletions')}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {deliveries.filter(d => d.status === 'delivered').length}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-slate-900 dark:bg-zinc-900 text-white border-slate-100 dark:border-white/10">
            <h3 className="text-lg font-bold mb-4">{t('deliveryPersonnel')}</h3>
            <div className="space-y-4">
              {deliveryGuys.map(u => (
                <div key={u.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-zinc-800 flex items-center justify-center text-primary-400 font-bold text-xs">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{u.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('available')}</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {trackingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl border-slate-100 dark:border-white/10 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('trackOrder')} #{trackingOrder.id.slice(-6)}</h2>
              <button onClick={() => setTrackingOrder(null)} className="btn-ghost p-2 h-auto text-slate-400 dark:text-slate-500">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="flex-1 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-zinc-900">
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                style={{ border: 0 }}
                src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY'}&q=${encodeURIComponent(trackingOrder.notes || 'Algiers, Algeria')}`}
                allowFullScreen
              ></iframe>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setTrackingOrder(null)} className="btn-secondary">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryManagement;
