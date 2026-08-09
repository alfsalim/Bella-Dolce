import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db, collection, query, where, getDocs, addDoc } from '../lib/db';
import { useLanguage } from '../contexts/LanguageContext';
import { SpecificationOption } from '../types';

const ADD_NEW_VALUE = '__add_new__';

interface EditableSelectProps {
  category: SpecificationOption['category'];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const EditableSelect: React.FC<EditableSelectProps> = ({ category, value, onChange, placeholder, ariaLabel }) => {
  const { t } = useLanguage();
  const [options, setOptions] = useState<SpecificationOption[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOptions = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'specificationOptions'), where('category', '==', category)));
      setOptions(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as SpecificationOption)));
    } catch (error) {
      console.error('Error loading specification options:', error);
    }
  };

  useEffect(() => {
    loadOptions();
  }, [category]);

  const handleAddNew = async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'specificationOptions'), { category, value: trimmed });
      await loadOptions();
      onChange(trimmed);
      setIsAdding(false);
      setNewValue('');
    } catch (error) {
      console.error('Error adding specification option:', error);
      toast.error(error instanceof Error ? error.message : t('addOptionFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (isAdding) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoFocus
          className="input py-2 bg-slate-50/50 dark:bg-[#1a1512]/50 border-none text-sm flex-1 dark:text-white"
          placeholder={t('newOptionPlaceholder')}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAddNew(); }
            if (e.key === 'Escape') { setIsAdding(false); setNewValue(''); }
          }}
        />
        <button
          type="button"
          onClick={handleAddNew}
          disabled={saving || !newValue.trim()}
          className="btn-secondary py-2 px-3 text-xs disabled:opacity-50"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={() => { setIsAdding(false); setNewValue(''); }}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <select
      aria-label={ariaLabel}
      className="input py-2 bg-slate-50/50 dark:bg-[#1a1512]/50 border-none text-sm w-full dark:text-white"
      value={value}
      onChange={(e) => {
        if (e.target.value === ADD_NEW_VALUE) {
          setIsAdding(true);
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="" className="dark:bg-black">{placeholder || '—'}</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.value} className="dark:bg-black">{opt.value}</option>
      ))}
      <option value={ADD_NEW_VALUE} className="dark:bg-black">{t('addNewOption')}</option>
    </select>
  );
};

export default EditableSelect;
