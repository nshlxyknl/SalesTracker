"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

type Sale = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64: string | null;
  createdAt: string;
  user: { name: string; email: string };
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-500/20 text-emerald-400",
  cheque: "bg-amber-500/20 text-amber-400",
  credit: "bg-purple-500/20 text-purple-400",
};

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [billModal, setBillModal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");

  useEffect(() => {
    if (!isPending) {
      const user = session?.user as { role?: string } | undefined;
      if (!session?.user) { router.push("/login"); return; }
      if (user?.role !== "admin") { router.push("/dashboard"); return; }
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if ((session?.user as { role?: string })?.role === "admin") fetchSales();
  }, [session]);

  async function fetchSales() {
    setLoading(true);
    const res = await fetch("/api/sales");
    if (res.ok) setSales(await res.json());
    setLoading(false);
  }

  if (isPending || !session?.user) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const filtered = sales.filter(s => {
    const matchSearch = s.itemName.toLowerCase().includes(search.toLowerCase()) || s.user.name.toLowerCase().includes(search.toLowerCase());
    const matchPayment = filterPayment === "all" || s.paymentMethod === filterPayment;
    return matchSearch && matchPayment;
  });

  const totalRevenue = sales.reduce((a, s) => a + s.totalAmount, 0);
  const byCash = sales.filter(s => s.paymentMethod === "cash").reduce((a, s) => a + s.totalAmount, 0);
  const byCheque = sales.filter(s => s.paymentMethod === "cheque").reduce((a, s) => a + s.totalAmount, 0);
  const byCredit = sales.filter(s => s.paymentMethod === "credit").reduce((a, s) => a + s.totalAmount, 0);

  // Group sales by user for the leaderboard
  const byUser = Object.values(
    sales.reduce<Record<string, { name: string; total: number; count: number }>>((acc, s) => {
      if (!acc[s.user.email]) acc[s.user.email] = { name: s.user.name, total: 0, count: 0 };
      acc[s.user.email].total += s.totalAmount;
      acc[s.user.email].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-700 bg-slate-800/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-semibold">Sales Tracker</span>
          <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-sm text-slate-400 hover:text-white">My Dashboard</button>
          <button onClick={() => signOut().then(() => router.push("/login"))} className="text-sm text-slate-400 hover:text-white">Sign out</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}`, sub: `${sales.length} sales`, color: "from-blue-600 to-blue-700" },
            { label: "Cash", value: `$${byCash.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "cash").length} sales`, color: "from-emerald-600 to-emerald-700" },
            { label: "Cheque", value: `$${byCheque.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "cheque").length} sales`, color: "from-amber-600 to-amber-700" },
            { label: "Credit", value: `$${byCredit.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "credit").length} sales`, color: "from-purple-600 to-purple-700" },
          ].map(card => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 shadow-lg`}>
              <p className="text-white/70 text-xs font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
              <p className="text-white/60 text-xs mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sales table */}
          <div className="lg:col-span-3 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <h2 className="font-semibold">All Sales</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search item or user..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
                <select
                  value={filterPayment}
                  onChange={e => setFilterPayment(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit">Credit</option>
                </select>
                <button onClick={fetchSales} className="text-xs text-slate-400 hover:text-white px-2">↻</button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-sm">No sales found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      {["User", "Item", "Qty", "Unit", "Total", "Payment", "Date", "Bill"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filtered.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-xs">{sale.user.name}</div>
                          <div className="text-slate-500 text-xs">{sale.user.email}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{sale.itemName}</td>
                        <td className="px-4 py-3 text-slate-400">{sale.quantity}</td>
                        <td className="px-4 py-3 text-slate-400">${sale.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-blue-400">${sale.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PAYMENT_COLORS[sale.paymentMethod] ?? ""}`}>
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {sale.billImageBase64 ? (
                            <button onClick={() => setBillModal(sale.billImageBase64)} className="text-blue-400 hover:text-blue-300 text-xs">View</button>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-sm">Top Sellers</h2>
            </div>
            <div className="p-4 space-y-3">
              {byUser.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-4">No data yet.</p>
              ) : byUser.map((u, i) => (
                <div key={u.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-slate-700 text-slate-400"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.count} sales</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-400">${u.total.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bill modal */}
      {billModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setBillModal(null)}>
          <div className="bg-slate-800 rounded-2xl p-4 max-w-xl w-full border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-sm">Bill Image</span>
              <button onClick={() => setBillModal(null)} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <img src={billModal} alt="Bill" className="w-full max-h-[70vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
