import React from 'react';
import { clsx } from 'clsx';

/** Theme logos + canvas fills in `index.css` (`--color-logo-light-canvas`, `--color-logo-dark-canvas`), sampled from the JPEGs. */
export const LOGO_DARK_THEME_SRC = '/logo.jpg';
export const LOGO_LIGHT_THEME_SRC = '/logo-light.jpg';

/** Same mark sizing everywhere: admin sidebar, public TopBar, landing hero */
export const BRAND_LOGO_MARK_IMG_CLASS =
  'w-12 h-12 shrink-0 rounded-xl object-contain dark:bg-transparent';

/** Chip behind the mark on non-canvas surfaces (TopBar glass, landing hero) — matches logo JPEG background tokens */
export const BRAND_LOGO_CHIP_CLASS =
  'rounded-xl bg-logo-light-canvas dark:bg-logo-dark-canvas p-2 border border-black/[0.06] dark:border-white/10 shadow-sm';

export const BRAND_WORDMARK_SRC = '/bella-dolce-wordmark.svg';
export const BRAND_WORDMARK_WHITE_BG_SRC = '/bella-dolce-wordmark-on-white.svg';

/** Gold script wordmark (SVG paths from Great Vibes via `npm run wordmark`). */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_WORDMARK_SRC}
      alt="Bella Dolce"
      className={clsx(
        'h-8 sm:h-9 w-auto max-w-[min(100%,13.5rem)] object-contain object-center select-none',
        '[filter:drop-shadow(0_1px_2px_rgba(45,35,15,0.25))]',
        className
      )}
    />
  );
}

interface BrandLogoProps {
  /** Applied to both stacked images */
  imgClassName?: string;
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ imgClassName, className }) => (
  <span className={clsx('relative inline-flex items-center justify-center', className)}>
    <img
      src={LOGO_LIGHT_THEME_SRC}
      alt="Bella Dolce"
      className={clsx(imgClassName, 'dark:hidden')}
      referrerPolicy="no-referrer"
    />
    <img
      src={LOGO_DARK_THEME_SRC}
      alt="Bella Dolce"
      className={clsx(imgClassName, 'hidden dark:block')}
      referrerPolicy="no-referrer"
    />
  </span>
);

export default BrandLogo;
