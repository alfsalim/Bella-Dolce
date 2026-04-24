import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { TRANSLATIONS, FINANCIAL_TRANSLATIONS } from '../constants';

interface BilingualLabelProps {
  tKey: string;
  className?: string;
  tf?: boolean;
}

const BilingualLabel: React.FC<BilingualLabelProps> = ({ tKey, className, tf }) => {
  const { isBilingual, language } = useLanguage();
  const source = tf ? FINANCIAL_TRANSLATIONS : TRANSLATIONS;

  if (!isBilingual) {
    const text = (source[language] as any)[tKey] || tKey;
    return <span className={className}>{text}</span>;
  }

  const frText = (source['fr'] as any)[tKey] || tKey;
  const arText = (source['ar'] as any)[tKey] || tKey;

  return (
    <span className={className}>
      {frText} <span className="text-slate-400 font-normal mx-1">/</span> {arText}
    </span>
  );
};

export default BilingualLabel;
