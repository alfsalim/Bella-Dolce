import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { TRANSLATIONS, PRODUCT_NAMES, CATEGORY_NAMES, FINANCIAL_TRANSLATIONS } from '../constants';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  tf: (key: string) => string;
  tProduct: (name: string) => string;
  tCategory: (category: string) => string;
  formatCurrency: (amount: number) => string;
  isRTL: boolean;
  isBilingual: boolean;
  toggleBilingual: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'fr';
  });
  const [isBilingual, setIsBilingual] = useState(false);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => {
    return TRANSLATIONS[language][key] || key;
  };

  const tf = (key: string) => {
    return FINANCIAL_TRANSLATIONS[language][key] || key;
  };

  const tProduct = (name: string) => {
    return PRODUCT_NAMES[language]?.[name] || name;
  };

  const tCategory = (category: string) => {
    return CATEGORY_NAMES[language]?.[category] || category;
  };

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-DZ' : 'fr-DZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    
    return language === 'ar' ? `${formatted} د.ج` : `${formatted} DA`;
  };

  const isRTL = language === 'ar';
  const toggleBilingual = () => setIsBilingual(prev => !prev);

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage, 
      t, 
      tf, 
      tProduct, 
      tCategory, 
      formatCurrency,
      isRTL, 
      isBilingual, 
      toggleBilingual 
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
