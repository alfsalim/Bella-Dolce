import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ChefHat, 
  Package, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Settings,
  LogOut,
  Home,
  Store,
  ClipboardList,
  Wallet,
  Sparkles,
  Truck
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { APP_VERSION } from '../constants';

import { motion, AnimatePresence } from 'motion/react';

import BilingualLabel from './BilingualLabel';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { t, isRTL } = useLanguage();
  const { logout, profile, permissions } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, tKey: 'dashboard', path: '/dashboard' },
    { icon: Sparkles, tKey: 'aiManager', path: '/ai-manager' },
    { icon: ChefHat, tKey: 'production', path: '/production' },
    { icon: Package, tKey: 'inventory', path: '/inventory' },
    { icon: Truck, tKey: 'suppliers', path: '/suppliers' },
    { icon: Users, tKey: 'customers', path: '/customers' },
    { icon: ChefHat, tKey: 'recipesAndProducts', path: '/product-management' },
    { icon: ShoppingCart, tKey: 'pos', path: '/pos' },
    { icon: ShoppingCart, tKey: 'businessStore', path: '/b2b' },
    { icon: ClipboardList, tKey: 'orders', path: '/orders' },
    { icon: Store, tKey: 'delivery', path: '/delivery' },
    { icon: Wallet, tKey: 'finance', path: '/finance' },
    { icon: Users, tKey: 'users', path: '/users' },
    { icon: BarChart3, tKey: 'reports', path: '/reports' },
    { icon: Settings, tKey: 'settings', path: '/settings' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!permissions) return false;
    if (permissions.includes('*')) return true;
    return permissions.includes(item.path);
  });

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
        "w-64 h-screen bg-white dark:bg-zinc-900 text-slate-500 dark:text-slate-400 flex flex-col fixed top-0 z-50 transition-all duration-300 border-r border-slate-100 dark:border-white/10",
        isRTL ? "right-0" : "left-0",
        isOpen ? "translate-x-0" : (isRTL ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0")
      )}>
        <Link 
          to="/" 
          onClick={onClose}
          className="p-6 flex items-center gap-3 border-b border-slate-50 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
        >
          <img 
            src="/logo.jpg" 
            alt="Bella Dolce" 
            className="w-10 h-10 rounded-xl object-cover" 
            referrerPolicy="no-referrer" 
          />
          <span className="font-display font-bold text-xl text-slate-900 dark:text-white tracking-tight">
            Bella Dolce
          </span>
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
                  : "hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white"
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

      <div className="p-4 mt-auto border-t border-slate-50 dark:border-white/10">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-10 h-10 bg-primary-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-primary-600 font-bold border border-primary-100 dark:border-white/10">
            {profile?.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">{profile?.role}</p>
          </div>
        </div>
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
