"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { RoleBasedNav } from "@/components/navigation/RoleBasedNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard requiredPermissions={['view_dashboard']} fallbackRoute="/dashboard">
      <RoleBasedNav>
        {children}
      </RoleBasedNav>
    </RoleGuard>
  );
}
