import { TRANSLATIONS, CURRENCY } from '../constants';
import { usePreferencesStore } from '../store/preferences';

export function useI18n() {
  const lang = usePreferencesStore((s) => s.lang);
  const setLang = usePreferencesStore((s) => s.setLang);

  const t = (key: string): string => TRANSLATIONS[lang][key] || key;
  const isRTL = lang === 'ar';
  const formatCurrency = (amount: number) => `${amount.toLocaleString()} ${CURRENCY}`;

  return { lang, setLang, t, isRTL, formatCurrency };
}
