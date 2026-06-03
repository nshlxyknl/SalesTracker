"use client";

import { useSession } from "@/components/offline-auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthLoading } from "./auth-loading";

interface AuthGuardProps {
  children: React.ReactNode;
  requireRole?: 'admin' | 'user';
  redirectTo?: string;
}

export function AuthGuard({ children, requireRole, redirectTo = '/login' }: AuthGuardProps) {
  const { data, isPending } = useSession();
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

  if (!data?.user) {
    return null; // Will redirect in useEffect
  }

  if (requireRole && data.user.role !== requireRole) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}