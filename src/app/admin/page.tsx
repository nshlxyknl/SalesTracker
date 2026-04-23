"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart3, LogOut, LayoutDashboard } from "lucide-react";

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
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  credit: "bg-purple-100 text-purple-700",
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Sales Tracker</span>
          <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full font-medium">Admin</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <Avatar>
              <AvatarFallback>
                {(session?.user?.name ?? "A").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{session?.user?.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard")}>
              <LayoutDashboard className="w-4 h-4 mr-2" /> My Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut().then(() => router.push("/login"))}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: `Rs ${totalRevenue.toFixed(2)}`, sub: `${sales.length} sales`, color: "from-gray-800 to-gray-900" },
            { label: "Cash", value: `Rs ${byCash.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "cash").length} sales`, color: "from-emerald-600 to-emerald-700" },
            { label: "Cheque", value: `Rs ${byCheque.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "cheque").length} sales`, color: "from-amber-500 to-amber-600" },
            { label: "Credit", value: `Rs ${byCredit.toFixed(2)}`, sub: `${sales.filter(s => s.paymentMethod === "credit").length} sales`, color: "from-purple-600 to-purple-700" },
          ].map(card => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 shadow`}>
              <p className="text-white/70 text-xs font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
              <p className="text-white/60 text-xs mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sales table */}
          <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <h2 className="font-semibold text-gray-900">All Sales</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search item or user..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 w-44"
                />
                <select
                  value={filterPayment}
                  onChange={e => setFilterPayment(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="all">All</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit">Credit</option>
                </select>
                <button onClick={fetchSales} className="text-xs text-gray-400 hover:text-gray-700 px-2">↻</button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-gray-400 text-center py-12 text-sm">No sales found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                      {["User", "Item", "Qty", "Unit", "Total", "Payment", "Date", "Bill"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(sale => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-xs text-gray-900">{sale.user.name}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{sale.itemName}</td>
                        <td className="px-4 py-3 text-gray-500">{sale.quantity}</td>
                        <td className="px-4 py-3 text-gray-500">Rs {sale.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">Rs {sale.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PAYMENT_COLORS[sale.paymentMethod] ?? ""}`}>
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {sale.billImageBase64 ? (
                            <button onClick={() => setBillModal(sale.billImageBase64)} className="text-blue-600 hover:underline text-xs">View</button>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-sm text-gray-900">Top Sellers</h2>
            </div>
            <div className="p-4 space-y-3">
              {byUser.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">No data yet.</p>
              ) : byUser.map((u, i) => (
                <div key={u.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.count} sales</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">Rs {u.total.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bill modal */}
      {billModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBillModal(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-xl w-full border border-gray-200 shadow-xl" onClick={e => e.stopPropagation()}>
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
