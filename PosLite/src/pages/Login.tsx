import React, { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../hooks/useI18n';

interface LoginProps {
  onOpenSettings: () => void;
}

const Login: React.FC<LoginProps> = ({ onOpenSettings }) => {
  const { t } = useI18n();
  const { signIn, loading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(username, password);
        }}
        className="w-full max-w-sm bg-white dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17] rounded-2xl p-8 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white text-center flex-1">
            {t('pos')}
          </h1>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t('settings')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {t('username')}
          </label>
          <input
            autoFocus
            className="input w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {t('password')}
          </label>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm font-bold text-red-600">{t(error) !== error ? t(error) : error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 text-base font-bold rounded-xl disabled:opacity-50"
        >
          {loading ? t('checkoutProcessing') : t('login')}
        </button>
      </form>
    </div>
  );
};

export default Login;
