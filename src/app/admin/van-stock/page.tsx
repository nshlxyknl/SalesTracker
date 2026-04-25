"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ITEMS } from "@/app/lib/items";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";

type AppUser = { id: string; username: string; name: string };
type VanLoad = {
  id: string;
  itemName: string;
  loaded: number;
  returned: number;
  unitPrice: number;
  userId: string;
  date: string;
  user: { username: string; name: string };
};
type Sale = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  createdAt: string;
  userId: string;
};

type LoadRow = {
  itemName: string;
  unitPrice: number;
  loaded: number | "";
  returned: number | "";
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function VanStockPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState("");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [rows, setRows] = useState<LoadRow[]>([
    { itemName: ITEMS[0].name, unitPrice: ITEMS[0].variants[0].price, loaded: "", returned: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data: users = [], isLoading: loadingUsers } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });

  const { data: loads = [], isLoading: loadingLoads } = useQuery<VanLoad[]>({
    queryKey: ["van-loads", selectedUser, date],
    queryFn: () =>
      fetch(`/api/van-load?userId=${selectedUser}&date=${date}`).then((r) => r.json()),
    enabled: !!selectedUser && !!date,
  });

  const { data: allSales = [], isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ["sales-admin"],
    queryFn: () => fetch("/api/sales").then((r) => r.json()),
  });

  // Sales for selected user on selected date
  const daySales = allSales.filter((s) => {
    if (s.userId !== selectedUser) return false;
    const saleDate = toDateStr(new Date(s.createdAt));
    return saleDate === date;
  });

  function updateRow(idx: number, patch: Partial<LoadRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    if (!selectedUser) { setMsg({ type: "err", text: "Select a user first." }); return; }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/van-load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUser,
        date,
        items: rows.map((r) => ({
          itemName: r.itemName,
          loaded: Number(r.loaded) || 0,
          returned: Number(r.returned) || 0,
          unitPrice: r.unitPrice,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg({ type: "ok", text: "Saved." });
      queryClient.invalidateQueries({ queryKey: ["van-loads", selectedUser, date] });
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg({ type: "err", text: d.error ?? "Failed to save." });
    }
  }

  // Build reconciliation table from saved loads + day sales
  type RecRow = {
    itemName: string;
    unitPrice: number;
    loaded: number;
    returned: number;
    expectedSold: number;       // loaded - returned
    actualSold: number;         // from sales records
    expectedRevenue: number;    // expectedSold * unitPrice
    actualRevenue: number;      // from sales records
    missingQty: number;         // expectedSold - actualSold
    missingAmount: number;      // expectedRevenue - actualRevenue
  };

  const recMap = new Map<string, RecRow>();

  for (const load of loads) {
    const key = load.itemName;
    if (!recMap.has(key)) {
      recMap.set(key, {
        itemName: key,
        unitPrice: load.unitPrice,
        loaded: 0, returned: 0,
        expectedSold: 0, actualSold: 0,
        expectedRevenue: 0, actualRevenue: 0,
        missingQty: 0, missingAmount: 0,
      });
    }
    const r = recMap.get(key)!;
    r.loaded += load.loaded;
    r.returned += load.returned;
  }

  for (const sale of daySales) {
    const key = sale.itemName;
    if (!recMap.has(key)) {
      recMap.set(key, {
        itemName: key, unitPrice: sale.unitPrice,
        loaded: 0, returned: 0,
        expectedSold: 0, actualSold: 0,
        expectedRevenue: 0, actualRevenue: 0,
        missingQty: 0, missingAmount: 0,
      });
    }
    const r = recMap.get(key)!;
    r.actualSold += sale.quantity;
    r.actualRevenue += sale.totalAmount;
  }

  const recRows: RecRow[] = Array.from(recMap.values()).map((r) => {
    r.expectedSold = r.loaded - r.returned;
    r.expectedRevenue = r.expectedSold * r.unitPrice;
    r.missingQty = r.expectedSold - r.actualSold;
    r.missingAmount = r.expectedRevenue - r.actualRevenue;
    return r;
  });

  const totalMissing = recRows.reduce((a, r) => a + r.missingAmount, 0);
  const hasIssues = recRows.some((r) => r.missingQty !== 0 || r.missingAmount !== 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Van Stock</h1>

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Enter Daily Load</h2>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">User (Van)</label>
            {loadingUsers ? <Skeleton className="h-9 w-40" /> : (
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        {/* Load rows */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase px-1">
            <span className="col-span-4">Item</span>
            <span className="col-span-3">Price Variant</span>
            <span className="col-span-2">Loaded</span>
            <span className="col-span-2">Returned</span>
            <span className="col-span-1"></span>
          </div>

          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <select
                  value={row.itemName}
                  onChange={(e) => {
                    const item = ITEMS.find((i) => i.name === e.target.value)!;
                    updateRow(idx, { itemName: item.name, unitPrice: item.variants[0].price });
                  }}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {ITEMS.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <select
                  value={row.unitPrice}
                  onChange={(e) => updateRow(idx, { unitPrice: Number(e.target.value) })}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {(ITEMS.find((i) => i.name === row.itemName)?.variants ?? []).map((v) => (
                    <option key={v.label} value={v.price}>{v.label} — Rs {v.price}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number" min={0} placeholder="0"
                  value={row.loaded}
                  onChange={(e) => updateRow(idx, { loaded: e.target.value === "" ? "" : parseInt(e.target.value) })}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number" min={0} placeholder="0"
                  value={row.returned}
                  onChange={(e) => updateRow(idx, { returned: e.target.value === "" ? "" : parseInt(e.target.value) })}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div className="col-span-1 flex justify-center">
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows((p) => p.filter((_, i) => i !== idx))}
                    className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setRows((p) => [...p, { itemName: ITEMS[0].name, unitPrice: ITEMS[0].variants[0].price, loaded: "", returned: "" }])}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mt-1"
          >
            <Plus className="w-4 h-4" /> Add item
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Load"}
          </button>
          {msg && (
            <span className={`text-sm font-medium ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>
          )}
        </div>
      </div>

      {/* Reconciliation */}
      {selectedUser && date && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Stock Reconciliation</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {users.find((u) => u.id === selectedUser)?.username} · {date}
              </p>
            </div>
            {!loadingLoads && !loadingSales && (
              hasIssues ? (
                <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Missing Rs {totalMissing.toFixed(2)}
                </div>
              ) : loads.length > 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> All accounted
                </div>
              ) : null
            )}
          </div>

          {loadingLoads || loadingSales ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex gap-4">
                  {Array.from({ length: 8 }).map((_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
                </div>
              ))}
            </div>
          ) : recRows.length === 0 ? (
            <p className="text-gray-400 text-center py-10 text-sm">No load data for this user and date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr>
                    {["Item", "Loaded", "Returned", "Exp. Sold", "Act. Sold", "Exp. Revenue", "Act. Revenue", "Missing Qty", "Missing Amt"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recRows.map((r) => {
                    const hasGap = r.missingQty !== 0 || r.missingAmount !== 0;
                    return (
                      <tr key={r.itemName} className={hasGap ? "bg-red-50" : "hover:bg-gray-50"}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.itemName}</td>
                        <td className="px-4 py-3 text-gray-600">{r.loaded}</td>
                        <td className="px-4 py-3 text-gray-600">{r.returned}</td>
                        <td className="px-4 py-3 text-gray-600">{r.expectedSold}</td>
                        <td className="px-4 py-3 text-gray-600">{r.actualSold}</td>
                        <td className="px-4 py-3 text-gray-600">Rs {r.expectedRevenue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-600">Rs {r.actualRevenue.toFixed(2)}</td>
                        <td className={`px-4 py-3 font-semibold ${r.missingQty > 0 ? "text-red-600" : r.missingQty < 0 ? "text-blue-600" : "text-emerald-600"}`}>
                          {r.missingQty > 0 ? `−${r.missingQty}` : r.missingQty < 0 ? `+${Math.abs(r.missingQty)}` : "✓"}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${r.missingAmount > 0 ? "text-red-600" : r.missingAmount < 0 ? "text-blue-600" : "text-emerald-600"}`}>
                          {r.missingAmount > 0 ? `−Rs ${r.missingAmount.toFixed(2)}` : r.missingAmount < 0 ? `+Rs ${Math.abs(r.missingAmount).toFixed(2)}` : "✓"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900" colSpan={5}>Total</td>
                    <td className="px-4 py-3 font-bold text-gray-900">Rs {recRows.reduce((a, r) => a + r.expectedRevenue, 0).toFixed(2)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">Rs {recRows.reduce((a, r) => a + r.actualRevenue, 0).toFixed(2)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{recRows.reduce((a, r) => a + r.missingQty, 0)}</td>
                    <td className={`px-4 py-3 font-bold ${totalMissing > 0 ? "text-red-600" : totalMissing < 0 ? "text-blue-600" : "text-emerald-600"}`}>
                      {totalMissing > 0 ? `−Rs ${totalMissing.toFixed(2)}` : totalMissing < 0 ? `+Rs ${Math.abs(totalMissing).toFixed(2)}` : "✓"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
