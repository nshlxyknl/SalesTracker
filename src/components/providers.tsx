"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { SerwistProvider } from "@/components/serwist-provider";
import { PWAProvider } from "./pwa-provider";
import { OfflineAuthProvider } from "./offline-auth-provider";
import { SyncProvider } from "./sync-provider";
import queryClient from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js">
      <QueryClientProvider client={queryClient}>
        <OfflineAuthProvider>
          <SyncProvider>
            <PWAProvider>
              {children}
            </PWAProvider>
          </SyncProvider>
        </OfflineAuthProvider>
      </QueryClientProvider>
    </SerwistProvider>
  );
}
