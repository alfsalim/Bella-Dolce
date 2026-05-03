import React from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  getFilteredNavItems,
  pathnameAllowedForStaffPermissions,
} from '../lib/staff-nav';

const Layout: React.FC = () => {
  const { user, loading, permissions } = useAuth();
  const { isRTL } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNavItems = React.useMemo(
    () => getFilteredNavItems(permissions),
    [permissions]
  );
  const showMultiNav = filteredNavItems.length > 1;

  const spinner = (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-900">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (loading) return spinner;
  if (!user) return <Navigate to="/login" replace />;

  // Keep showing the spinner until permissions are actually resolved.
  // `permissions === null` means initAuth hasn't finished setting them yet,
  // even if the `loading` flag has already been cleared.
  if (permissions === null) return spinner;

  // Synchronously compute whether the current path is accessible.
  // permissions is guaranteed non-null here — safe to call .includes().
  const pathAllowed =
    permissions.includes('*') ||
    pathnameAllowedForStaffPermissions(location.pathname, permissions);

  const redirectTarget =
    !pathAllowed && filteredNavItems.length > 0 ? filteredNavItems[0]!.path : null;

  // Block the page from rendering (and firing API calls) until we redirect.
  if (redirectTarget) return <Navigate to={redirectTarget} replace />;

  // No valid destinations and path is forbidden → force re-authentication.
  if (!pathAllowed && filteredNavItems.length === 0) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={clsx("min-h-screen bg-slate-50 dark:bg-zinc-900 flex overflow-x-hidden", isRTL ? "flex-row-reverse" : "flex-row")}>
      {showMultiNav && (
        <div className="print:hidden">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>
      )}
      <div className={clsx(
        "flex-1 flex flex-col transition-all duration-300 min-w-0",
        showMultiNav &&
          (isRTL ? (sidebarOpen ? "mr-0" : "lg:mr-64") : (sidebarOpen ? "ml-0" : "lg:ml-64"))
      )}>
        <div className="print:hidden">
          <TopBar
            onMenuClick={() => setSidebarOpen(true)}
            staffSidebarLayout={showMultiNav}
            showNavMenu={showMultiNav}
          />
        </div>
        <main className="pt-28 pb-12 px-4 md:px-8 flex-1 print:pt-0 print:pb-0 print:px-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="max-w-7xl mx-auto w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Layout;
