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
  X,
  Plus,
  Trash2,
  Wallet,
  Phone,
  Pencil
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, updateDoc, doc, limit, where, handleFirestoreError, OperationType, getDoc, getCountFromServer, addDoc, deleteDoc } from '../lib/db';
import { authFetch, getAuthHeaders, readApiErrorMessage } from '../lib/api-client';
import { toast } from 'react-hot-toast';
import { Order, Product } from '../types';
import { clsx } from 'clsx';
import { format, addDays } from 'date-fns';
import { downloadInvoicePdf } from '../lib/export';
import { PAGE_SIZE } from '../constants';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import DeliveryManagement from './DeliveryManagement';
import EditableSelect from '../components/EditableSelect';

interface SpecialOrderItemDraft {
  productId: string;
  quantity: number;
  price: number;
  expanded: boolean;
  specifications: {
    flavor?: string;
    glaze?: string;
    shape?: string;
    size?: string;
    addons?: string;
  };
}

const emptySpecialOrderItem = (): SpecialOrderItemDraft => ({
  productId: '',
  quantity: 1,
  price: 0,
  expanded: false,
  specifications: {},
});

const getDefaultExpectedDateTime = () => {
  const inTwoDays = addDays(new Date(), 2);
  return {
    expectedDate: format(inTwoDays, 'yyyy-MM-dd'),
    expectedTime: format(inTwoDays, 'HH:mm'),
  };
};

const Orders: React.FC = () => {
  const { t, isRTL, tProduct, currencyUnit } = useLanguage();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'tracking'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    return (localStorage.getItem('ordersViewMode') as 'card' | 'list') || 'card';
  });
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const [isSpecialOrderModalOpen, setIsSpecialOrderModalOpen] = useState(false);
  const [isSubmittingSpecialOrder, setIsSubmittingSpecialOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [specialOrderForm, setSpecialOrderForm] = useState({
    firstName: '',
    lastName: '',
    phone: '0',
    ...getDefaultExpectedDateTime(),
    notes: '',
    downpayment: '',
    items: [emptySpecialOrderItem()] as SpecialOrderItemDraft[],
  });
  const [closeBalanceInput, setCloseBalanceInput] = useState<Record<string, string>>({});
  const [closingOrderId, setClosingOrderId] = useState<string | null>(null);

  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

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
      setTotalPages(Math.ceil(snapshot.data().count / PAGE_SIZE));
    };

    fetchTotalCount();

    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE * currentPage));
    
    // If customer, only show their orders
    if (profile.role === 'customer_business' || profile.role === 'customer_customers') {
      q = query(collection(db, 'orders'), where('customerId', '==', profile.id), orderBy('createdAt', 'desc'), limit(PAGE_SIZE * currentPage));
    } else if (profile.role === 'delivery_guy') {
      q = query(collection(db, 'orders'), where('deliveryId', '==', profile.id), orderBy('createdAt', 'desc'), limit(PAGE_SIZE * currentPage));
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
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      const paginatedOrders = allOrders.slice(startIndex, startIndex + PAGE_SIZE);
      setOrders(paginatedOrders);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [currentPage, PAGE_SIZE, profile, statusFilter, userFilter]);

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', id);
      const order = orders.find(o => o.id === id);
      if (!order) return;

      // Handle stock return if cancelled — restore shopStock (orders come from shop)
      // stock = shopStock + freezerStock + wasteQuantity (invariant)
      if (status === 'cancelled' && order.status !== 'cancelled') {
        for (const item of order.items) {
          try {
            const productRef = doc(db, 'products', item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const data = productSnap.data();
              const newShopStock = (data.shopStock || 0) + item.quantity;
              const newStock = newShopStock + (data.freezerStock || 0) + (data.wasteQuantity || 0);
              await updateDoc(productRef, { shopStock: newShopStock, stock: newStock });
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

  const handleCancelOrder = async () => {
    const order = cancellingOrder;
    if (!order) return;
    if (!cancelReason.trim()) {
      toast.error(t('cancellationReasonRequired'));
      return;
    }

    setIsCancellingOrder(true);
    try {
      // Restore shopStock (orders come from shop) — stock = shopStock + freezerStock + wasteQuantity (invariant)
      for (const item of order.items) {
        try {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const data = productSnap.data();
            const newShopStock = (data.shopStock || 0) + item.quantity;
            const newStock = newShopStock + (data.freezerStock || 0) + (data.wasteQuantity || 0);
            await updateDoc(productRef, { shopStock: newShopStock, stock: newStock });
          }
        } catch (err) {
          console.error(`Error returning stock for product ${item.productId}:`, err);
        }
      }

      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelled',
        amountPaid: 0,
        paymentStatus: 'n/a',
        cancellationReason: cancelReason.trim(),
        updatedAt: new Date().toISOString(),
      });

      if (profile) {
        logActivity(profile.id, profile.name, 'Order', `Order ${order.id} cancelled: ${cancelReason.trim()}`);
      }

      toast.success(t('orderCancelledSuccess'));
      setCancellingOrder(null);
      setCancelReason('');
    } catch (error) {
      console.error('Error cancelling order:', error);
    } finally {
      setIsCancellingOrder(false);
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
      toast.success(t('openingPrintDialog'));
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPDF = async () => {
    if (!selectedOrderForInvoice) return;
    const toastId = toast.loading(t('generatingPDF'));
    try {
      await downloadInvoicePdf({
        filename: `invoice-${selectedOrderForInvoice.id.slice(-8).toUpperCase()}.pdf`,
        isRTL,
        currencyUnit,
        labels: {
          invoiceDocumentTitle: t('invoiceDocumentTitle'),
          billTo: t('billTo'),
          customerIdLabel: t('customerIdLabel'),
          date: t('date'),
          status: t('status'),
          invoiceItem: t('invoiceItem'),
          qtyAbbrev: t('qtyAbbrev'),
          price: t('price'),
          total: t('total'),
          subtotal: t('subtotal'),
          taxZeroPercent: t('taxZeroPercent'),
          totalAmount: t('totalAmount'),
          invoiceThankYou: t('invoiceThankYou'),
          walkInCustomer: t('walkInCustomer'),
        },
        orderId: selectedOrderForInvoice.id.slice(-8).toUpperCase(),
        date: format(new Date(selectedOrderForInvoice.createdAt), 'PPP'),
        status: t(selectedOrderForInvoice.status),
        clientName: selectedOrderForInvoice.clientName || '',
        customerId: selectedOrderForInvoice.customerId || undefined,
        items: selectedOrderForInvoice.items.map((item) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            name: product ? tProduct(product) : t('unknownProduct'),
            quantity: item.quantity,
            price: item.price,
          };
        }),
        totalAmount: selectedOrderForInvoice.totalAmount,
      });
      toast.success(t('pdfDownloaded'), { id: toastId });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(t('pdfError'), { id: toastId });
    }
  };

  const resetSpecialOrderForm = () => {
    setSpecialOrderForm({
      firstName: '',
      lastName: '',
      phone: '0',
      ...getDefaultExpectedDateTime(),
      notes: '',
      downpayment: '',
      items: [emptySpecialOrderItem()],
    });
  };

  const updateSpecialOrderItem = (index: number, patch: Partial<SpecialOrderItemDraft>) => {
    setSpecialOrderForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const updateSpecialOrderItemSpec = (index: number, key: keyof SpecialOrderItemDraft['specifications'], value: string) => {
    setSpecialOrderForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, specifications: { ...item.specifications, [key]: value } } : item)),
    }));
  };

  const addSpecialOrderItem = () => {
    setSpecialOrderForm((prev) => ({ ...prev, items: [...prev.items, emptySpecialOrderItem()] }));
  };

  const removeSpecialOrderItem = (index: number) => {
    setSpecialOrderForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleProductSelectForItem = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateSpecialOrderItem(index, { productId, price: product?.sellingPrice || 0 });
  };

  const specialOrderTotal = specialOrderForm.items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0
  );

  const openEditOrder = (order: Order) => {
    setEditingOrder(order);
    setSpecialOrderForm({
      firstName: order.firstName || '',
      lastName: order.lastName || '',
      phone: order.phone || '0',
      expectedDate: order.expectedDate,
      expectedTime: order.expectedTime,
      notes: order.notes || '',
      downpayment: String(order.amountPaid ?? ''),
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        expanded: !!(item.specifications && Object.values(item.specifications).some(Boolean)),
        specifications: item.specifications || {},
      })),
    });
    setIsSpecialOrderModalOpen(true);
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(t('confirmDeleteOrder'))) return;
    setDeletingOrderId(order.id);
    try {
      // Return quantities on delete — unless already cancelled (stock was already
      // restored then, restoring twice would inflate it) or delivered (goods already
      // left the shop, so there's nothing to give back).
      if (order.status !== 'cancelled' && order.status !== 'delivered') {
        for (const item of order.items) {
          try {
            const productRef = doc(db, 'products', item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const data = productSnap.data();
              const newShopStock = (data.shopStock || 0) + item.quantity;
              const newStock = newShopStock + (data.freezerStock || 0) + (data.wasteQuantity || 0);
              await updateDoc(productRef, { shopStock: newShopStock, stock: newStock });
            }
          } catch (err) {
            console.error(`Error returning stock for product ${item.productId}:`, err);
          }
        }
      }

      await deleteDoc(doc(db, 'orders', order.id));
      if (profile) {
        logActivity(profile.id, profile.name, 'Order', `Order ${order.id} deleted`);
      }
      toast.success(t('orderDeletedSuccess'));
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(t('purchaseSaveFailed') || 'Error');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleCreateSpecialOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const { firstName, lastName, phone, expectedDate, expectedTime, items, notes, downpayment } = specialOrderForm;

    const validItems = items.filter((item) => item.productId && item.quantity > 0);
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !expectedDate || !expectedTime || validItems.length === 0) {
      toast.error(t('requiredFieldsMissing'));
      return;
    }

    if (!/^0[0-9]{9}$/.test(phone.trim())) {
      toast.error(t('phoneInvalid'));
      return;
    }

    setIsSubmittingSpecialOrder(true);
    try {
      if (editingOrder) {
        const totalAmount = validItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
        const downpaymentAmount = Math.max(0, parseFloat(downpayment) || 0);
        const paymentStatus = editingOrder.paymentStatus === 'closed'
          ? 'closed'
          : totalAmount > 0 && downpaymentAmount >= totalAmount ? 'paid_full' : 'deposit';
        await updateDoc(doc(db, 'orders', editingOrder.id), {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          items: validItems.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              name: product ? tProduct(product) : '',
              quantity: item.quantity,
              price: item.price,
              specifications: item.specifications,
            };
          }),
          totalAmount,
          amountPaid: downpaymentAmount,
          paymentStatus,
          expectedDate,
          expectedTime,
          notes: notes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        });

        if (profile) {
          logActivity(profile.id, profile.name, 'Order', `Order ${editingOrder.id} updated`);
        }
        toast.success(t('orderUpdatedSuccess'));
        setIsSpecialOrderModalOpen(false);
        setEditingOrder(null);
        resetSpecialOrderForm();
        return;
      }
      const totalAmount = validItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const downpaymentAmount = Math.max(0, parseFloat(downpayment) || 0);
      const paymentStatus = totalAmount > 0 && downpaymentAmount >= totalAmount ? 'paid_full' : 'deposit';

      const orderData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        type: 'special',
        status: 'ordered',
        items: validItems.map((item) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            name: product ? tProduct(product) : '',
            quantity: item.quantity,
            price: item.price,
            specifications: item.specifications,
          };
        }),
        totalAmount,
        amountPaid: downpaymentAmount,
        paymentStatus,
        expectedDate,
        expectedTime,
        notes: notes.trim() || undefined,
        createdBy: profile?.name,
        createdAt: new Date().toISOString(),
      };

      const { id } = await addDoc(collection(db, 'orders'), orderData);

      // Deduct shopStock for each item (orders come from shop) — mirrors Checkout.tsx.
      // stock = shopStock + freezerStock + wasteQuantity (invariant)
      for (const item of validItems) {
        try {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const data = productSnap.data();
            const newShopStock = Math.max(0, (data.shopStock || 0) - item.quantity);
            const newStock = newShopStock + (data.freezerStock || 0) + (data.wasteQuantity || 0);
            await updateDoc(productRef, { shopStock: newShopStock, stock: newStock });
          }
        } catch (err) {
          console.error(`Error deducting stock for product ${item.productId}:`, err);
        }
      }

      // Kitchen ticket prints immediately, regardless of payment status.
      const kitchenToastId = toast.loading(t('kitchenTicketPrinting'));
      try {
        const kitchenRes = await authFetch('/api/print-kitchen-ticket', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ orderId: id }),
        });
        const kitchenData = await kitchenRes.json();
        if (kitchenData.status === 'error') {
          toast.error(t('kitchenTicketError'), { id: kitchenToastId });
        } else {
          toast.success(t('kitchenTicketPrinted'), { id: kitchenToastId });
        }
      } catch (err) {
        console.error('Kitchen ticket print error:', err);
        toast.error(t('kitchenTicketError'), { id: kitchenToastId });
      }

      // Receipt for whatever was collected at creation time (deposit or full).
      if (downpaymentAmount > 0) {
        try {
          const receiptRes = await authFetch('/api/print-order-receipt', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              orderId: id,
              receiptNumber: String(id).slice(-8).toUpperCase(),
              cashierName: profile?.name,
              isDeposit: paymentStatus === 'deposit',
            }),
          });
          const receiptData = await receiptRes.json();
          if (receiptData.status !== 'error') {
            toast.success(t('orderReceiptPrinted'));
          }
        } catch (err) {
          console.error('Order receipt print error:', err);
        }
      }

      if (profile) {
        logActivity(profile.id, profile.name, 'Order', `Special order ${id} created`);
      }

      toast.success(t('specialOrderCreated'));
      setIsSpecialOrderModalOpen(false);
      resetSpecialOrderForm();
    } catch (error) {
      console.error('Error creating special order:', error);
      toast.error(t('specialOrderCreateFailed'));
    } finally {
      setIsSubmittingSpecialOrder(false);
    }
  };

  const handleCloseOrder = async (order: Order) => {
    const balance = Math.max(0, order.totalAmount - (order.amountPaid || 0));
    const entered = parseFloat(closeBalanceInput[order.id] ?? String(balance)) || 0;
    if (entered < balance) {
      toast.error(t('fullBalanceRequiredError'));
      return;
    }

    setClosingOrderId(order.id);
    try {
      const res = await authFetch(`/api/orders/${order.id}/close`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amountPaid: entered }),
      });
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }

      if (order.paymentStatus !== 'paid_full') {
        try {
          const receiptRes = await authFetch('/api/print-order-receipt', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              orderId: order.id,
              receiptNumber: order.id.slice(-8).toUpperCase(),
              cashierName: profile?.name,
              isDeposit: false,
            }),
          });
          const receiptData = await receiptRes.json();
          if (receiptData.status !== 'error') {
            toast.success(t('orderReceiptPrinted'));
          }
        } catch (err) {
          console.error('Closure receipt print error:', err);
        }
      }

      if (profile) {
        logActivity(profile.id, profile.name, 'Order', `Order ${order.id} closed`);
      }
      toast.success(t('statusClosed'));
    } catch (error) {
      console.error('Error closing order:', error);
    } finally {
      setClosingOrderId(null);
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
                  {t('downloadPDF')}
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
                  <h1 className="text-4xl font-display font-bold text-primary-600 mb-2 print:text-primary-600">{t('invoiceDocumentTitle')}</h1>
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
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 print:text-slate-400">{t('billTo')}</h3>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mb-1 print:text-black">{selectedOrderForInvoice.clientName || t('walkInCustomer')}</p>
                  {selectedOrderForInvoice.customerId && (
                    <p className="text-slate-500 text-sm print:text-slate-500">{t('customerIdLabel').replace('{{id}}', selectedOrderForInvoice.customerId)}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="space-y-2">
                    <div className="flex justify-end gap-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">{t('date')}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white print:text-black">{format(new Date(selectedOrderForInvoice.createdAt), 'PPP')}</span>
                    </div>
                    <div className="flex justify-end gap-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">{t('status')}</span>
                      <span className="text-sm font-bold text-primary-600 uppercase print:text-primary-600">{t(selectedOrderForInvoice.status)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <table className="w-full mb-12">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-[#2a1e17] print:border-slate-100">
                    <th className="py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">{t('invoiceItem')}</th>
                    <th className="py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">{t('qtyAbbrev')}</th>
                    <th className="py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">{t('price')}</th>
                    <th className="py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-400">{t('total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2a1e17] print:divide-slate-100">
                  {selectedOrderForInvoice.items.map((item, idx) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <tr key={idx}>
                        <td className="py-4">
                          <p className="font-bold text-slate-900 dark:text-white print:text-black">{product ? tProduct(product) : t('unknownProduct')}</p>
                          {item.specifications && Object.values(item.specifications).some(Boolean) && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-500">
                              {[
                                item.specifications.flavor && `${t('flavor')}: ${item.specifications.flavor}`,
                                item.specifications.glaze && `${t('glaze')}: ${item.specifications.glaze}`,
                                item.specifications.shape && `${t('shape')}: ${item.specifications.shape}`,
                                item.specifications.size && `${t('size')}: ${item.specifications.size}`,
                                item.specifications.addons && `${t('addons')}: ${item.specifications.addons}`,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="py-4 text-center font-bold text-slate-700 dark:text-slate-300 print:text-slate-700">x{item.quantity}</td>
                        <td className="py-4 text-right font-bold text-slate-700 dark:text-slate-300 print:text-slate-700">{item.price.toLocaleString()} {currencyUnit}</td>
                        <td className="py-4 text-right font-bold text-slate-900 dark:text-white print:text-black">{(item.quantity * item.price).toLocaleString()} {currencyUnit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-4">
                  <div className="flex justify-between items-center text-slate-500 print:text-slate-500">
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('subtotal')}</span>
                    <span className="font-bold">{selectedOrderForInvoice.totalAmount.toLocaleString()} {currencyUnit}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 print:text-slate-500">
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('taxZeroPercent')}</span>
                    <span className="font-bold">0 {currencyUnit}</span>
                  </div>
                  <div className="pt-4 border-t-2 border-slate-100 dark:border-[#2a1e17] flex justify-between items-center print:border-slate-100">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest print:text-black">{t('totalAmount')}</span>
                    <span className="text-2xl font-display font-bold text-primary-600 print:text-primary-600">{selectedOrderForInvoice.totalAmount.toLocaleString()} {currencyUnit}</span>
                  </div>
                  {selectedOrderForInvoice.type === 'special' && (
                    <>
                      <div className="flex justify-between items-center text-slate-500 print:text-slate-500">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('amountPaid')}</span>
                        <span className="font-bold">{(selectedOrderForInvoice.amountPaid || 0).toLocaleString()} {currencyUnit}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500 print:text-slate-500">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('balanceDue')}</span>
                        <span className="font-bold">{Math.max(0, selectedOrderForInvoice.totalAmount - (selectedOrderForInvoice.amountPaid || 0)).toLocaleString()} {currencyUnit}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {selectedOrderForInvoice.notes && (
                <div className="mt-12">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 print:text-slate-400">{t('notes')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 print:text-slate-600 whitespace-pre-wrap">{selectedOrderForInvoice.notes}</p>
                </div>
              )}

              <div className="mt-24 pt-12 border-t border-slate-100 dark:border-[#2a1e17] text-center print:border-slate-100">
                <p className="text-slate-400 text-sm italic print:text-slate-400">{t('invoiceThankYou')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Special Order Modal */}
      {isSpecialOrderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1512] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-100 dark:border-[#2a1e17]">
            <div className="p-6 border-b border-slate-100 dark:border-[#2a1e17] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1a1512] z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-600" />
                {editingOrder ? t('editOrderAction') : t('newSpecialOrder')}
              </h2>
              <button
                type="button"
                onClick={() => { setIsSpecialOrderModalOpen(false); setEditingOrder(null); resetSpecialOrderForm(); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSpecialOrder} className="p-6 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('walkInCustomerInfo')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="special-order-firstName" className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">{t('firstName')} <span className="text-red-500">*</span></label>
                    <input
                      id="special-order-firstName"
                      type="text"
                      required
                      className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none"
                      value={specialOrderForm.firstName}
                      onChange={(e) => setSpecialOrderForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="special-order-lastName" className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">{t('lastName')} <span className="text-red-500">*</span></label>
                    <input
                      id="special-order-lastName"
                      type="text"
                      required
                      className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none"
                      value={specialOrderForm.lastName}
                      onChange={(e) => setSpecialOrderForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="special-order-expectedDate" className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">{t('expectedDateTime')} <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <input
                        id="special-order-expectedDate"
                        type="date"
                        required
                        aria-label={t('expectedDate')}
                        className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none"
                        value={specialOrderForm.expectedDate}
                        onChange={(e) => setSpecialOrderForm((prev) => ({ ...prev, expectedDate: e.target.value }))}
                      />
                      <input
                        id="special-order-expectedTime"
                        type="time"
                        required
                        aria-label={t('expectedTime')}
                        className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none"
                        value={specialOrderForm.expectedTime}
                        onChange={(e) => setSpecialOrderForm((prev) => ({ ...prev, expectedTime: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="special-order-phone" className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">{t('phone')} <span className="text-red-500">*</span></label>
                    <input
                      id="special-order-phone"
                      type="tel"
                      required
                      inputMode="numeric"
                      maxLength={10}
                      pattern="0[0-9]{9}"
                      title={t('phoneInvalid')}
                      className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none"
                      value={specialOrderForm.phone}
                      onChange={(e) => setSpecialOrderForm((prev) => ({ ...prev, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="special-order-downpayment" className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">{editingOrder ? t('amountPaid') : t('downpayment')}</label>
                    <input
                      id="special-order-downpayment"
                      type="number"
                      min={0}
                      disabled={editingOrder?.paymentStatus === 'closed'}
                      className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none disabled:opacity-50"
                      value={specialOrderForm.downpayment}
                      onChange={(e) => setSpecialOrderForm((prev) => ({ ...prev, downpayment: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('products')} <span className="text-red-500">*</span></h3>
                  {specialOrderForm.items.length > 1 && (
                    <span className="text-xs font-bold text-slate-400">{specialOrderForm.items.length} {t('items')}</span>
                  )}
                </div>
                <div className="space-y-4">
                  {specialOrderForm.items.map((item, index) => (
                    <div key={index} className="p-4 bg-slate-50 dark:bg-[#1a1512] rounded-2xl space-y-3">
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('selectProduct')}</label>
                          <select
                            required
                            aria-label={t('selectProduct')}
                            className="input w-full bg-white dark:bg-black border-none text-sm dark:text-white"
                            value={item.productId}
                            onChange={(e) => handleProductSelectForItem(index, e.target.value)}
                          >
                            <option value="" className="dark:bg-black">{t('selectProduct')}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id} className="dark:bg-black">{tProduct(p)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('quantity')}</label>
                          <input
                            type="number"
                            min={1}
                            required
                            aria-label={t('quantity')}
                            className="input w-20 bg-white dark:bg-black border-none text-sm"
                            value={item.quantity}
                            onChange={(e) => updateSpecialOrderItem(index, { quantity: parseInt(e.target.value, 10) || 1 })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('price')}</label>
                          <input
                            type="number"
                            min={0}
                            required
                            aria-label={t('price')}
                            className="input w-28 bg-white dark:bg-black border-none text-sm"
                            value={item.price}
                            onChange={(e) => updateSpecialOrderItem(index, { price: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => updateSpecialOrderItem(index, { expanded: !item.expanded })}
                          className="btn-secondary py-2.5 px-4 text-sm whitespace-nowrap"
                        >
                          {t('customization')}
                        </button>
                        {specialOrderForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSpecialOrderItem(index)}
                            className="p-2.5 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {item.productId && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
                          {item.quantity} x {item.price.toLocaleString()} {currencyUnit} = {(item.quantity * item.price).toLocaleString()} {currencyUnit}
                          {Object.values(item.specifications).some(Boolean) && (
                            <> — {[
                              item.specifications.flavor && `${t('flavor')}: ${item.specifications.flavor}`,
                              item.specifications.glaze && `${t('glaze')}: ${item.specifications.glaze}`,
                              item.specifications.shape && `${t('shape')}: ${item.specifications.shape}`,
                              item.specifications.size && `${t('size')}: ${item.specifications.size}`,
                              item.specifications.addons && `${t('addons')}: ${item.specifications.addons}`,
                            ].filter(Boolean).join(' · ')}</>
                          )}
                        </p>
                      )}

                      {item.expanded && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-white/10">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('flavor')}</label>
                            <EditableSelect category="flavor" ariaLabel={t('flavor')} value={item.specifications.flavor || ''} onChange={(v) => updateSpecialOrderItemSpec(index, 'flavor', v)} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('glaze')}</label>
                            <EditableSelect category="glaze" ariaLabel={t('glaze')} value={item.specifications.glaze || ''} onChange={(v) => updateSpecialOrderItemSpec(index, 'glaze', v)} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('shape')}</label>
                            <EditableSelect category="shape" ariaLabel={t('shape')} value={item.specifications.shape || ''} onChange={(v) => updateSpecialOrderItemSpec(index, 'shape', v)} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('size')}</label>
                            <EditableSelect category="size" ariaLabel={t('size')} value={item.specifications.size || ''} onChange={(v) => updateSpecialOrderItemSpec(index, 'size', v)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('addons')}</label>
                            <EditableSelect category="addon" ariaLabel={t('addons')} value={item.specifications.addons || ''} onChange={(v) => updateSpecialOrderItemSpec(index, 'addons', v)} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSpecialOrderItem}
                  className="btn-secondary gap-2 mt-3"
                >
                  <Plus className="w-4 h-4" />
                  {t('addAnotherProduct')}
                </button>
              </div>

              <div>
                <div>
                  <label htmlFor="special-order-notes" className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">{t('notes')}</label>
                  <textarea
                    id="special-order-notes"
                    rows={2}
                    className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none resize-none"
                    value={specialOrderForm.notes}
                    onChange={(e) => setSpecialOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-[#2a1e17]">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('totalAmount')}</p>
                  <p className="text-2xl font-display font-bold text-primary-600">{specialOrderTotal.toLocaleString()} {currencyUnit}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsSpecialOrderModalOpen(false); setEditingOrder(null); resetSpecialOrderForm(); }}
                    className="btn-secondary"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSpecialOrder}
                    className="btn-primary gap-2 disabled:opacity-50"
                  >
                    <Wallet className="w-4 h-4" />
                    {editingOrder ? t('saveChanges') : t('createOrderAction')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Order Modal — secondary validation with mandatory reason */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div role="dialog" aria-label={t('cancelOrderAction')} className="bg-white dark:bg-[#1a1512] w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-[#2a1e17]">
            <div className="p-6 border-b border-slate-100 dark:border-[#2a1e17] flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                {t('cancelOrderAction')}
              </h2>
              <button
                type="button"
                onClick={() => { setCancellingOrder(null); setCancelReason(''); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('confirmCancelOrder')}</p>
              <div>
                <label htmlFor="cancel-order-reason" className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {t('cancellationReasonLabel')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="cancel-order-reason"
                  autoFocus
                  required
                  rows={3}
                  className="input w-full bg-slate-50/50 dark:bg-[#1a1512]/50 border-none resize-none"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setCancellingOrder(null); setCancelReason(''); }}
                className="btn-secondary"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isCancellingOrder || !cancelReason.trim()}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('cancelOrderAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="print:hidden space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('orders')}</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('manageOrdersDesc')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
              <button
                onClick={() => setActiveTab('orders')}
                className={clsx(
                  "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'orders' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ClipboardList className="w-4 h-4" />
                {t('orders')}
              </button>
              <button
                onClick={() => setActiveTab('tracking')}
                className={clsx(
                  "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'tracking' ? "bg-white dark:bg-zinc-900 text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Truck className="w-4 h-4" />
                {t('tracking')}
              </button>
            </div>
            {activeTab === 'orders' && (
              <button
                onClick={() => { setEditingOrder(null); setIsSpecialOrderModalOpen(true); }}
                className="btn-primary gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('newSpecialOrder')}
              </button>
            )}
          </div>
        </div>

      {activeTab === 'tracking' ? (
        <DeliveryManagement />
      ) : (<>
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
                      {order.type === 'special' ? (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-primary-600 dark:text-primary-400">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('clientName')}</p>
                              <p className="font-bold text-slate-900 dark:text-white">{[order.firstName, order.lastName].filter(Boolean).join(' ') || t('walkInCustomer')}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-amber-600 dark:text-amber-400">
                              <Phone className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('phone')}</p>
                              <p className="font-bold text-slate-900 dark:text-white">{order.phone || '-'}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-primary-600 dark:text-primary-400">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('clientName')}</p>
                              <p className="font-bold text-slate-900 dark:text-white">{order.clientName || t('walkInCustomer')}</p>
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
                        </>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('expectedTime')}</p>
                          <p className="font-bold text-slate-900 dark:text-white">{t('dateTimeAt').replace('{{date}}', order.expectedDate).replace('{{time}}', order.expectedTime)}</p>
                        </div>
                      </div>

                      {order.type === 'special' && order.status !== 'cancelled' ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Wallet className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('paymentStatusLabel')}</p>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {t(order.paymentStatus === 'closed' ? 'statusClosed' : order.paymentStatus === 'paid_full' ? 'statusPaidFull' : 'statusDeposit')}
                              {' — '}{t('balanceDue')}: {Math.max(0, order.totalAmount - (order.amountPaid || 0)).toLocaleString()} {currencyUnit}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm border border-slate-100 dark:border-[#2a1e17] flex items-center justify-center text-slate-600 dark:text-slate-400">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('createdBy')}</p>
                            <p className="font-bold text-slate-900 dark:text-white">{order.createdBy || '-'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        {order.description && (
                          <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{order.description}</h3>
                        )}
                        <p className={order.description ? "text-sm text-slate-500 dark:text-slate-400" : "font-bold text-slate-900 dark:text-white text-lg"}>
                          {order.items.length} {t('items')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">{order.totalAmount.toLocaleString()} {currencyUnit}</p>
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
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{product ? tProduct(product) : t('unknownProduct')}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {item.quantity} x {item.price.toLocaleString()} {currencyUnit} = {(item.quantity * item.price).toLocaleString()} {currencyUnit}
                              </p>
                              {item.specifications && Object.values(item.specifications).some(Boolean) && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-600 break-words">
                                  {[
                                    item.specifications.flavor && `${t('flavor')}: ${item.specifications.flavor}`,
                                    item.specifications.glaze && `${t('glaze')}: ${item.specifications.glaze}`,
                                    item.specifications.shape && `${t('shape')}: ${item.specifications.shape}`,
                                    item.specifications.size && `${t('size')}: ${item.specifications.size}`,
                                    item.specifications.addons && `${t('addons')}: ${item.specifications.addons}`,
                                  ].filter(Boolean).join(' · ')}
                                </p>
                              )}
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
                      <div className="flex-1 flex flex-wrap items-center gap-3">
                        {/* Status Buttons */}
                        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-[#1a1512] p-1 rounded-xl">
                          {(['ordered', 'in-progress', 'delivered'] as Order['status'][]).map((status) => (
                            <button
                              key={status}
                              onClick={() => updateOrderStatus(order.id, status)}
                              disabled={order.status === 'cancelled'}
                              className={clsx(
                                "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                                order.status === status
                                  ? "bg-white dark:bg-black text-primary-600 dark:text-primary-400 shadow-sm"
                                  : "text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
                              )}
                            >
                              {t(status)}
                            </button>
                          ))}
                        </div>

                        {/* Delivery Status Buttons / Close Order */}
                        {order.type === 'special' ? (
                          order.paymentStatus !== 'closed' && order.status !== 'cancelled' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                placeholder={t('balanceDue')}
                                className="input w-24 py-2 bg-white dark:bg-black border border-slate-200 dark:border-white/10 text-[10px]"
                                value={closeBalanceInput[order.id] ?? String(Math.max(0, order.totalAmount - (order.amountPaid || 0)))}
                                onChange={(e) => setCloseBalanceInput((prev) => ({ ...prev, [order.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => handleCloseOrder(order)}
                                disabled={
                                  closingOrderId === order.id ||
                                  (parseFloat(closeBalanceInput[order.id] ?? String(Math.max(0, order.totalAmount - (order.amountPaid || 0)))) || 0) <
                                    Math.max(0, order.totalAmount - (order.amountPaid || 0))
                                }
                                className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {t('closeOrder')}
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-[#1a1512] p-1 rounded-xl">
                            {(['pending', 'assigned', 'picked-up', 'delivered'] as Order['deliveryStatus'][]).map((ds) => (
                              <button
                                key={ds}
                                onClick={() => updateDeliveryStatus(order.id, ds)}
                                disabled={order.status === 'cancelled'}
                                className={clsx(
                                  "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                                  (order.deliveryStatus || 'pending') === ds
                                    ? "bg-white dark:bg-black text-amber-600 dark:text-amber-400 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
                                )}
                              >
                                {t(ds)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setSelectedOrderForInvoice(order);
                            setIsInvoiceModalOpen(true);
                          }}
                          className="btn-secondary gap-2"
                          title={t('issueInvoice')}
                        >
                          <FileText className="w-4 h-4" />
                          <span className="hidden sm:inline">{t('issueInvoice')}</span>
                        </button>
                        {order.type === 'special' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => openEditOrder(order)}
                            className="btn-secondary gap-2"
                            title={t('editOrderAction')}
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('editOrderAction')}</span>
                          </button>
                        )}
                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <button
                            onClick={() => { setCancellingOrder(order); setCancelReason(''); }}
                            className="btn-secondary gap-2 !text-red-600 !border-red-200 hover:!bg-red-50 dark:!text-red-400 dark:!border-red-900/40 dark:hover:!bg-red-900/20"
                            title={t('cancelOrderAction')}
                          >
                            <XCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('cancelOrderAction')}</span>
                          </button>
                        )}
                        {profile?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            disabled={deletingOrderId === order.id}
                            className="btn-secondary gap-2 !text-red-600 !border-red-200 hover:!bg-red-50 dark:!text-red-400 dark:!border-red-900/40 dark:hover:!bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={t('deleteOrderAction')}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('deleteOrderAction')}</span>
                          </button>
                        )}
                      </div>
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
                      {order.type === 'special' ? (
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{[order.firstName, order.lastName].filter(Boolean).join(' ') || t('walkInCustomer')}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{order.phone}</p>
                        </div>
                      ) : (
                        <p className="font-bold text-slate-900 dark:text-white">{order.clientName || t('walkInCustomer')}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className={clsx("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block", getStatusColor(order.status))}>
                        {t(order.status)}
                      </div>
                      {order.type === 'special' && order.status !== 'cancelled' && (
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 mt-1">
                          {t(order.paymentStatus === 'closed' ? 'statusClosed' : order.paymentStatus === 'paid_full' ? 'statusPaidFull' : 'statusDeposit')}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-primary-600 dark:text-primary-400">{order.totalAmount.toLocaleString()} {currencyUnit}</p>
                      {order.type === 'special' && order.status !== 'cancelled' && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('balanceDue')}: {Math.max(0, order.totalAmount - (order.amountPaid || 0)).toLocaleString()} {currencyUnit}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-600 dark:text-slate-300">{order.expectedDate} {order.expectedTime}</p>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-3">
                        {order.type === 'special' ? (
                          order.paymentStatus !== 'closed' && order.status !== 'cancelled' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                className="input w-24 py-1.5 bg-slate-50 dark:bg-zinc-900 border-none text-xs"
                                value={closeBalanceInput[order.id] ?? String(Math.max(0, order.totalAmount - (order.amountPaid || 0)))}
                                onChange={(e) => setCloseBalanceInput((prev) => ({ ...prev, [order.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => handleCloseOrder(order)}
                                disabled={
                                  closingOrderId === order.id ||
                                  (parseFloat(closeBalanceInput[order.id] ?? String(Math.max(0, order.totalAmount - (order.amountPaid || 0)))) || 0) <
                                    Math.max(0, order.totalAmount - (order.amountPaid || 0))
                                }
                                className="px-2 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {t('closeOrder')}
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-100 dark:border-white/5">
                            {(['ordered', 'in-progress', 'delivered'] as Order['status'][]).map((status) => (
                              <button
                                key={status}
                                onClick={() => updateOrderStatus(order.id, status)}
                                disabled={order.status === 'cancelled'}
                                className={clsx(
                                  "px-2 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                                  order.status === status
                                    ? "bg-white dark:bg-black text-primary-600 dark:text-primary-400 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
                                )}
                              >
                                {t(status)}
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setSelectedOrderForInvoice(order);
                            setIsInvoiceModalOpen(true);
                          }}
                          className="p-2 text-slate-400 dark:text-slate-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          title={t('issueInvoice')}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {order.type === 'special' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => openEditOrder(order)}
                            className="p-2 text-slate-400 dark:text-slate-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            title={t('editOrderAction')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <button
                            onClick={() => { setCancellingOrder(order); setCancelReason(''); }}
                            className="p-2 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title={t('cancelOrderAction')}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {profile?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            disabled={deletingOrderId === order.id}
                            className="p-2 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={t('deleteOrderAction')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
      </>)}
      </div>
    </div>
  );
};

export default Orders;
