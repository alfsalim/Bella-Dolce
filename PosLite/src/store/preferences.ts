import { create } from 'zustand';
import { getSyncMeta, updateSyncMeta } from '../db';
import type { Lang } from '../constants';

interface PreferencesState {
  theme: 'light' | 'dark';
  lang: Lang;
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  setLang: (lang: Lang) => Promise<void>;
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function applyDir(lang: Lang) {
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  theme: 'dark',
  lang: 'fr',
  loaded: false,

  load: async () => {
    const meta = await getSyncMeta();
    applyTheme(meta.theme);
    applyDir(meta.lang);
    set({ theme: meta.theme, lang: meta.lang, loaded: true });
  },

  setTheme: async (theme) => {
    applyTheme(theme);
    await updateSyncMeta({ theme });
    set({ theme });
  },

  setLang: async (lang) => {
    applyDir(lang);
    await updateSyncMeta({ lang });
    set({ lang });
  },
}));
