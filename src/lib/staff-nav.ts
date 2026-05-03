import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ChefHat,
  Package,
  Truck,
  Users,
  ShoppingCart,
  ClipboardList,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-react';
export type AppNavItem = {
  path: string;
  tKey: string;
  icon: LucideIcon;
};

/** Canonical staff sidebar nav: order must match UX priority for default landing paths. */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { icon: LayoutDashboard, tKey: 'dashboard', path: '/dashboard' },
  { icon: ChefHat, tKey: 'production', path: '/production' },
  { icon: Package, tKey: 'inventory', path: '/inventory' },
  { icon: Truck, tKey: 'procurementAndSuppliers', path: '/procurement' },
  { icon: Users, tKey: 'customers', path: '/customers' },
  { icon: ChefHat, tKey: 'recipesAndProducts', path: '/product-management' },
  { icon: ShoppingCart, tKey: 'pos', path: '/pos' },
  { icon: ShoppingCart, tKey: 'businessStore', path: '/b2b' },
  { icon: ClipboardList, tKey: 'orders', path: '/orders' },
  { icon: Wallet, tKey: 'finance', path: '/finance' },
  { icon: BarChart3, tKey: 'reports', path: '/reports' },
  { icon: Settings, tKey: 'settings', path: '/settings' },
];

const CUSTOMER_ROLES = ['customer_business', 'customer_customers'];

export function isStaffRole(role: string | undefined | null): boolean {
  return !!role && !CUSTOMER_ROLES.includes(role);
}

export function getFilteredNavItems(permissions: string[] | null): AppNavItem[] {
  if (!permissions) return [];
  if (permissions.includes('*')) return [...APP_NAV_ITEMS];
  return APP_NAV_ITEMS.filter((item) => permissions.includes(item.path));
}

/** Whether the current path is allowed for this user's permission paths (incl. common sub-routes). */
export function pathnameAllowedForStaffPermissions(pathname: string, permissions: string[] | null): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  for (const p of permissions) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  if (pathname.startsWith('/products/') && permissions.includes('/product-management')) return true;
  return false;
}

/**
 * Returns the first allowed nav item path for this user, respecting whatever
 * the admin configured in rolePermissions (no hardcoded role preferences).
 * Admin always lands on /dashboard.
 */
/**
 * Returns the first allowed nav-item path for this user.
 * Returns null when the user has no permitted nav items (caller decides what to show).
 */
export function getDefaultStaffLoginPath(permissions: string[] | null): string | null {
  if (permissions?.includes('*')) return '/dashboard';
  const filtered = getFilteredNavItems(permissions);
  return filtered.length > 0 ? filtered[0].path : null;
}
