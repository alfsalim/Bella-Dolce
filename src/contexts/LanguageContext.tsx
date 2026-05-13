import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { TRANSLATIONS, PRODUCT_NAMES, CATEGORY_NAMES, FINANCIAL_TRANSLATIONS, CURRENCY } from '../constants';

/** Primary catalog name, optional Arabic override stored on product/material documents. */
export type ProductDisplayInput =
  | string
  | null
  | undefined
  | { name?: string | null; nameAr?: string | null };

/** Role id → translation key when it differs from nav keys (e.g. `inventory` page vs inventory staff). */
const ROLE_TRANSLATION_KEY: Record<string, string> = {
  inventory: 'role_inventory',
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  /** User/role labels; use for `UserProfile.role` and permission role ids. */
  tRole: (roleId: string) => string;
  tf: (key: string) => string;
  tProduct: (input: ProductDisplayInput) => string;
  tCategory: (category: string) => string;
  formatCurrency: (amount: number) => string;
  /** "DA" in French; "دج" in Arabic (display suffix for amounts). */
  currencyUnit: string;
  isRTL: boolean;
  isBilingual: boolean;
  toggleBilingual: () => void;
  setCategoryNames: (names: { fr: Record<string, string>; ar: Record<string, string> }) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'fr';
  });
  const [isBilingual, setIsBilingual] = useState(false);
  const [dbCategoryNames, setDbCategoryNames] = useState<{ fr: Record<string, string>; ar: Record<string, string> }>({ fr: {}, ar: {} });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => {
    return TRANSLATIONS[language][key] || key;
  };

  const tRole = (roleId: string) => {
    const key = ROLE_TRANSLATION_KEY[roleId] ?? roleId;
    return TRANSLATIONS[language][key] || roleId;
  };

  const tf = (key: string) => {
    return FINANCIAL_TRANSLATIONS[language][key] || key;
  };

  const tProduct = (input: ProductDisplayInput): string => {
    if (input == null) return '';
    if (typeof input === 'string') {
      const name = input;
      if (language === 'ar') return PRODUCT_NAMES.ar?.[name] ?? name;
      return PRODUCT_NAMES.fr?.[name] ?? name;
    }
    const name = input.name ?? '';
    const nameAr = input.nameAr;
    if (language === 'ar') {
      const ar = nameAr?.trim();
      if (ar) return ar;
      if (name) return PRODUCT_NAMES.ar?.[name] ?? name;
      return '';
    }
    if (name) return PRODUCT_NAMES.fr?.[name] ?? name;
    return '';
  };

  const tCategory = (category: string) => {
    return dbCategoryNames[language]?.[category] || CATEGORY_NAMES[language]?.[category] || category;
  };

  const setCategoryNames = (names: { fr: Record<string, string>; ar: Record<string, string> }) => {
    setDbCategoryNames(names);
  };

  const currencyUnit = language === 'ar' ? 'دج' : CURRENCY;

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-DZ' : 'fr-DZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return `${formatted} ${currencyUnit}`;
  };

  const isRTL = language === 'ar';
  const toggleBilingual = () => setIsBilingual(prev => !prev);

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage, 
      t, 
      tRole,
      tf, 
      tProduct, 
      tCategory, 
      formatCurrency,
      currencyUnit,
      isRTL, 
      isBilingual,
      toggleBilingual,
      setCategoryNames,
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
