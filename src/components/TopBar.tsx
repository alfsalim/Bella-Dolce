import React from 'react';
import { Search, Bell, Globe, Menu, ChefHat, User, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { Link, useNavigate } from 'react-router-dom';

interface TopBarProps {
  onMenuClick: () => void;
  isPublic?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuClick, isPublic }) => {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  return (
    <header className={clsx(
      "h-20 glass fixed top-0 z-40 flex items-center justify-between px-4 md:px-8 transition-all duration-300",
      isPublic ? "left-0 right-0" : (isRTL ? "lg:right-64 left-0" : "lg:left-64 right-0")
    )}>
        <div className="flex items-center gap-4 flex-1">
          {!isPublic && (
            <button 
              onClick={onMenuClick}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          
          <Link to="/" className="flex items-center group lg:hidden">
            <div className="w-32 h-12 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-all">
              <img 
                src="/logo.jpg" 
                alt="Bella Dolce" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer" 
              />
            </div>
          </Link>
          
          <div className="relative max-w-md w-full hidden sm:block ml-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('search')}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-100/50 dark:bg-zinc-900/50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
          className="btn-secondary gap-2"
        >
          <Globe className="w-4 h-4" />
          <span className="text-sm font-semibold uppercase">{language}</span>
        </button>

        {user && (
          <>
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              title="Dashboard"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>

            <button 
              onClick={() => navigate('/settings')}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </>
        )}

        <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 mx-2"></div>

        {user ? (
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{profile?.name || 'Bella Dolce'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{profile?.role || 'Paris, FR'}</p>
            </div>
            <button 
              onClick={() => navigate('/settings')}
              className="w-11 h-11 rounded-2xl bg-primary-50 dark:bg-zinc-900 flex items-center justify-center text-primary-600 border border-primary-100 dark:border-white/10 hover:scale-105 transition-all"
            >
              <User className="w-6 h-6" />
            </button>
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
