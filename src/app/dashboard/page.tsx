"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { ITEMS } from "@/app/lib/items";

type Sale = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64: string | null;
  createdAt: string;
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-500/20 text-emerald-400",
  cheque: "bg-amber-500/20 text-amber-400",
  credit: "bg-purple-500/20 text-purple-400",
};

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  // Form state
  const [selectedItem, setSelectedItem] = useState(ITEMS[0]);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "cheque" | "credit">("cash");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billPreviewModal, setBillPreviewModal] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPending && !session?.user) router.push("/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (session?.user) fetchSales();
  }, [session]);

  async function fetchSales() {
    setLoadingSales(true);
    const res = await fetch("/api/sales");
    if (res.ok) setSales(await res.json());
    setLoadingSales(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    const fd = new FormData();
    fd.append("itemName", selectedItem.name);
    fd.append("quantity", String(quantity));
    fd.append("unitPrice", String(selectedItem.unitPrice));
    fd.append("paymentMethod", paymentMethod);
    if (billFile) fd.append("billImage", billFile);

    const res = await fetch("/api/sales", { method: "POST", body: fd });
    setSubmitting(false);

    if (res.ok) {
      setFormMsg({ type: "success", text: "Sale recorded successfully." });
      setQuantity(1);
      setBillFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      fetchSales();
    } else {
      const data = await res.json();
      setFormMsg({ type: "error", text: data.error ?? "Something went wrong." });
    }
  }

  if (isPending || !session?.user) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const user = session.user as { name: string; email: string; role?: string };
  const totalRevenue = sales.reduce((s, x) => s + x.totalAmount, 0);

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
          <span className="font-semibold text-white">Sales Tracker</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm hidden sm:block">{user.name}</span>
          {user.role === "admin" && (
            <button onClick={() => router.push("/admin")} className="text-sm text-blue-400 hover:text-blue-300">
              Admin Panel
            </button>
          )}
          <button
            onClick={() => signOut().then(() => router.push("/login"))}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: New Sale Form */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-5">New Sale</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Item</label>
                <select
                  value={selectedItem.name}
                  onChange={(e) => setSelectedItem(ITEMS.find((i) => i.name === e.target.value)!)}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ITEMS.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} — ${item.unitPrice.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Payment Method</label>
                <div className="flex gap-3">
                  {(["cash", "cheque", "credit"] as const).map((m) => (
                    <label key={m} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border cursor-pointer capitalize text-sm font-medium transition-colors ${paymentMethod === m ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}>
                      <input type="radio" name="payment" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} className="sr-only" />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Bill Image (optional)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setBillFile(f);
                    setPreview(f ? URL.createObjectURL(f) : null);
                  }}
                  className="block w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600 file:text-xs"
                />
                {preview && <img src={preview} alt="preview" className="mt-2 max-h-32 rounded-lg object-contain border border-slate-600" />}
              </div>

              <div className="flex justify-between items-center bg-slate-900 rounded-lg px-4 py-3">
                <span className="text-slate-400 text-sm">Total</span>
                <span className="text-xl font-bold text-blue-400">${(selectedItem.unitPrice * quantity).toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Saving..." : "Record Sale"}
              </button>

              {formMsg && (
                <p className={`text-sm text-center ${formMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                  {formMsg.text}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Right: My Sales */}
        <div className="lg:col-span-3 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs">Total Sales</p>
              <p className="text-2xl font-bold mt-1">{sales.length}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs">Revenue</p>
              <p className="text-2xl font-bold mt-1 text-blue-400">${totalRevenue.toFixed(0)}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs">This Month</p>
              <p className="text-2xl font-bold mt-1 text-emerald-400">
                ${sales.filter(s => new Date(s.createdAt).getMonth() === new Date().getMonth()).reduce((a, s) => a + s.totalAmount, 0).toFixed(0)}
              </p>
            </div>
          </div>

          {/* Sales list */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold">My Sales</h2>
              <button onClick={fetchSales} className="text-xs text-slate-400 hover:text-white">Refresh</button>
            </div>
            {loadingSales ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : sales.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-sm">No sales yet. Record your first one!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      {["Item", "Qty", "Total", "Payment", "Date", "Bill"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{sale.itemName}</td>
                        <td className="px-4 py-3 text-slate-400">{sale.quantity}</td>
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
                            <button onClick={() => setBillPreviewModal(sale.billImageBase64)} className="text-blue-400 hover:text-blue-300 text-xs">View</button>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill modal */}
      {billPreviewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setBillPreviewModal(null)}>
          <div className="bg-slate-800 rounded-2xl p-4 max-w-xl w-full border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-sm">Bill Image</span>
              <button onClick={() => setBillPreviewModal(null)} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <img src={billPreviewModal} alt="Bill" className="w-full max-h-[70vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
