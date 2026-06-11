import React, { useEffect, useState } from 'react';
import { getSyncMeta, updateSyncMeta } from '../db';
import { useI18n } from '../hooks/useI18n';
import { usePreferencesStore } from '../store/preferences';
import type { Lang } from '../constants';

interface SettingsProps {
  onClose?: () => void;
}

// Lets each install point at its own server / PrintAgent without a rebuild
// (sync_meta.serverBaseUrl/printAgentUrl, read by api/client.ts and
// api/printAgent.ts). onClose is omitted on first-run (no cashier session
// to return to yet).
const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { t } = useI18n();
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const lang = usePreferencesStore((s) => s.lang);
  const setLang = usePreferencesStore((s) => s.setLang);
  const [serverBaseUrl, setServerBaseUrl] = useState('');
  const [printAgentUrl, setPrintAgentUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSyncMeta().then((meta) => {
      setServerBaseUrl(meta.serverBaseUrl);
      setPrintAgentUrl(meta.printAgentUrl ?? '');
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSyncMeta({
      serverBaseUrl: serverBaseUrl.replace(/\/$/, ''),
      printAgentUrl: printAgentUrl.trim() ? printAgentUrl.replace(/\/$/, '') : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black p-6">
      <form
        onSubmit={handleSave}
        className="w-full max-w-sm bg-white dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17] rounded-2xl p-8 shadow-xl space-y-5"
      >
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white text-center">
          {t('settings')}
        </h1>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {t('theme')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`py-2 rounded-xl font-bold border ${theme === 'light' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-300'}`}
            >
              {t('light')}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`py-2 rounded-xl font-bold border ${theme === 'dark' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-300'}`}
            >
              {t('dark')}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {t('language')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['fr', 'ar', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`py-2 rounded-xl font-bold border uppercase ${lang === l ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-300'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {t('serverUrl')}
          </label>
          <input
            autoFocus
            className="input w-full"
            placeholder="http://localhost:3100"
            value={serverBaseUrl}
            onChange={(e) => setServerBaseUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {t('printAgentUrl')}
          </label>
          <input
            className="input w-full"
            placeholder="http://localhost:5555"
            value={printAgentUrl}
            onChange={(e) => setPrintAgentUrl(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">{t('printAgentUrlHint')}</p>
        </div>

        {saved && <p className="text-sm font-bold text-emerald-600">{t('settingsSaved')}</p>}

        <div className="flex gap-3">
          <button type="submit" className="flex-1 btn-primary py-3 text-base font-bold rounded-xl">
            {t('save')}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-base font-bold rounded-xl border border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-300"
            >
              {t('close')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default Settings;
