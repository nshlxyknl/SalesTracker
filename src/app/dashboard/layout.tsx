"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { RoleBasedNav } from "@/components/navigation/RoleBasedNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard requiredPermissions={['user_access']} fallbackRoute="/admin">
      <RoleBasedNav showSidebar={false}>
        {children}
      </RoleBasedNav>
    </RoleGuard>
  );
}