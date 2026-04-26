"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ITEMS } from "@/app/lib/items";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Plus, Trash2, Sun, Moon } from "lucide-react";

type AppUser = { id: string; username: string; name: string };
type VanLoad = {
  id: string;
  itemName: string;
  loaded: number;
  returned: number;
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
  loaded: number | "";
};

type ReturnRow = {
  itemName: string;
  returned: number | "";
  loadId: string;
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function VanStockPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState("");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [activeTab, setActiveTab] = useState<"load" | "return">("load");
  
  // Morning load state
  const [loadRows, setLoadRows] = useState<LoadRow[]>([
    { itemName: ITEMS[0].name, loaded: "" },
  ]);
  const [savingLoad, setSavingLoad] = useState(false);
  const [loadMsg, setLoadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Evening return state
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnMsg, setReturnMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data: users = [], isLoading: loadingUsers } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });

  const { data: loads = [], isLoading: loadingLoads } = useQuery<VanLoad[]>({
    queryKey: ["van-loads", selectedUser, date],
    queryFn: async () => {
      const response = await fetch(`/api/van-load?userId=${selectedUser}&date=${date}`);
      const data = await response.json();
      
      if (!response.ok || !Array.isArray(data)) {
        console.error("Van loads API error:", data);
        return [];
      }
      
      return data;
    },
    enabled: !!selectedUser && !!date,
  });

  const { data: allSales = [], isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ["sales-admin"],
    queryFn: async () => {
      const response = await fetch("/api/sales");
      const data = await response.json();
      
      if (!response.ok || !Array.isArray(data)) {
        console.error("Sales API error:", data);
        return [];
      }
      
      return data;
    },
  });

  // Update return rows when loads change
  useEffect(() => {
    if (loads.length > 0) {
      setReturnRows(loads.map(load => ({
        itemName: load.itemName,
        returned: load.returned || "",
        loadId: load.id
      })));
    }
  }, [loads]);

  function updateLoadRow(idx: number, patch: Partial<LoadRow>) {
    setLoadRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateReturnRow(idx: number, patch: Partial<ReturnRow>) {
    setReturnRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function handleSaveLoad() {
    if (!selectedUser) { setLoadMsg({ type: "err", text: "Select a user first." }); return; }
    setSavingLoad(true);
    setLoadMsg(null);
    
    const res = await fetch("/api/van-load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUser,
        date,
        items: loadRows.map((r) => ({
          itemName: r.itemName,
          loaded: Number(r.loaded) || 0,
          returned: 0, // Always 0 for morning load
        })),
      }),
    });
    
    setSavingLoad(false);
    if (res.ok) {
      setLoadMsg({ type: "ok", text: "Morning load saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ["van-loads", selectedUser, date] });
      setActiveTab("return"); // Switch to return tab after saving load
    } else {
      const d = await res.json().catch(() => ({}));
      setLoadMsg({ type: "err", text: d.error ?? "Failed to save load." });
    }
  }

  async function handleSaveReturns() {
    if (!selectedUser) { setReturnMsg({ type: "err", text: "Select a user first." }); return; }
    if (returnRows.length === 0) { setReturnMsg({ type: "err", text: "No items to update." }); return; }
    
    setSavingReturn(true);
    setReturnMsg(null);
    
    try {
      // Update each load with return quantity
      for (const row of returnRows) {
        if (row.loadId && row.returned !== "") {
          await fetch("/api/van-load", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: row.loadId,
              returned: Number(row.returned) || 0,
            }),
          });
        }
      }
      
      setReturnMsg({ type: "ok", text: "Evening returns saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ["van-loads", selectedUser, date] });
    } catch (error) {
      setReturnMsg({ type: "err", text: "Failed to save returns." });
    } finally {
      setSavingReturn(false);
    }
  }

  // Calculate reconciliation
  const safeLoads = Array.isArray(loads) ? loads : [];
  const safeSales = Array.isArray(allSales) ? allSales : [];

  const daySales = safeSales.filter((s) => {
    if (s.userId !== selectedUser) return false;
    const saleDate = toDateStr(new Date(s.createdAt));
    return saleDate === date;
  });

  type RecRow = {
    itemName: string;
    loaded: number;
    returned: number;
    expectedSold: number;
    actualSold: number;
    missingQty: number;
  };

  const recMap = new Map<string, RecRow>();

  for (const load of safeLoads) {
    const key = load.itemName;
    if (!recMap.has(key)) {
      recMap.set(key, {
        itemName: key,
        loaded: 0, returned: 0,
        expectedSold: 0, actualSold: 0,
        missingQty: 0,
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
        itemName: key,
        loaded: 0, returned: 0,
        expectedSold: 0, actualSold: 0,
        missingQty: 0,
      });
    }
    const r = recMap.get(key)!;
    r.actualSold += sale.quantity;
  }

  const recRows: RecRow[] = Array.from(recMap.values()).map((r) => {
    r.expectedSold = r.loaded - r.returned;
    r.missingQty = r.expectedSold - r.actualSold;
    return r;
  });

  const totalMissingQty = recRows.reduce((a, r) => a + r.missingQty, 0);
  const hasIssues = recRows.some((r) => r.missingQty !== 0);
  const hasLoads = safeLoads.length > 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Van Stock Management</h1>

      {/* User and Date Selection */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap gap-4 mb-4">
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

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("load")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "load" 
                ? "bg-blue-100 text-blue-700 border border-blue-200" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Sun className="w-4 h-4" />
            Morning Load
          </button>
          <button
            onClick={() => setActiveTab("return")}
            disabled={!hasLoads}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "return" 
                ? "bg-orange-100 text-orange-700 border border-orange-200" 
                : hasLoads 
                  ? "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  : "text-gray-400 cursor-not-allowed"
            }`}
          >
            <Moon className="w-4 h-4" />
            Evening Returns
          </button>
        </div>

        {/* Morning Load Tab */}
        {activeTab === "load" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Sun className="w-5 h-5 text-yellow-500" />
              Record Morning Stock Load
            </h3>
            
            <div className="space-y-2">
              <div className="grid grid-cols-8 gap-2 text-xs font-medium text-gray-500 uppercase px-1">
                <span className="col-span-5">Item</span>
                <span className="col-span-2">Loaded Quantity</span>
                <span className="col-span-1"></span>
              </div>

              {loadRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-8 gap-2 items-center">
                  <div className="col-span-5">
                    <select
                      value={row.itemName}
                      onChange={(e) => updateLoadRow(idx, { itemName: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      {ITEMS.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number" min={0} placeholder="0"
                      value={row.loaded}
                      onChange={(e) => updateLoadRow(idx, { loaded: e.target.value === "" ? "" : parseInt(e.target.value) })}
                      className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {loadRows.length > 1 && (
                      <button type="button" onClick={() => setLoadRows((p) => p.filter((_, i) => i !== idx))}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setLoadRows((p) => [...p, { itemName: ITEMS[0].name, loaded: "" }])}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mt-1"
              >
                <Plus className="w-4 h-4" /> Add item
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveLoad}
                disabled={savingLoad}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {savingLoad ? "Saving..." : "Save Morning Load"}
              </button>
              {loadMsg && (
                <span className={`text-sm font-medium ${loadMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                  {loadMsg.text}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Evening Returns Tab */}
        {activeTab === "return" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Moon className="w-5 h-5 text-blue-500" />
              Record Evening Returns
            </h3>
            
            {returnRows.length === 0 ? (
              <p className="text-gray-500 text-sm">No items loaded yet. Please save morning load first.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="grid grid-cols-8 gap-2 text-xs font-medium text-gray-500 uppercase px-1">
                    <span className="col-span-4">Item</span>
                    <span className="col-span-2">Loaded</span>
                    <span className="col-span-2">Returned</span>
                  </div>

                  {returnRows.map((row, idx) => {
                    const load = safeLoads.find(l => l.id === row.loadId);
                    return (
                      <div key={idx} className="grid grid-cols-8 gap-2 items-center">
                        <div className="col-span-4">
                          <div className="text-sm font-medium text-gray-900 px-2 py-2">
                            {row.itemName}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm text-gray-600 px-2 py-2 bg-gray-50 rounded">
                            {load?.loaded || 0}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number" min={0} max={load?.loaded || 0} placeholder="0"
                            value={row.returned}
                            onChange={(e) => updateReturnRow(idx, { returned: e.target.value === "" ? "" : parseInt(e.target.value) })}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveReturns}
                    disabled={savingReturn}
                    className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {savingReturn ? "Saving..." : "Save Evening Returns"}
                  </button>
                  {returnMsg && (
                    <span className={`text-sm font-medium ${returnMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                      {returnMsg.text}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Auto-calculated Reconciliation */}
      {selectedUser && date && hasLoads && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Auto-Calculated Stock Reconciliation</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {users.find((u) => u.id === selectedUser)?.username} · {date}
              </p>
            </div>
            {!loadingLoads && !loadingSales && (
              hasIssues ? (
                <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {totalMissingQty > 0 ? `${totalMissingQty} items missing` : `${Math.abs(totalMissingQty)} extra items`}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Perfect match!
                </div>
              )
            )}
          </div>

          {loadingLoads || loadingSales ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex gap-4">
                  {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
                </div>
              ))}
            </div>
          ) : recRows.length === 0 ? (
            <p className="text-gray-400 text-center py-10 text-sm">No stock data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr>
                    {["Item", "Loaded", "Returned", "Expected Sold", "Actual Sold", "Missing/Extra"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recRows.map((r) => {
                    const hasGap = r.missingQty !== 0;
                    return (
                      <tr key={r.itemName} className={hasGap ? (r.missingQty > 0 ? "bg-red-50" : "bg-blue-50") : "hover:bg-gray-50"}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.itemName}</td>
                        <td className="px-4 py-3 text-gray-600">{r.loaded}</td>
                        <td className="px-4 py-3 text-gray-600">{r.returned}</td>
                        <td className="px-4 py-3 text-gray-600">{r.expectedSold}</td>
                        <td className="px-4 py-3 text-gray-600">{r.actualSold}</td>
                        <td className={`px-4 py-3 font-semibold ${r.missingQty > 0 ? "text-red-600" : r.missingQty < 0 ? "text-blue-600" : "text-emerald-600"}`}>
                          {r.missingQty > 0 ? `${r.missingQty} missing` : r.missingQty < 0 ? `${Math.abs(r.missingQty)} extra` : "✓"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900" colSpan={3}>Total</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{recRows.reduce((a, r) => a + r.expectedSold, 0)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{recRows.reduce((a, r) => a + r.actualSold, 0)}</td>
                    <td className={`px-4 py-3 font-bold ${totalMissingQty > 0 ? "text-red-600" : totalMissingQty < 0 ? "text-blue-600" : "text-emerald-600"}`}>
                      {totalMissingQty > 0 ? `${totalMissingQty} missing` : totalMissingQty < 0 ? `${Math.abs(totalMissingQty)} extra` : "✓"}
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