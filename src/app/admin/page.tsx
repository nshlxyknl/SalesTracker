"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight } from "lucide-react";
import QuickExportDropdown from "@/components/quick-export-dropdown";

type Sale = {
  id: string;
  billNumber: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64: string | null;
  createdAt: string;
  user: { name: string; email: string };
};

type Bill = {
  billNumber: string;
  user: { name: string; email: string };
  paymentMethod: string;
  billTotal: number;
  billImageBase64: string | null;
  createdAt: string;
  items: Sale[];
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  credit: "bg-purple-100 text-purple-700",
};

async function fetchSales(): Promise<Sale[]> {
  const res = await fetch("/api/sales");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function groupIntoBills(sales: Sale[]): Bill[] {
  const map = new Map<string, Bill>();
  for (const sale of sales) {
    const key = sale.billNumber || sale.id;
    if (!map.has(key)) {
      map.set(key, {
        billNumber: sale.billNumber || sale.id,
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

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const [billModal, setBillModal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-admin"],
    queryFn: fetchSales,
    enabled: (session?.user as { role?: string })?.role === "admin",
  });

  useEffect(() => {
    if (!isPending) {
      const user = session?.user as { role?: string } | undefined;
      if (!session?.user) { router.push("/login"); return; }
      if (user?.role !== "admin") { router.push("/dashboard"); return; }
    }
  }, [isPending, session, router]);

  if (isPending || !session?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bills = groupIntoBills(sales);

  const filtered = bills.filter((b) => {
    const matchSearch =
      (b.billNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (b.user?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      b.items.some((i) => (i.itemName ?? "").toLowerCase().includes(search.toLowerCase()));
    const matchPayment = filterPayment === "all" || b.paymentMethod === filterPayment;
    return matchSearch && matchPayment;
  });

  const totalRevenue = sales.reduce((a, s) => a + s.totalAmount, 0);
  const byCash = sales.filter((s) => s.paymentMethod === "cash").reduce((a, s) => a + s.totalAmount, 0);
  const byCheque = sales.filter((s) => s.paymentMethod === "cheque").reduce((a, s) => a + s.totalAmount, 0);
  const byCredit = sales.filter((s) => s.paymentMethod === "credit").reduce((a, s) => a + s.totalAmount, 0);

  const byUser = Object.values(
    sales.reduce<Record<string, { name: string; total: number; count: number }>>((acc, s) => {
      if (!acc[s.user.email]) acc[s.user.email] = { name: s.user.name, total: 0, count: 0 };
      acc[s.user.email].total += s.totalAmount;
      acc[s.user.email].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  function toggleExpand(billNumber: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(billNumber) ? next.delete(billNumber) : next.add(billNumber);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

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
            { label: "Total Revenue", value: `Rs ${totalRevenue.toFixed(2)}`, sub: `${bills.length} bills`, color: "from-gray-800 to-gray-900" },
            { label: "Cash", value: `Rs ${byCash.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "cash").length} items`, color: "from-emerald-600 to-emerald-700" },
            { label: "Cheque", value: `Rs ${byCheque.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "cheque").length} items`, color: "from-amber-500 to-amber-600" },
            { label: "Credit", value: `Rs ${byCredit.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "credit").length} items`, color: "from-purple-600 to-purple-700" },
          ].map((card) => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 shadow`}>
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
            <h2 className="font-semibold text-gray-900">All Bills</h2>
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
            <p className="text-gray-400 text-center py-12 text-sm">No bills found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((bill) => {
                const isOpen = expanded.has(bill.billNumber);
                return (
                  <div key={bill.billNumber}>
                    <button onClick={() => toggleExpand(bill.billNumber)} className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      <span className="font-mono text-sm font-semibold text-gray-900 w-16 flex-shrink-0">#{bill.billNumber}</span>
                      <span className="text-sm text-gray-600 flex-1 truncate">{bill.user.name}</span>
                      <span className="text-xs text-gray-400 hidden sm:block w-20 flex-shrink-0">{bill.items.length} item{bill.items.length > 1 ? "s" : ""}</span>
                      <span className="font-semibold text-gray-900 w-28 text-right flex-shrink-0">Rs {bill.billTotal.toFixed(2)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${PAYMENT_COLORS[bill.paymentMethod] ?? ""}`}>{bill.paymentMethod}</span>
                      <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">{new Date(bill.createdAt).toLocaleDateString()}</span>
                      {bill.billImageBase64 && (
                        <button onClick={(e) => { e.stopPropagation(); setBillModal(bill.billImageBase64); }} className="text-blue-600 hover:underline text-xs flex-shrink-0">Bill</button>
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

        {/* Leaderboard */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-sm text-gray-900">Top Sellers</h2>
          </div>
          <div className="p-4 space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-14" /></div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))
            ) : byUser.length === 0 ? (
              <p className="text-gray-400 text-xs text-center py-4">No data yet.</p>
            ) : byUser.map((u, i) => (
              <div key={u.name} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-gray-100 text-gray-500"}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.count} items</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">Rs {u.total.toFixed(0)}</span>
              </div>
            ))}
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
  );
}
