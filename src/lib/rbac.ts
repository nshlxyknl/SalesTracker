import { User } from './auth';

// Define user roles
export type UserRole = 'admin' | 'user';

// Define permissions
export type Permission = 
  | 'view_dashboard'
  | 'create_sale'
  | 'view_own_sales'
  | 'view_all_sales'
  | 'manage_van_stock'
  | 'view_reconciliation'
  | 'create_reconciliation'
  | 'export_reports'
  | 'manage_users'
  | 'upload_bills'
  | 'view_bill_submissions'
  | 'admin_access'
  | 'user_access'
  | 'manage_reconciliation_reports'
  | 'view_sync_operations';

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_dashboard',
    'create_sale',
    'view_own_sales',
    'view_all_sales',
    'manage_van_stock',
    'view_reconciliation',
    'create_reconciliation',
    'export_reports',
    'manage_users',
    'view_bill_submissions',
    'admin_access',
    'manage_reconciliation_reports',
    'view_sync_operations',
  ],
  user: [
    'view_dashboard',
    'create_sale',
    'view_own_sales',
    'upload_bills',
    'user_access',
  ],
};

// Navigation items based on roles
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  requiredPermissions: Permission[];
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: 'LayoutDashboard',
    requiredPermissions: ['view_dashboard'],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: 'TrendingUp',
    requiredPermissions: ['view_all_sales'],
  },
  {
    label: 'Van Stock',
    href: '/admin/van-stock',
    icon: 'Truck',
    requiredPermissions: ['manage_van_stock'],
  },
  {
    label: 'Sales',
    href: '/admin/sales',
    icon: 'ShoppingCart',
    requiredPermissions: ['view_all_sales'],
  },
  {
    label: 'Stock Reconciliation',
    href: '/admin/stock-reconciliation',
    icon: 'Calculator',
    requiredPermissions: ['view_reconciliation', 'create_reconciliation'],
  },
  {
    label: 'Export Reports',
    href: '/admin/export',
    icon: 'Download',
    requiredPermissions: ['export_reports'],
  },
];

export const USER_NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    requiredPermissions: ['view_dashboard'],
  },
];

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  
  const userRole = user.role as UserRole;
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  
  return permissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  if (!user || permissions.length === 0) return false;
  
  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  if (!user || permissions.length === 0) return false;
  
  return permissions.every(permission => hasPermission(user, permission));
}

/**
 * Get navigation items for a user based on their role and permissions
 */
export function getNavItemsForUser(user: User | null): NavItem[] {
  if (!user) return [];
  
  const userRole = user.role as UserRole;
  
  if (userRole === 'admin') {
    return ADMIN_NAV_ITEMS.filter(item => 
      hasAnyPermission(user, item.requiredPermissions)
    );
  }
  
  return USER_NAV_ITEMS.filter(item => 
    hasAnyPermission(user, item.requiredPermissions)
  );
}

/**
 * Check if a user can access a specific route
 */
export function canAccessRoute(user: User | null, route: string): boolean {
  if (!user) return false;
  
  const userRole = user.role as UserRole;
  
  // Admin routes
  if (route.startsWith('/admin')) {
    return userRole === 'admin';
  }
  
  // User routes
  if (route.startsWith('/dashboard')) {
    return userRole === 'user' || userRole === 'admin';
  }
  
  // API routes
  if (route.startsWith('/api/admin')) {
    return userRole === 'admin';
  }
  
  if (route.startsWith('/api/sales') || route.startsWith('/api/bill-submissions')) {
    return userRole === 'user' || userRole === 'admin';
  }
  
  if (route.startsWith('/api/van-loads') || route.startsWith('/api/reconciliation')) {
    return userRole === 'admin';
  }
  
  return true; // Allow access to other routes by default
}

/**
 * Get the default redirect route for a user based on their role
 */
export function getDefaultRoute(user: User | null): string {
  if (!user) return '/login';
  
  const userRole = user.role as UserRole;
  
  switch (userRole) {
    case 'admin':
      return '/admin';
    case 'user':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}

/**
 * Validate user role and ensure it's a valid role
 */
export function isValidRole(role: string): role is UserRole {
  return role === 'admin' || role === 'user';
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}