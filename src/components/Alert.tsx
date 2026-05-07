import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';

type AlertType = 'error' | 'success' | 'warning';

interface AlertProps {
  type: AlertType;
  message: string;
  onDismiss?: () => void;
}

const STYLES: Record<AlertType, { wrapper: string; icon: React.ReactNode }> = {
  error: {
    wrapper: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    icon: <AlertCircle className="w-5 h-5 shrink-0" />,
  },
  success: {
    wrapper: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
  },
  warning: {
    wrapper: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
  },
};

const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  const { wrapper, icon } = STYLES[type];
  return (
    <div role="alert" className={clsx('flex items-start gap-3 rounded-xl p-4 text-sm font-medium', wrapper)}>
      {icon}
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
