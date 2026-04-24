import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Truck,
  DollarSign,
  Calendar
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { SupplierInvoice, InvoiceStatus } from '../../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const Expenses: React.FC = () => {
  const { formatCurrency, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('invoices');

  // Mock data for supplier invoices
  const invoices: SupplierInvoice[] = [
    {
      id: 'inv-1',
      supplierId: 'sup-1',
      supplierName: 'Minoterie des Grands Moulins',
      invoiceNumber: 'FAC-2026-001',
      date: '2026-03-20',
      dueDate: '2026-04-20',
      amountHT: 450000,
      tvaAmount: 40500,
      totalAmount: 490500,
      amountPaid: 0,
      status: 'APPROUVÉ',
      category: 'MATIÈRES_PREMIÈRES',
      createdAt: new Date().toISOString()
    },
    {
      id: 'inv-2',
      supplierId: 'sup-2',
      supplierName: 'Sonelgaz',
      invoiceNumber: 'ELEC-2026-03',
      date: '2026-03-25',
      dueDate: '2026-04-10',
      amountHT: 12500,
      tvaAmount: 2375,
      totalAmount: 14875,
      amountPaid: 0,
      status: 'EN_ATTENTE_VALIDATION',
      category: 'CHARGES_EXTÉRIEURES',
      createdAt: new Date().toISOString()
    }
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          onClick={() => setActiveSubTab('invoices')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'invoices'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="supplierInvoices" tf />
          {activeSubTab === 'invoices' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('assets')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'assets'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="fixedAssets" tf />
          {activeSubTab === 'assets' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20">
                <Plus className="w-5 h-5" />
                <BilingualLabel tKey="addInvoice" tf />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/10">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <BilingualLabel tKey="supplier" tf />
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <BilingualLabel tKey="invoiceNumber" tf />
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <BilingualLabel tKey="date" tf />
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <BilingualLabel tKey="status" tf />
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                      <BilingualLabel tKey="totalAmount" tf />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {invoices.map((invoice) => (
                    <tr 
                      key={invoice.id}
                      className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-slate-500">
                            <Truck className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {invoice.supplierName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                          {invoice.invoiceNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-900 dark:text-white font-medium">{invoice.date}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Due: {invoice.dueDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                          invoice.status === 'APPROUVÉ' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                          invoice.status === 'EN_ATTENTE_VALIDATION' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                          "bg-slate-50 dark:bg-zinc-800 text-slate-500"
                        )}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'assets' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FileText className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">Fixed Assets Module coming soon</p>
          <p className="text-sm">Amortization schedules are being calculated</p>
        </div>
      )}
    </div>
  );
};

export default Expenses;
