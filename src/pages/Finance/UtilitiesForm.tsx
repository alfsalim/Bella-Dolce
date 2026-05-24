import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { clsx } from 'clsx';
import { authFetch, getAuthHeaders, parseJsonResponse, readApiErrorMessage } from '../../lib/api-client';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

type UtilityFormData = {
  type: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  amount: string | number;
  currency: string;
  dueDate?: string | null;
  paidAt?: string | null;
  status?: string;
  invoiceNumber?: string;
  attachmentUrl?: string;
  notes?: string;
  definitionId?: string;
};

type UtilityDefinition = {
  id: string;
  type: string;
  provider: string;
  frequency: string;
  fixedPrice?: number;
  dueDay?: number;
  contractStartDate?: string;
  contractEndDate?: string;
};

const UTILITY_TYPES = ['ELECTRICITY', 'WATER', 'GAS', 'INTERNET', 'PHONE', 'OTHER'] as const;

interface UtilitiesFormProps {
  utilityId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const UtilitiesForm: React.FC<UtilitiesFormProps> = ({ utilityId, onClose, onSuccess }) => {
  const { tf, t } = useLanguage();
  const [loading, setLoading] = useState(!!utilityId);
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [definitions, setDefinitions] = useState<UtilityDefinition[]>([]);
  const [form, setForm] = useState<UtilityFormData>({
    type: 'ELECTRICITY',
    provider: '',
    periodStart: format(new Date(), 'yyyy-MM-dd'),
    periodEnd: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    currency: 'DZD',
    dueDate: null,
    paidAt: null,
    invoiceNumber: '',
    notes: '',
    definitionId: undefined,
  });

  useEffect(() => {
    if (utilityId) {
      const fetchUtility = async () => {
        try {
          const res = await authFetch(`/api/db/utilities/${utilityId}`, {
            headers: getAuthHeaders(),
          });
          if (!res.ok) throw new Error(await readApiErrorMessage(res));
          const data = await parseJsonResponse<any>(res);
          setForm({
            type: data.type || 'ELECTRICITY',
            provider: data.provider || '',
            periodStart: data.periodStart ? format(new Date(data.periodStart), 'yyyy-MM-dd') : '',
            periodEnd: data.periodEnd ? format(new Date(data.periodEnd), 'yyyy-MM-dd') : '',
            amount: data.amount || '',
            currency: data.currency || 'DZD',
            dueDate: data.dueDate ? format(new Date(data.dueDate), 'yyyy-MM-dd') : null,
            paidAt: data.paidAt ? format(new Date(data.paidAt), 'yyyy-MM-dd') : null,
            invoiceNumber: data.invoiceNumber || '',
            notes: data.notes || '',
          });
        } catch (e) {
          console.error(e);
          toast.error(t('loadFailed'));
        } finally {
          setLoading(false);
        }
      };
      void fetchUtility();
    }

    // Fetch providers list for autocomplete
    const fetchProviders = async () => {
      try {
        const res = await authFetch('/api/db/utilities?take=1000', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await parseJsonResponse<any[]>(res);
          const uniqueProviders = [...new Set(data.map((u) => u.provider).filter(Boolean))];
          setProviders(uniqueProviders);
        }
      } catch (e) {
        console.error(e);
      }
    };

    // Fetch utility definitions
    const fetchDefinitions = async () => {
      try {
        const res = await authFetch('/api/db/utilityDefinitions', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await parseJsonResponse<UtilityDefinition[]>(res);
          setDefinitions(data);
        }
      } catch (e) {
        console.error(e);
      }
    };

    void fetchProviders();
    void fetchDefinitions();
  }, [utilityId, t]);

  const handleDefinitionSelect = (defId: string) => {
    const def = definitions.find(d => d.id === defId);
    if (!def) return;

    // Auto-populate from definition
    setForm(prev => {
      const newDueDate = def.fixedPrice && def.dueDay ? format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, Math.min(def.dueDay, 28)), 'yyyy-MM-dd') : prev.dueDate;
      return {
        ...prev,
        definitionId: defId,
        type: def.type,
        provider: def.provider,
        amount: def.fixedPrice || prev.amount,
        dueDate: newDueDate,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.provider || !form.periodStart || !form.periodEnd || !form.amount) {
      toast.error(t('fillRequiredFields'));
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        amount: parseFloat(String(form.amount)),
        paidAt: form.paidAt || null,
        dueDate: form.dueDate || null,
      };

      const res = await authFetch(utilityId ? `/api/db/utilities/${utilityId}` : '/api/db/utilities', {
        method: utilityId ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      toast.success(tf('utilitiesSaved'));
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(tf('utilitiesSaveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      ELECTRICITY: tf('utilitiesTypeElectricity'),
      WATER: tf('utilitiesTypeWater'),
      GAS: tf('utilitiesTypeGas'),
      INTERNET: tf('utilitiesTypeInternet'),
      PHONE: tf('utilitiesTypePhone'),
      OTHER: tf('utilitiesTypeOther'),
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-lg">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {utilityId ? tf('utilitiesEdit') : tf('utilitiesAdd')}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Link to Definition */}
          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              {tf('utilitiesDefinition') || 'Service Definition'}
            </label>
            <select
              value={form.definitionId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleDefinitionSelect(e.target.value);
                } else {
                  setForm({ ...form, definitionId: undefined });
                }
              }}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
            >
              <option value="">— Select a definition (optional) —</option>
              {definitions.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.provider} ({def.type})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{tf('utilitiesDefinitionHint') || 'Selecting a definition will auto-populate type, provider, and amount'}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              <BilingualLabel tKey="utilitiesType" tf /> <span className="text-red-600">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
            >
              {UTILITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              <BilingualLabel tKey="utilitiesProvider" tf /> <span className="text-red-600">*</span>
            </label>
            <input
              list="providers"
              type="text"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
              placeholder="e.g., Sonelgaz, ADE, Djezzy"
            />
            <datalist id="providers">
              {providers.map((provider) => (
                <option key={provider} value={provider} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
                <BilingualLabel tKey="utilitiesPeriodStart" tf /> <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
                <BilingualLabel tKey="utilitiesPeriodEnd" tf /> <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              <BilingualLabel tKey="utilitiesAmount" tf /> <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              <BilingualLabel tKey="utilitiesDueDate" tf />
            </label>
            <input
              type="date"
              value={form.dueDate || ''}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value || null })}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
            <input
              type="checkbox"
              id="paid"
              checked={!!form.paidAt}
              onChange={(e) =>
                setForm({
                  ...form,
                  paidAt: e.target.checked ? format(new Date(), 'yyyy-MM-dd') : null,
                })
              }
              className="w-4 h-4 rounded border-slate-300"
            />
            <label htmlFor="paid" className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              <BilingualLabel tKey="utilitiesMarkAsPaid" tf />
            </label>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              <BilingualLabel tKey="utilitiesInvoiceNumber" tf />
            </label>
            <input
              type="text"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
              placeholder="e.g., FTU2026001"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              <BilingualLabel tKey="utilitiesNotes" tf />
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white min-h-24 resize-none"
              placeholder="Internal notes…"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={clsx(
                'flex-1 px-4 py-2 rounded-xl bg-primary-600 text-white font-bold transition-colors',
                submitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-700'
              )}
            >
              {submitting ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UtilitiesForm;
