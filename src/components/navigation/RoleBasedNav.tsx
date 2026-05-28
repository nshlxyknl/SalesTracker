"use client";

import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  BarChart3, 
  LayoutDashboard, 
  Truck, 
  LogOut, 
  ShoppingCart, 
  Calculator, 
  Download,
  ShieldCheck,
  User as UserIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItemsForUser, getDefaultRoute } from "@/lib/rbac";

// Icon mapping for dynamic icon rendering
const ICON_MAP = {
  LayoutDashboard,
  Truck,
  ShoppingCart,
  Calculator,
  Download,
  ShieldCheck,
  UserIcon,
} as const;

interface RoleBasedNavProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function RoleBasedNav({ children, showSidebar = true }: RoleBasedNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session?.user) {
    return <>{children}</>;
  }

  const user = session.user;
  const navItems = getNavItemsForUser(user);
  const isAdmin = user.role === 'admin';
  const userName = user.username || "User";
  const userInitials = userName.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleRoleSwitch = () => {
    const defaultRoute = getDefaultRoute(user);
    router.push(defaultRoute);
  };

  if (!showSidebar) {
    // Simple top navigation for mobile or minimal layouts
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Sales Tracker</span>
            {isAdmin && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Admin
              </span>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar>
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{userName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Role switching for admins */}
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <UserIcon className="w-4 h-4 mr-2" /> 
                    User View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/admin')}>
                    <ShieldCheck className="w-4 h-4 mr-2" /> 
                    Admin Panel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" /> 
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  // Full sidebar layout for desktop
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">Sales Tracker</p>
            <p className="text-xs text-gray-400 capitalize">
              {isAdmin ? 'Admin' : 'User'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const IconComponent = ICON_MAP[item.icon as keyof typeof ICON_MAP] || LayoutDashboard;
            
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <IconComponent className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="px-3 py-4 border-t border-gray-100">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full focus:outline-none">
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                  <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48 mb-1">
              <DropdownMenuLabel>{userName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Role switching for admins */}
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <UserIcon className="w-4 h-4 mr-2" /> 
                    User View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/admin')}>
                    <ShieldCheck className="w-4 h-4 mr-2" /> 
                    Admin Panel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" /> 
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen">
        {children}
      </main>
    </div>
  );
}