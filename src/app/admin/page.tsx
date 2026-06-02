"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Users, BarChart3, Package, Settings, Menu, X } from "lucide-react";
import QuickExportDropdown from "@/components/quick-export-dropdown";
import { formatCaseBottleDisplay, getItemByName } from "@/app/lib/items";

type Sale = {
  id: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64: string | null;
  createdAt: string;
  user: { username: string };
};

type Bill = {
  billNumber: string;
  billTitle: string;
  user: { username: string };
  paymentMethod: string;
  billTotal: number;
  billImageBase64: string | null;
  createdAt: string;
  items: Sale[];
};

type UserStats = {
  name: string;
  total: number;
  count: number;
};

type VanLoad = {
  id: string;
  itemName: string;
  loaded: number;
  returned: number;
  userId: string;
  date: string;
  user: { username: string };
};

type UserStockSummary = {
  itemName: string;
  loaded: number;
  sold: number;
  remaining: number;
  returned: number;
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  credit: "bg-purple-100 text-purple-700",
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

async function fetchSales(): Promise<Sale[]> {
  const res = await fetch("/api/sales");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchUsers(): Promise<{ id: string; username: string }[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

function groupIntoBills(sales: Sale[]): Bill[] {
  const map = new Map<string, Bill>();
  for (const sale of sales) {
    const key = sale.billNumber || sale.id;
    if (!map.has(key)) {
      map.set(key, {
        billNumber: sale.billNumber || sale.id,
        billTitle: sale.billTitle || "Untitled Bill",
        user: sale.user ?? { name: "Unknown", email: "" },
        paymentMethod: sale.paymentMethod,
        billTotal: 0,
        billImageBase64: sale.billImageBase64,
        createdAt: sale.createdAt,
        items: [],
      });
    }
    const bill = map.get(key)!;
    bill.billTotal += sale.totalAmount;
    bill.items.push(sale);
  }
  return Array.from(map.values());
}

function UserStockDisplay({ username, date }: { username: string; date: string }) {
  const { data: session } = useSession();

  // Fetch user data
  const { data: user } = useQuery<{ id: string; username: string }>({
    queryKey: ["user-by-username", username],
    queryFn: async () => {
      const res = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: !!username && session?.user?.role === "admin",
  });

  // Fetch van loads for today
  const { data: vanLoads = [], isLoading: loadingLoads } = useQuery<VanLoad[]>({
    queryKey: ["van-loads-user-stock", user?.id, date],
    queryFn: async () => {
      const res = await fetch(`/api/admin/van-loads?userId=${user?.id}&date=${date}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && session?.user?.role === "admin",
  });

  // Fetch sales for today
  const { data: sales = [], isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ["sales-user-stock", user?.id, date],
    queryFn: async () => {
      const res = await fetch(`/api/sales?userId=${user?.id}&date=${date}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && session?.user?.role === "admin",
  });

  // Calculate stock summary
  const stockSummary: UserStockSummary[] = (() => {
    const stockMap = new Map<string, UserStockSummary>();
    
    // Process loads
    vanLoads.forEach(load => {
      const key = load.itemName;
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          itemName: key,
          loaded: 0,
          sold: 0,
          remaining: 0,
          returned: 0
        });
      }
      const item = stockMap.get(key)!;
      item.loaded += load.loaded;
      item.returned += load.returned;
    });
    
    // Process sales
    sales.forEach(sale => {
      const key = sale.itemName;
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          itemName: key,
          loaded: 0,
          sold: 0,
          remaining: 0,
          returned: 0
        });
      }
      const item = stockMap.get(key)!;
      item.sold += sale.quantity;
    });
    
    // Calculate remaining
    return Array.from(stockMap.values()).map(item => {
      item.remaining = item.loaded - item.sold - item.returned;
      return item;
    });
  })();

  if (loadingLoads || loadingSales) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (stockSummary.length === 0) {
    return (
      <div className="text-center py-6">
        <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 mb-1">No stock assigned for {date}</p>
        <p className="text-xs text-gray-400">Stock will appear here once assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stockSummary.map(item => {
        const itemConfig = getItemByName(item.itemName);
        const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
        
        return (
          <div key={item.itemName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
              <p className="text-xs text-gray-500">
                Loaded: {formatCaseBottleDisplay(item.loaded, bottlesPerCase)} • 
                Sold: {formatCaseBottleDisplay(item.sold, bottlesPerCase)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${
                item.remaining >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatCaseBottleDisplay(item.remaining, bottlesPerCase)}
              </p>
              <p className="text-xs text-gray-400">remaining</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const [billModal, setBillModal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stockDate, setStockDate] = useState(() => toDateStr(new Date()));

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-admin"],
    queryFn: fetchSales,
    enabled: session?.user?.role === "admin",
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users-admin"],
    queryFn: fetchUsers,
    enabled: session?.user?.role === "admin",
  });

  if (isPending || !session?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (session.user.role !== "admin") {
    return null;
  }

  const bills = groupIntoBills(sales);

  // Filter sales and bills by selected user
  const filteredSales = selectedUser ? sales.filter(s => s.user.username === selectedUser) : sales;
  const filteredBills = selectedUser ? bills.filter(b => b.user.username === selectedUser) : bills;

  const filtered = filteredBills.filter((b) => {
    const matchSearch =
      (b.billNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (b.billTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (b.user?.username ?? "").toLowerCase().includes(search.toLowerCase()) ||
      b.items.some((i) => (i.itemName ?? "").toLowerCase().includes(search.toLowerCase()));
    const matchPayment = filterPayment === "all" || b.paymentMethod === filterPayment;
    return matchSearch && matchPayment;
  });

  const totalRevenue = filteredSales.reduce((a, s) => a + s.totalAmount, 0);
  const byCash = filteredSales.filter((s) => s.paymentMethod === "cash").reduce((a, s) => a + s.totalAmount, 0);
  const byCheque = filteredSales.filter((s) => s.paymentMethod === "cheque").reduce((a, s) => a + s.totalAmount, 0);
  const byCredit = filteredSales.filter((s) => s.paymentMethod === "credit").reduce((a, s) => a + s.totalAmount, 0);

  const byUser = users.map(user => {
    const userSales = sales.filter(s => s.user.username === user.username);
    const total = userSales.reduce((sum, s) => sum + s.totalAmount, 0);
    return {
      name: user.username,
      total,
      count: userSales.length
    };
  }).sort((a, b) => b.total - a.total);

  function toggleExpand(billNumber: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(billNumber) ? next.delete(billNumber) : next.add(billNumber);
      return next;
    });
  }

  const handleUserSelect = (username: string) => {
    setSelectedUser(selectedUser === username ? null : username);
    setSearch(""); // Clear search when switching users
    setFilterPayment("all"); // Reset payment filter
  };

  const handleUserPanelAccess = (username: string, tab: string) => {
    router.push(`/admin/user-panel/${encodeURIComponent(username)}?tab=${tab}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'md:w-16' : 'md:w-80'} w-80 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 fixed inset-y-0 left-0 z-30 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-3">
            {!sidebarCollapsed && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Users</h2>
                <p className="text-sm text-gray-600">Select a user to view their dashboard</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:inline-flex p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Users className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* All Users Option */}
        <div className="p-2">
          <button
            onClick={() => {
              setSelectedUser(null);
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
              selectedUser === null 
                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <div className="w-10 h-10 bg-linear-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">All Users</p>
                <p className="text-sm text-gray-500">Complete overview</p>
              </div>
            )}
          </button>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading || loadingUsers ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                {!sidebarCollapsed && (
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                )}
              </div>
            ))
          ) : byUser.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No users found</p>
            </div>
          ) : (
            byUser.map((user) => (
              <div key={user.name} className="space-y-1">
                <button
                  onClick={() => {
                    handleUserSelect(user.name);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    selectedUser === user.name 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="w-10 h-10 bg-linear-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-sm text-gray-500">
                        {user.count > 0 ? `${user.count} sales • Rs ${user.total.toFixed(0)}` : 'No sales yet'}
                      </p>
                    </div>
                  )}
                </button>
                
                {/* User Action Buttons - Only show when user is selected and sidebar is not collapsed */}
                {selectedUser === user.name && !sidebarCollapsed && (
                  <div className="ml-13 space-y-1">
                    <button
                        onClick={() => {
                          handleUserPanelAccess(user.name, 'assign');
                          setSidebarOpen(false);
                        }}
                      className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                    >
                      <Package className="w-4 h-4" />
                      Assign Stock
                    </button>
                    <button
                        onClick={() => {
                          handleUserPanelAccess(user.name, 'summary');
                          setSidebarOpen(false);
                        }}
                      className="w-full text-left px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Track Stock
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => {
                router.push('/admin/analytics');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-left"
            >
              <Settings className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Advanced Analytics</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="p-4 md:p-6 space-y-6 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">
                {selectedUser ? `${selectedUser}'s Dashboard` : 'Admin Dashboard'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {selectedUser ? `Viewing data for ${selectedUser}` : 'Overview of all users and sales'}
              </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => router.push('/admin/analytics')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Detailed Analytics
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
                  <Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-14" />
                </div>
              ))
            ) : (
              [
                { label: "Total Revenue", value: `Rs ${totalRevenue.toFixed(2)}`, sub: `${filteredBills.length} bills`, color: "from-gray-800 to-gray-900" },
                { label: "Cash", value: `Rs ${byCash.toFixed(2)}`, sub: `${filteredSales.filter(s => s.paymentMethod === "cash").length} items`, color: "from-emerald-600 to-emerald-700" },
                { label: "Cheque", value: `Rs ${byCheque.toFixed(2)}`, sub: `${filteredSales.filter(s => s.paymentMethod === "cheque").length} items`, color: "from-amber-500 to-amber-600" },
                { label: "Credit", value: `Rs ${byCredit.toFixed(2)}`, sub: `${filteredSales.filter(s => s.paymentMethod === "credit").length} items`, color: "from-purple-600 to-purple-700" },
              ].map((card) => (
                <div key={card.label} className={`bg-linear-to-br ${card.color} rounded-2xl p-5 shadow`}>
                  <p className="text-white/70 text-xs font-medium">{card.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                  <p className="text-white/60 text-xs mt-1">{card.sub}</p>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Bills table */}
            <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  {selectedUser ? `${selectedUser}'s Bills` : 'All Bills'}
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search bill, user or item..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 w-52"
                  />
                  <select
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="all">All</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit">Credit</option>
                  </select>
                  <QuickExportDropdown />
                  <button onClick={() => queryClient.invalidateQueries({ queryKey: ["sales-admin"] })} className="text-xs text-gray-400 hover:text-gray-700 px-2">↻</button>
                </div>
              </div>

              {isLoading ? (
                <div className="divide-y divide-gray-100">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 flex items-center gap-4">
                      <Skeleton className="h-4 w-4 rounded" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16 ml-auto" /><Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-gray-400 text-center py-12 text-sm">
                  {selectedUser ? `No bills found for ${selectedUser}.` : 'No bills found.'}
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map((bill) => {
                    const isOpen = expanded.has(bill.billNumber);
                    return (
                      <div key={bill.billNumber}>
                        <button onClick={() => toggleExpand(bill.billNumber)} className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                          <span className="font-mono text-sm font-semibold text-gray-900 w-16 shrink-0">#{bill.billNumber}</span>
                          <span className="text-sm text-gray-900 font-medium flex-1 truncate">{bill.billTitle}</span>
                          {!selectedUser && <span className="text-sm text-gray-600 flex-1 truncate">{bill.user.username}</span>}
                          <span className="text-xs text-gray-400 hidden sm:block w-20 shrink-0">{bill.items.length} item{bill.items.length > 1 ? "s" : ""}</span>
                          <span className="font-semibold text-gray-900 w-28 text-right shrink-0">Rs {bill.billTotal.toFixed(2)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${PAYMENT_COLORS[bill.paymentMethod] ?? ""}`}>{bill.paymentMethod}</span>
                          <span className="text-xs text-gray-400 w-20 text-right shrink-0">{new Date(bill.createdAt).toLocaleDateString()}</span>
                          {bill.billImageBase64 && (
                            <button onClick={(e) => { e.stopPropagation(); setBillModal(bill.billImageBase64); }} className="text-blue-600 hover:underline text-xs shrink-0">Bill</button>
                          )}
                        </button>
                        {isOpen && (
                          <div className="bg-gray-50 border-t border-gray-100">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-gray-400 uppercase">
                                <tr>{["Item", "Qty", "Unit Price", "Subtotal"].map(h => <th key={h} className="px-8 py-2 text-left font-medium">{h}</th>)}</tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {bill.items.map((item) => (
                                  <tr key={item.id} className="bg-white">
                                    <td className="px-8 py-2.5 text-gray-800 font-medium">{item.itemName}</td>
                                    <td className="px-8 py-2.5 text-gray-500">{item.quantity}</td>
                                    <td className="px-8 py-2.5 text-gray-500">Rs {item.unitPrice.toFixed(2)}</td>
                                    <td className="px-8 py-2.5 font-semibold text-gray-900">Rs {item.totalAmount.toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr className="bg-gray-50">
                                  <td colSpan={3} className="px-8 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Bill Total</td>
                                  <td className="px-8 py-2.5 font-bold text-gray-900">Rs {bill.billTotal.toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Current Stock Panel */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-sm text-gray-900">
                      {selectedUser ? `${selectedUser}'s Current Stock` : 'Current Stock'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Inventory for selected date</p>
                  </div>
                  {selectedUser && (
                    <button 
                      onClick={() => handleUserPanelAccess(selectedUser, 'summary')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                    >
                      View Details →
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={stockDate}
                  onChange={(e) => setStockDate(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div className="p-4">
                {selectedUser ? (
                  <UserStockDisplay username={selectedUser} date={stockDate} />
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Select a user to view their current stock</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {billModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBillModal(null)}>
              <div className="bg-white rounded-2xl p-4 max-w-xl w-full border border-gray-200 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium text-sm text-gray-900">Bill Image</span>
                  <button onClick={() => setBillModal(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
                </div>
                <img src={billModal} alt="Bill" className="w-full max-h-[70vh] object-contain rounded-lg" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
