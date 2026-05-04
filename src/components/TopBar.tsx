import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Globe,
  Menu,
  User,
  LayoutDashboard,
  Settings as SettingsIcon,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo, { BRAND_LOGO_CHIP_CLASS, BRAND_LOGO_MARK_IMG_CLASS } from './BrandLogo';
import { authFetch, getAuthHeaders, parseJsonResponse, readApiErrorMessage } from '../lib/api-client';
import toast from 'react-hot-toast';

interface TopBarProps {
  onMenuClick: () => void;
  isPublic?: boolean;
  /** When false, staff header spans full width (no gap for fixed sidebar). */
  staffSidebarLayout?: boolean;
  /** When false, hide mobile sidebar toggle (single visible nav item). */
  showNavMenu?: boolean;
}

type StaffSearchHit = {
  type: string;
  id: string;
  label: string;
  subtitle?: string;
  path: string;
};

const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  isPublic,
  staffSidebarLayout = true,
  showNavMenu = true,
}) => {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { user, profile, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<StaffSearchHit[]>([]);

  const canAccess = (path: string) =>
    !!permissions && (permissions.includes('*') || permissions.includes(path));

  const kindLabel = useCallback(
    (type: string) => {
      const key = `searchKind_${type}`;
      const translated = t(key);
      return translated === key ? type : translated;
    },
    [t]
  );

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      toast.error(t('searchQueryTooShort'));
      return;
    }
    if (q.length > 80) {
      toast.error(t('searchQueryTooLong'));
      return;
    }
    setSearchLoading(true);
    setSearchOpen(true);
    try {
      const url = new URL('/api/search', window.location.origin);
      url.searchParams.set('q', q);
      const res = await authFetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        if (msg === 'searchQueryTooShort' || msg === 'searchQueryTooLong') toast.error(t(msg));
        else toast.error(t('searchFailed'));
        setSearchResults([]);
        return;
      }
      const data = await parseJsonResponse<{ results: StaffSearchHit[] }>(res);
      setSearchResults(data.results ?? []);
    } catch {
      toast.error(t('searchFailed'));
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, t]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [searchOpen]);

  const onHitNavigate = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  return (
    <header className={clsx(
      "h-20 glass fixed top-0 z-40 flex items-center justify-between px-4 md:px-8 transition-all duration-300",
      isPublic || !staffSidebarLayout
        ? "left-0 right-0"
        : (isRTL ? "lg:right-64 left-0" : "lg:left-64 right-0")
    )}>
        <div className="flex items-center gap-4 flex-1">
          {!isPublic && showNavMenu && (
            <button 
              onClick={onMenuClick}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}

          {isPublic && (
            <Link to="/" className="flex items-center group shrink-0" aria-label="Bella Dolce">
              <div className={clsx(BRAND_LOGO_CHIP_CLASS, 'transition-transform group-hover:scale-105')}>
                <BrandLogo imgClassName={BRAND_LOGO_MARK_IMG_CLASS} />
              </div>
            </Link>
          )}

          {!isPublic && (
            <div ref={searchWrapRef} className="relative max-w-md w-full min-w-0 hidden sm:block ms-4">
              <Search
                className={clsx(
                  'absolute top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none z-10',
                  isRTL ? 'right-4' : 'left-4'
                )}
              />
              <input
                type="search"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={searchOpen}
                aria-controls="staff-search-results"
                title={t('searchHintEnter')}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runSearch();
                  }
                  if (e.key === 'Escape') {
                    setSearchOpen(false);
                  }
                }}
                className={clsx(
                  'w-full py-2.5 bg-slate-100/50 dark:bg-zinc-900/50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm',
                  isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'
                )}
              />
              {searchOpen && (
                <div
                  id="staff-search-results"
                  role="listbox"
                  className={clsx(
                    'absolute top-full mt-1 w-full min-w-[280px] max-h-[min(70vh,24rem)] overflow-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl z-50 py-2'
                  )}
                >
                  {searchLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-slate-500 dark:text-slate-400 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('searchNoResults')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-white/5">
                      {searchResults.map((hit) => (
                        <li key={`${hit.type}-${hit.id}`} role="option">
                          <button
                            type="button"
                            className="w-full text-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onHitNavigate(hit.path)}
                          >
                            <span className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                              {kindLabel(hit.type)}
                            </span>
                            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                              {hit.label}
                            </p>
                            {hit.subtitle ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {hit.subtitle}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
          className="btn-secondary gap-2"
        >
          <Globe className="w-4 h-4" />
          <span
            className={clsx('text-sm font-semibold', language === 'fr' && 'font-arabic')}
          >
            {language === 'fr' ? 'عربي' : 'FR'}
          </span>
        </button>

        {user && canAccess('/dashboard') && (
          <button
            onClick={() => navigate('/dashboard')}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
            title="Dashboard"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
        )}

        {user && canAccess('/settings') && (
          <button
            onClick={() => navigate('/settings')}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        )}

        <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 mx-2"></div>

        {user ? (
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{profile?.name || 'Bella Dolce'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{profile?.role ? t(profile.role) : 'Paris, FR'}</p>
              {!showNavMenu && (
                <button
                  onClick={logout}
                  className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium mt-0.5 flex items-center gap-1 ml-auto"
                >
                  <LogOut className="w-3 h-3" />
                  {t('logout')}
                </button>
              )}
            </div>
            {(canAccess('/settings') || canAccess('*')) && (
              <button
                onClick={() => navigate('/settings')}
                className="w-11 h-11 rounded-2xl bg-primary-50 dark:bg-zinc-900 flex items-center justify-center text-primary-600 border border-primary-100 dark:border-white/10 hover:scale-105 transition-all"
              >
                <User className="w-6 h-6" />
              </button>
            )}
            {!showNavMenu && !(canAccess('/settings') || canAccess('*')) && (
              <button
                onClick={logout}
                className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-zinc-900 flex items-center justify-center text-red-500 border border-red-100 dark:border-white/10 hover:scale-105 transition-all"
                title={t('logout')}
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="btn-primary gap-2"
          >
            <User className="w-4 h-4" />
            <span>{t('login')}</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TopBar;
