"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthLoading } from "./auth-loading";

interface AuthGuardProps {
  children: React.ReactNode;
  requireRole?: 'admin' | 'user';
  redirectTo?: string;
}

export function AuthGuard({ children, requireRole, redirectTo = '/login' }: AuthGuardProps) {
  const { data, isPending, error } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending) {
      if (!data?.user) {
        router.push(redirectTo);
        return;
      }

      if (requireRole && data.user.role !== requireRole) {
        // Redirect based on user role
        if (data.user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
        return;
      }
    }
  }, [data, isPending, router, requireRole, redirectTo]);

  if (isPending) {
    return <AuthLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!data?.user) {
    return null; // Will redirect in useEffect
  }

  if (requireRole && data.user.role !== requireRole) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}