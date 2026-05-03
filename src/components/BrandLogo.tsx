import React from 'react';
import { clsx } from 'clsx';

/** Theme logos + canvas fills in `index.css` (`--color-logo-light-canvas`, `--color-logo-dark-canvas`), sampled from the JPEGs. */
export const LOGO_DARK_THEME_SRC = '/logo.jpg';
export const LOGO_LIGHT_THEME_SRC = '/logo-light.jpg';

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
