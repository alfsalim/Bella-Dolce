import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-xl bg-white dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-[#2a1e17] transition-all shadow-sm"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={clsx(
              "w-10 h-10 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center",
              currentPage === page
                ? "bg-primary-600 text-white shadow-primary-200 dark:shadow-primary-900/20"
                : "bg-white dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#2a1e17]"
            )}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-xl bg-white dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-[#2a1e17] transition-all shadow-sm"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Pagination;
