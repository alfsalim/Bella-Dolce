import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Inline footer row (e.g. report tables): no extra top margin, don’t shrink in flex. */
  variant?: 'default' | 'footer';
}

function visiblePageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const s = new Set<number>();
  s.add(1);
  s.add(total);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) s.add(p);
  }
  const sorted = [...s].sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  variant = 'default',
}) => {
  if (totalPages <= 1) return null;

  const pages = visiblePageList(currentPage, totalPages);

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-2 flex-wrap',
        variant === 'footer' ? 'mt-0 flex-shrink-0' : 'mt-8'
      )}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-xl bg-white dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-[#2a1e17] transition-all shadow-sm"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1">
        {pages.map((page, idx) =>
          page === 'ellipsis' ? (
            <span
              key={`e-${idx}`}
              className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-sm select-none"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={clsx(
                'w-10 h-10 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center',
                currentPage === page
                  ? 'bg-primary-600 text-white shadow-primary-200 dark:shadow-primary-900/20'
                  : 'bg-white dark:bg-[#1a1512] border border-slate-200 dark:border-[#2a1e17] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#2a1e17]'
              )}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        type="button"
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
