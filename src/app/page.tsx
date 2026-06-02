"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOfflineAuth } from "@/components/offline-auth-provider";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useOfflineAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Add a small delay to prevent immediate redirect loops
        const timeout = setTimeout(() => {
          if (user.role === 'admin') {
            router.replace("/admin");
          } else {
            router.replace("/dashboard");
          }
        }, 100);
        
        return () => clearTimeout(timeout);
      } else {
        // Not authenticated, go to login
        const timeout = setTimeout(() => {
          router.replace("/login");
        }, 100);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [isAuthenticated, user, isLoading, router]);

  // Show loading while determining redirect
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
        <div className="space-y-2">
          <p className="text-gray-600 text-sm font-medium">Loading Sales Tracker</p>
          <p className="text-gray-400 text-xs">
            {isLoading ? 'Checking authentication...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    </div>
  );
}
