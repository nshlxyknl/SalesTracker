"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { canAccessRoute, getDefaultRoute, Permission, hasAnyPermission } from '@/lib/rbac';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  fallbackRoute?: string;
  showLoading?: boolean;
}

/**
 * RoleGuard component that protects routes based on user permissions
 */
export function RoleGuard({ 
  children, 
  requiredPermissions = [], 
  fallbackRoute,
  showLoading = true 
}: RoleGuardProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending) return; // Still loading session

    if (!session?.user) {
      // Not authenticated, redirect to login
      router.push('/login');
      return;
    }

    // Check if user has required permissions
    if (requiredPermissions.length > 0 && !hasAnyPermission(session.user, requiredPermissions)) {
      // User doesn't have required permissions
      const redirectRoute = fallbackRoute || getDefaultRoute(session.user);
      router.push(redirectRoute);
      return;
    }
  }, [session, isPending, router, requiredPermissions, fallbackRoute]);

  // Show loading state while checking authentication
  if (isPending) {
    if (!showLoading) return null;
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session?.user) {
    return null; // Will redirect in useEffect
  }

  // Check permissions
  if (requiredPermissions.length > 0 && !hasAnyPermission(session.user, requiredPermissions)) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}

/**
 * Higher-order component for protecting pages with role-based access
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions?: Permission[],
  fallbackRoute?: string
) {
  return function ProtectedComponent(props: P) {
    return (
      <RoleGuard 
        requiredPermissions={requiredPermissions} 
        fallbackRoute={fallbackRoute}
      >
        <Component {...props} />
      </RoleGuard>
    );
  };
}

/**
 * Hook for checking permissions in components
 */
export function usePermissions() {
  const { data: session } = useSession();
  
  return {
    user: session?.user || null,
    hasPermission: (permission: Permission) => hasAnyPermission(session?.user || null, [permission]),
    hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(session?.user || null, permissions),
    canAccessRoute: (route: string) => canAccessRoute(session?.user || null, route),
  };
}