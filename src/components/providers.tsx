"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth-client";
import { PWAProvider } from "./pwa-provider";
import { SyncProvider } from "./sync-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PWAProvider>
          <SyncProvider>
            {children}
          </SyncProvider>
        </PWAProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
