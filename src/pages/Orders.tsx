import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  MoreVertical,
  Calendar,
  DollarSign,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Package,
  FileText,
  Printer,
  Download,
  X
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, updateDoc, doc, limit, where, handleFirestoreError, OperationType, getDoc, getCountFromServer } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { Order, Product } from '../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CURRENCY } from '../constants';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';

const Orders: React.FC = () => {
  const { t, isRTL, tProduct } = useLanguage();
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    return (localStorage.getItem('ordersViewMode') as 'card' | 'list') || 'card';
  });
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('ordersViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!profile) return;

    const fetchTotalCount = async () => {
      let q = query(collection(db, 'orders'));
      if (profile.role === 'customer_business' || profile.role === 'customer_customers') {
        q = query(collection(db, 'orders'), where('customerId', '==', profile.id));
      } else if (profile.role === 'delivery_guy') {
        q = query(collection(db, 'orders'), where('deliveryId', '==', profile.id));
      }
      
      // Apply status filter to count if it's not 'all'
      if (statusFilter !== 'all') {
        q = query(q, where('status', '==', statusFilter));
      }
      
      // Apply user filter to count if it's not 'All'
      if (userFilter !== 'All') {
        q = query(q, where('createdBy', '==', userFilter));
      }

      const snapshot = await getCountFromServer(q);
      setTotalPages(Math.ceil(snapshot.data().count / pageSize));
    };

    fetchTotalCount();

    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(pageSize * currentPage));
    
    // If customer, only show their orders
    if (profile.role === 'customer_business' || profile.role === 'customer_customers') {
      q = query(collection(db, 'orders'), where('customerId', '==', profile.id), orderBy('createdAt', 'desc'), limit(pageSize * currentPage));
    } else if (profile.role === 'delivery_guy') {
      q = query(collection(db, 'orders'), where('deliveryId', '==', profile.id), orderBy('createdAt', 'desc'), limit(pageSize * currentPage));
    }

    // Apply status filter to query
    if (statusFilter !== 'all') {
      q = query(q, where('status', '==', statusFilter));
    }
    
    // Apply user filter to query
    if (userFilter !== 'All') {
      q = query(q, where('createdBy', '==', userFilter));
    }

    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Slice for current page to simulate server-side pagination with onSnapshot
      const startIndex = (currentPage - 1) * pageSize;
      const paginatedOrders = allOrders.slice(startIndex, startIndex + pageSize);
      setOrders(paginatedOrders);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [currentPage, pageSize, profile, statusFilter, userFilter]);

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', id);
      const order = orders.find(o => o.id === id);
      if (!order) return;

      // Handle stock return if cancelled
      if (status === 'cancelled' && order.status !== 'cancelled') {
        for (const item of order.items) {
          try {
            const productRef = doc(db, 'products', item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const currentStock = productSnap.data().stock || 0;
              await updateDoc(productRef, {
                stock: currentStock + item.quantity
              });
            }
          } catch (err) {
            console.error(`Error returning stock for product ${item.productId}:`, err);
          }
        }
      }

      await updateDoc(orderRef, { 
        status,
        updatedAt: new Date().toISOString()
      });
      
      if (profile) {
        logActivity(profile.id, profile.name, 'Order', `Order ${id} status updated to ${status}`);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const updateDeliveryStatus = async (id: string, deliveryStatus: Order['deliveryStatus']) => {
    try {
      await updateDoc(doc(db, 'orders', id), { 
        deliveryStatus,
        updatedAt: new Date().toISOString()
      });
      if (profile) {
        logActivity(profile.id, profile.name, 'Order', `Order ${id} delivery status updated to ${deliveryStatus}`);
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'ordered': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
      case 'in-progress': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
      case 'delayed': return 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400';
      case 'delivered': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'cancelled': return 'bg-slate-100 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400';
    }
  };

  const uniqueCreators = Array.from(new Set(orders.map(o => o.createdBy).filter(Boolean)));

  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.clientName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (order.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setUserFilter('All');
  };

  const handlePrintInvoice = () => {
    toast.success(t('openingPrintDialog') || 'Opening print dialog...');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPDF = async () => {
    const printContent = document.getElementById('invoice-content');
    if (!printContent || !selectedOrderForInvoice) return;

    const toastId = toast.loading(t('generatingPDF') || 'Generating PDF...');

    try {
      // Create a clone to avoid flickering in the UI
      const clone = printContent.cloneNode(true) as HTMLElement;
      clone.style.width = '800px'; // Fixed width for consistent PDF layout
      clone.style.position = 'absolute';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.backgroundColor = 'white';
      clone.style.color = 'black';
      clone.classList.add('print-content-clone');
      
      // Ensure all text is black for PDF
      const allText = clone.querySelectorAll('*');
      allText.forEach((el) => {
        if (el instanceof HTMLElement) {
          if (!el.classList.contains('text-primary-600')) {
            el.style.color = 'black';
          }
        }
      });

      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`invoice-${selectedOrderForInvoice.id.slice(-8).toUpperCase()}.pdf`);
      
      toast.success(t('pdfDownloaded') || 'PDF downloaded successfully', { id: toastId });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(t('pdfError') || 'Failed to generate PDF', { id: toastId });
    }
  };

  return (
    <div className="space-y-8">
      {/* Invoice Modal */}
      {isInvoiceModalOpen && selectedOrderForInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print-visible">
          <div className="bg-white dark:bg-[#1a1512] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-100 dark:border-[#2a1e17] print:shadow-none print:border-none print:max-h-none print:static print:w-full print:bg-white print:text-black">
            <div className="p-8 border-b border-slate-100 dark:border-[#2a1e17] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1a1512] z-10 print-hidden">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary-600" />
                {t('invoice')}
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrintInvoice}
                  className="btn-secondary gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {t('print')}
                </button>
                <button 
                  onClick={handleDownloadPDF}
                  className="btn-primary gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t('downloadPDF') || 'PDF'}
                </button>
                <button 
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-8 print:p-0 print:text-black" id="invoice-content">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <h1 className="text-4xl font-display font-bold text-primary-600 mb-2 print:text-primary-600">INVOICE</h1>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs print:text-slate-500">#{selectedOrderForInvoice.id.slice(-8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 print:text-black">Bella Dolce</h2>
                  <p className="text-slate-500 text-sm print:text-slate-500">123 Bakery Street</p>
                  <p className="text-slate-500 text-sm print:text-slate-500">City, Country</p>
                  <p className="text-slate-500 text-sm print:text-slate-500">Phone: +123 456 789</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-12 mb-12">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 print:text-slate-400">Bill To</h3>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mb-1 print:text-black">{selectedOrderForInvoice.clientName || 'Walk-in Customer'}</p>
                  {selectedOrderForInvoice.customerId && (
                    <p className="text-slate-500 text-sm print:text-slate-500">Customer ID: {selectedOrderForInvoice.customerId}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="space-y-2">
                    <div className="flex justify-end gap-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">Date</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">{format(new Date(selectedOrderForInvoice.createdAt), 'PPP')}</span>
                    </div>
                    <div className="flex justify-end gap-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">Status</span>
                      <span className="text-sm font-bold text-primary-600 uppercase print:text-primary-600">{t(selectedOrderForInvoice.status)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <table className="w-full mb-12">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-[#2a1e17] print:border-slate-100">
                    <th className="py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">Item</th>
                    <th className="py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">Qty</th>
                    <th className="py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">Price</th>
                    <th className="py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2a1e17] print:divide-slate-100">
                  {selectedOrderForInvoice.items.map((item, idx) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <tr key={idx}>
                        <td className="py-4">
                          <p className="font-bold text-slate-900 dark:text-white print:text-black">{tProduct(product?.name || 'Unknown')}</p>
                        </td>
                        <td className="py-4 text-center font-bold text-slate-700 dark:text-slate-300 print:text-slate-700">x{item.quantity}</td>
                        <td className="py-4 text-right font-bold text-slate-700 dark:text-slate-300 print:text-slate-700">{item.price.toLocaleString()} {CURRENCY}</td>
                        <td className="py-4 text-right font-bold text-slate-900 dark:text-white print:text-black">{(item.quantity * item.price).toLocaleString()} {CURRENCY}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-4">
                  <div className="flex justify-between items-center text-slate-500 print:text-slate-500">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Subtotal</span>
                    <span className="font-bold">{selectedOrderForInvoice.totalAmount.toLocaleString()} {CURRENCY}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 print:text-slate-500">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Tax (0%)</span>
                    <span className="font-bold">0 {CURRENCY}</span>
                  </div>
                  <div className="pt-4 border-t-2 border-slate-100 dark:border-[#2a1e17] flex justify-between items-center print:border-slate-100">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest print:text-black">Total Amount</span>
                    <span className="text-2xl font-display font-bold text-primary-600 print:text-primary-600">{selectedOrderForInvoice.totalAmount.toLocaleString()} {CURRENCY}</span>
                  </div>
                </div>
              </div>

              <div className="mt-24 pt-12 border-t border-slate-100 dark:border-[#2a1e17] text-center print:border-slate-100">
                <p className="text-slate-400 text-sm italic print:text-slate-400">Thank you for your business!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="print:hidden space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('orders')}</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('manageOrdersDesc') || 'Manage client orders and delivery status'}</p>
          </div>
        </div>

      <div className="card flex flex-col sm:flex-row items-stretch sm:items-center gap-4 py-4 border-slate-100 dark:border-[#2a1e17]">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('search')} 
            className="input pl-12 bg-slate-50/50 dark:bg-[#1a1512]/50 border-none w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="input py-2 bg-slate-50/50 dark:bg-[#1a1512]/50 border-none text-sm font-bold min-w-[150px] dark:text-white"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          >
            <option value="All" className="dark:bg-black">{t('allUsers')}</option>
            {uniqueCreators.map(user => (
              <option key={user} value={user} className="dark:bg-black">{user}</option>
            ))}
          </select>
          <div className="flex bg-slate-100 dark:bg-[#1a1512] p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('card')}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === 'card' ? "bg-white dark:bg-black shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
              )}
              title={t('cardView')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white dark:bg-black shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
              )}
              title={t('listView')}
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
          <select 
            className="input py-2 bg-slate-50/50 dark:bg-[#1a1512]/50 border-none text-sm font-bold dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all" className="dark:bg-black">{t('allStatuses')}</option>
            <option value="ordered" className="dark:bg-black">{t('ordered')}</option>
            <option value="in-progress" className="dark:bg-black">{t('in-progress')}</option>
            <option value="delayed" className="dark:bg-black">{t('delayed')}</option>
            <option value="delivered" className="dark:bg-black">{t('delivered')}</option>
            <option value="cancelled" className="dark:bg-black">{t('cancelled')}</option>
          </select>
            <button 
              onClick={resetFilters}
              className="btn-secondary gap-2 justify-center"
            >
              <Filter className="w-4 h-4" />
              {t('reset')}
            </button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className="card group hover:shadow-xl transition-all duration-300 border-slate-100 dark:border-[#2a1e17] p-0 overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-1/3 p-6 bg-slate-50/50 dark:bg-[#1a1512]/50 border-r border-slate-100 dark:border-[#2a1e17]">
                    <div className="flex items-center justify-between mb-4">
                      <div className={clsx("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", getStatusColor(order.status))}>
                        {t(order.status)}
                      </div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-600">#{order.id.slice(-6).toUpperCase()}</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-primary-600 dark:text-primary-400">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('clientName')}</p>
                          <p className="font-bold text-slate-900 dark:text-white">{order.clientName || 'Walk-in Customer'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('deliveryType')}</p>
                          <p className="font-bold text-slate-900 dark:text-white">{t(order.deliveryType)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('expectedTime')}</p>
                          <p className="font-bold text-slate-900 dark:text-white">{order.expectedDate} at {order.expectedTime}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-slate-600 dark:text-slate-400">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('createdBy')}</p>
                          <p className="font-bold text-slate-900 dark:text-white">{order.createdBy || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{order.description || 'No description'}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{order.items.length} {t('items')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">{order.totalAmount.toLocaleString()} {CURRENCY}</p>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('totalAmount')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      {order.items.slice(0, 2).map((item, idx) => {
                        const product = products.find(p => p.id === item.productId);
                        return (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#1a1512] rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-white dark:bg-black overflow-hidden shrink-0">
                              <img 
                                src={product?.imageUrl || `https://picsum.photos/seed/${product?.name}/100/100`} 
                                alt="" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{tProduct(product?.name || 'Unknown')}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">x{item.quantity}</p>
                            </div>
                          </div>
                        );
                      })}
                      {order.items.length > 2 && (
                        <div className="flex items-center justify-center p-3 bg-slate-100 dark:bg-[#1a1512] rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400">
                          +{order.items.length - 2} {t('moreItems') || 'more items'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 flex gap-2">
                        <select 
                          className="flex-1 input text-sm"
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                        >
                          <option value="ordered">{t('ordered')}</option>
                          <option value="in-progress">{t('in-progress')}</option>
                          <option value="delayed">{t('delayed')}</option>
                          <option value="delivered">{t('delivered')}</option>
                          <option value="cancelled">{t('cancelled')}</option>
                        </select>
                        <select 
                          className="flex-1 input text-sm"
                          value={order.deliveryStatus || 'pending'}
                          onChange={(e) => updateDeliveryStatus(order.id, e.target.value as Order['deliveryStatus'])}
                        >
                          <option value="pending">{t('pending')}</option>
                          <option value="assigned">{t('assigned')}</option>
                          <option value="picked-up">{t('picked-up')}</option>
                          <option value="delivered">{t('delivered')}</option>
                        </select>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedOrderForInvoice(order);
                          setIsInvoiceModalOpen(true);
                        }}
                        className="btn-secondary gap-2"
                        title={t('issueInvoice') || 'Issue Invoice'}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('issueInvoice') || 'Issue Invoice'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden border-slate-100 dark:border-[#2a1e17]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-[#1a1512]/50 border-bottom border-slate-100 dark:border-[#2a1e17]">
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('id')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('clientName')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('status')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('totalAmount')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('expectedTime')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2a1e17]">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1512]/50 transition-colors">
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-600">#{order.id.slice(-6).toUpperCase()}</span>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white">{order.clientName || 'Walk-in Customer'}</p>
                    </td>
                    <td className="p-4">
                      <div className={clsx("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block", getStatusColor(order.status))}>
                        {t(order.status)}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-primary-600 dark:text-primary-400">{order.totalAmount.toLocaleString()} {CURRENCY}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-600 dark:text-slate-300">{order.expectedDate} {order.expectedTime}</p>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <select 
                          className="input text-xs py-1 h-auto"
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                        >
                          <option value="ordered">{t('ordered')}</option>
                          <option value="in-progress">{t('in-progress')}</option>
                          <option value="delayed">{t('delayed')}</option>
                          <option value="delivered">{t('delivered')}</option>
                          <option value="cancelled">{t('cancelled')}</option>
                        </select>
                        <button 
                          onClick={() => {
                            setSelectedOrderForInvoice(order);
                            setIsInvoiceModalOpen(true);
                          }}
                          className="p-2 text-slate-400 dark:text-slate-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          title={t('issueInvoice') || 'Issue Invoice'}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
  );
};

export default Orders;
