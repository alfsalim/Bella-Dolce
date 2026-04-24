import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const Placeholder: React.FC<{ title: string }> = ({ title }) => {
  const { t } = useLanguage();
  return (
    <div className="card h-96 flex items-center justify-center">
      <h2 className="text-2xl font-bold text-slate-400">{t(title)} - Coming Soon</h2>
    </div>
  );
};

export const Production = () => <Placeholder title="production" />;
export const Inventory = () => <Placeholder title="inventory" />;
export const POS = () => <Placeholder title="pos" />;
export const Management = () => <Placeholder title="management" />;
export const Users = () => <Placeholder title="users" />;
export const Reports = () => <Placeholder title="reports" />;
export const ProductEdit = () => <Placeholder title="product" />;
