import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

const Layout: React.FC = () => {
  const { user, loading } = useAuth();
  const { isRTL } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user && !loading) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={clsx("min-h-screen bg-slate-50 dark:bg-black flex overflow-x-hidden", isRTL ? "flex-row-reverse" : "flex-row")}>
      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
      <div className={clsx(
        "flex-1 flex flex-col transition-all duration-300 min-w-0",
        isRTL ? (sidebarOpen ? "mr-0" : "lg:mr-64") : (sidebarOpen ? "ml-0" : "lg:ml-64")
      )}>
        <div className="print:hidden">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
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
