"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { ITEMS } from "@/app/lib/items";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart3, LogOut, ShieldCheck } from "lucide-react";

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

type LineItem = {
  id: number;
  item: (typeof ITEMS)[0];
  variant: (typeof ITEMS)[0]["variants"][0];
  quantity: number | "";
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  credit: "bg-purple-100 text-purple-700",
};

let nextId = 1;
function newLine(): LineItem {
  return { id: nextId++, item: ITEMS[0], variant: ITEMS[0].variants[0], quantity: 1 };
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  // Cart
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "cheque" | "credit">("cash");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billPreviewModal, setBillPreviewModal] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPending && !session?.user) router.push("/login");
    if (!isPending && session?.user) {
      const role = (session.user as { role?: string }).role;
      if (role === "admin") router.replace("/admin");
    }
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

  function updateLine(id: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const grandTotal = lines.reduce((sum, l) => sum + (l.variant.price * (Number(l.quantity) || 0)), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    const items = lines.map((l) => ({
      itemName: l.item.name,
      quantity: Number(l.quantity) || 1,
      unitPrice: l.variant.price,
    }));

    const fd = new FormData();
    fd.append("items", JSON.stringify(items));
    fd.append("paymentMethod", paymentMethod);
    if (billFile) fd.append("billImage", billFile);

    const res = await fetch("/api/sales", { method: "POST", body: fd });
    setSubmitting(false);

    if (res.ok) {
      setFormMsg({ type: "success", text: "Sale recorded successfully." });
      setLines([newLine()]);
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const user = session.user as { name: string; email: string; role?: string };
  const totalRevenue = sales.reduce((s, x) => s + x.totalAmount, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Sales Tracker</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <Avatar>
              <AvatarFallback>
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.role === "admin" && (
              <DropdownMenuItem onClick={() => router.push("/admin")}>
                <ShieldCheck className="w-4 h-4 mr-2" /> Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => signOut().then(() => router.push("/login"))}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: New Sale Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-5 text-gray-900">New Sale</h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Line items */}
              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div key={line.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    {/* Item select */}
                    <select
                      value={line.item.name}
                      onChange={(e) => {
                        const item = ITEMS.find((i) => i.name === e.target.value)!;
                        updateLine(line.id, { item, variant: item.variants[0] });
                      }}
                      className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      {ITEMS.map((item) => (
                        <option key={item.name} value={item.name}>{item.name}</option>
                      ))}
                    </select>

                    {/* Variant + Qty row */}
                    <div className="flex gap-2">
                      <select
                        value={line.variant.label}
                        onChange={(e) =>
                          updateLine(line.id, {
                            variant: line.item.variants.find((v) => v.label === e.target.value)!,
                          })
                        }
                        className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        {line.item.variants.map((v) => (
                          <option key={v.label} value={v.label}>
                            {v.label} — Rs {v.price}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, {
                            quantity: e.target.value === "" ? "" : parseInt(e.target.value),
                          })
                        }
                        onBlur={() =>
                          updateLine(line.id, {
                            quantity: !line.quantity || Number(line.quantity) < 1 ? 1 : line.quantity,
                          })
                        }
                        placeholder="Qty"
                        className="w-20 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>

                    {/* Line subtotal */}
                    <div className="text-right text-xs text-gray-500 font-medium">
                      Rs {(line.variant.price * (Number(line.quantity) || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add item button */}
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, newLine()])}
                className="w-full border border-dashed border-gray-300 hover:border-gray-900 text-gray-400 hover:text-gray-900 text-sm py-2 rounded-xl transition-colors"
              >
                + Add another item
              </button>

              {/* Payment method */}
              <div>
                <label className="block text-sm text-gray-600 font-medium mb-2">Payment Method</label>
                <div className="flex gap-3">
                  {(["cash", "cheque", "credit"] as const).map((m) => (
                    <label
                      key={m}
                      className={`flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer capitalize text-sm font-medium transition-colors ${
                        paymentMethod === m
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      <input type="radio" name="payment" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} className="sr-only" />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              {/* Bill upload */}
              <div>
                <label className="block text-sm text-gray-600 font-medium mb-1.5">Bill Image (optional)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setBillFile(f);
                    setPreview(f ? URL.createObjectURL(f) : null);
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:text-xs"
                />
                {preview && (
                  <img src={preview} alt="preview" className="mt-2 max-h-32 rounded-lg object-contain border border-gray-200" />
                )}
              </div>

              {/* Grand total */}
              <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <span className="text-gray-500 text-sm">{lines.length} item{lines.length > 1 ? "s" : ""} · Total</span>
                <span className="text-xl font-bold text-gray-900">Rs {grandTotal.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Saving..." : "Record Sale"}
              </button>

              {formMsg && (
                <p className={`text-sm text-center ${formMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                  {formMsg.text}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Right: My Sales */}
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-gray-400 text-xs">Total Sales</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{sales.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-gray-400 text-xs">Revenue</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">Rs {totalRevenue.toFixed(0)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-gray-400 text-xs">This Month</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">
                Rs {sales
                  .filter((s) => new Date(s.createdAt).getMonth() === new Date().getMonth())
                  .reduce((a, s) => a + s.totalAmount, 0)
                  .toFixed(0)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">My Sales</h2>
              <button onClick={fetchSales} className="text-xs text-gray-400 hover:text-gray-700">Refresh</button>
            </div>
            {loadingSales ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sales.length === 0 ? (
              <p className="text-gray-400 text-center py-12 text-sm">No sales yet. Record your first one!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                      {["Item", "Qty", "Unit", "Total", "Payment", "Date", "Bill"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
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
                            <button onClick={() => setBillPreviewModal(sale.billImageBase64)} className="text-blue-600 hover:underline text-xs">View</button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
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

      {billPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBillPreviewModal(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-xl w-full border border-gray-200 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-sm text-gray-900">Bill Image</span>
              <button onClick={() => setBillPreviewModal(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <img src={billPreviewModal} alt="Bill" className="w-full max-h-[70vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
