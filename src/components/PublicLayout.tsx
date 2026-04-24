import React from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import { useLanguage } from '../contexts/LanguageContext';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

const PublicLayout: React.FC = () => {
  const { isRTL } = useLanguage();

  return (
    <div className={clsx("min-h-screen bg-white flex flex-col overflow-x-hidden", isRTL ? "text-right" : "text-left")}>
      <TopBar onMenuClick={() => {}} isPublic />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={window.location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default PublicLayout;
