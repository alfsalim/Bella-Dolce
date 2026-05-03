import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { APP_VERSION } from '../constants';
import { getFilteredNavItems } from '../lib/staff-nav';

import { motion, AnimatePresence } from 'motion/react';

import BilingualLabel from './BilingualLabel';
import BrandLogo, { BRAND_LOGO_MARK_IMG_CLASS, BrandWordmark } from './BrandLogo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isRTL } = useLanguage();
  const { logout, permissions } = useAuth();

  const filteredNavItems = getFilteredNavItems(permissions);

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={clsx(
        "w-64 h-screen bg-logo-light-canvas dark:bg-logo-dark-canvas text-slate-500 dark:text-slate-400 flex flex-col fixed top-0 z-50 transition-all duration-300 border-r border-black/[0.06] dark:border-white/10",
        isRTL ? "right-0" : "left-0",
        isOpen ? "translate-x-0" : (isRTL ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0")
      )}>
        <Link 
          to="/" 
          onClick={onClose}
          className="p-6 flex flex-col items-center gap-2 border-b border-black/[0.06] dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-all"
        >
          <BrandLogo imgClassName={BRAND_LOGO_MARK_IMG_CLASS} />
          <BrandWordmark />
        </Link>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" 
                  : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx("w-5 h-5", isActive ? "text-white" : "text-slate-400 group-hover:text-primary-600")} />
                  <BilingualLabel tKey={item.tKey} className="font-medium" />
                </>
              )}
            </NavLink>
          ))}
        </nav>

      <div className="p-4 mt-auto border-t border-black/[0.06] dark:border-white/10">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <BilingualLabel tKey="logout" className="font-medium" />
        </button>
        <div className="mt-4 px-4 text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest">
          Version {APP_VERSION}
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
