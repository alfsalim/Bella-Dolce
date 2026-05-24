import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import BilingualLabel from '../components/BilingualLabel';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { authFetch, getAuthHeaders } from '../lib/api-client';
import { toast } from 'react-hot-toast';

type UtilityDefinition = {
  id: string;
  type: string;
  provider: string;
  frequency: string;
  contractStartDate?: string;
  contractEndDate?: string;
  alertsEnabled: boolean;
  overdueDays: number;
  notes?: string;
  createdAt: string;
};

const UtilityDefinitions: React.FC = () => {
  const { tf, isRTL } = useLanguage();
  const [definitions, setDefinitions] = useState<UtilityDefinition[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<UtilityDefinition | null>(null);
  const [formData, setFormData] = useState<Partial<UtilityDefinition>>({
    type: 'ELECTRICITY',
    provider: '',
    frequency: 'MONTHLY',
    contractStartDate: '',
    contractEndDate: '',
    alertsEnabled: true,
    overdueDays: 30,
    notes: ''
  });

  const UTILITY_TYPES = ['ELECTRICITY', 'WATER', 'GAS', 'INTERNET', 'PHONE', 'OTHER'];
  const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];

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

  const frequencyLabel = (freq: string) => {
    const map: Record<string, string> = {
      MONTHLY: tf('frequencyMonthly'),
      QUARTERLY: tf('frequencyQuarterly'),
      ANNUAL: tf('frequencyAnnual'),
    };
    return map[freq] || freq;
  };

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const fetchDefinitions = async () => {
    try {
      const res = await authFetch('/api/db/utilityDefinitions', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDefinitions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching utility definitions:', err);
      toast.error(tf('errorLoadingData'));
    }
  };

  const handleSave = async () => {
    if (!formData.provider?.trim()) {
      toast.error(tf('fieldRequired'));
      return;
    }

    try {
      const payload = {
        ...formData,
        contractStartDate: formData.contractStartDate ? new Date(formData.contractStartDate).toISOString() : null,
        contractEndDate: formData.contractEndDate ? new Date(formData.contractEndDate).toISOString() : null,
      };

      const res = editingDef
        ? await authFetch(`/api/db/utilityDefinitions/${editingDef.id}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await authFetch('/api/db/utilityDefinitions', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

      if (res.ok) {
        toast.success(editingDef ? tf('updated') : tf('created'));
        setIsModalOpen(false);
        setEditingDef(null);
        setFormData({
          type: 'ELECTRICITY',
          provider: '',
          frequency: 'MONTHLY',
          contractStartDate: '',
          contractEndDate: '',
          alertsEnabled: true,
          overdueDays: 30,
          notes: ''
        });
        await fetchDefinitions();
      } else {
        toast.error(tf('errorSavingData'));
      }
    } catch (err) {
      console.error('Error saving definition:', err);
      toast.error(tf('errorSavingData'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tf('confirmDelete'))) return;

    try {
      const res = await authFetch(`/api/db/utilityDefinitions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        toast.success(tf('deleted'));
        await fetchDefinitions();
      } else {
        toast.error(tf('errorDeletingData'));
      }
    } catch (err) {
      console.error('Error deleting definition:', err);
      toast.error(tf('errorDeletingData'));
    }
  };

  const handleEdit = (def: UtilityDefinition) => {
    setEditingDef(def);
    setFormData({
      type: def.type,
      provider: def.provider,
      frequency: def.frequency,
      contractStartDate: def.contractStartDate ? format(new Date(def.contractStartDate), 'yyyy-MM-dd') : '',
      contractEndDate: def.contractEndDate ? format(new Date(def.contractEndDate), 'yyyy-MM-dd') : '',
      alertsEnabled: def.alertsEnabled,
      overdueDays: def.overdueDays,
      notes: def.notes
    });
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingDef(null);
    setFormData({
      type: 'ELECTRICITY',
      provider: '',
      frequency: 'MONTHLY',
      contractStartDate: '',
      contractEndDate: '',
      alertsEnabled: true,
      overdueDays: 30,
      notes: ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">{tf('utilityDefinitions')}</h3>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {tf('addNew')}
        </button>
      </div>

      {/* Definitions Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className={clsx('px-4 py-3 text-left font-semibold', isRTL && 'text-right')}>
                {tf('utilitiesType')}
              </th>
              <th className={clsx('px-4 py-3 text-left font-semibold', isRTL && 'text-right')}>
                {tf('utilitiesProvider')}
              </th>
              <th className={clsx('px-4 py-3 text-left font-semibold', isRTL && 'text-right')}>
                {tf('frequency')}
              </th>
              <th className={clsx('px-4 py-3 text-left font-semibold', isRTL && 'text-right')}>
                {tf('alertSettings')}
              </th>
              <th className={clsx('px-4 py-3 text-left font-semibold', isRTL && 'text-right')}>
                {tf('actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {definitions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {tf('noDataAvailable')}
                </td>
              </tr>
            ) : (
              definitions.map(def => (
                <tr key={def.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3">{typeLabel(def.type)}</td>
                  <td className="px-4 py-3 font-medium">{def.provider}</td>
                  <td className="px-4 py-3">{frequencyLabel(def.frequency)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {def.alertsEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                          <AlertCircle className="w-3 h-3" />
                          {tf('enabled')}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{tf('disabled')}</span>
                      )}
                      {def.alertsEnabled && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {def.overdueDays}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(def)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title={tf('edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(def.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title={tf('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-lg">
                {editingDef ? tf('editDefinition') : tf('addDefinition')}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium mb-2">{tf('utilitiesType')}</label>
              <select
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                {UTILITY_TYPES.map(t => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
            </div>

            {/* Provider */}
            <div>
              <label className="block text-sm font-medium mb-2">{tf('utilitiesProvider')} *</label>
              <input
                type="text"
                value={formData.provider || ''}
                onChange={e => setFormData({...formData, provider: e.target.value})}
                placeholder={tf('placeholderProviderExample')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium mb-2">{tf('frequency')}</label>
              <select
                value={formData.frequency}
                onChange={e => setFormData({...formData, frequency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                {FREQUENCIES.map(f => (
                  <option key={f} value={f}>{frequencyLabel(f)}</option>
                ))}
              </select>
            </div>

            {/* Contract Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-2">{tf('contractStart')}</label>
                <input
                  type="date"
                  value={formData.contractStartDate || ''}
                  onChange={e => setFormData({...formData, contractStartDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{tf('contractEnd')}</label>
                <input
                  type="date"
                  value={formData.contractEndDate || ''}
                  onChange={e => setFormData({...formData, contractEndDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
                />
              </div>
            </div>

            {/* Alerts */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.alertsEnabled || false}
                  onChange={e => setFormData({...formData, alertsEnabled: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm font-medium">{tf('enableAlerts')}</span>
              </label>
              {formData.alertsEnabled && (
                <div>
                  <label className="block text-sm font-medium mb-2">{tf('overdueAfterDays')}</label>
                  <input
                    type="number"
                    value={formData.overdueDays || 30}
                    onChange={e => setFormData({...formData, overdueDays: parseInt(e.target.value)})}
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">{tf('notes')}</label>
              <textarea
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder={tf('optionalNotes')}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {tf('cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                {tf('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UtilityDefinitions;
