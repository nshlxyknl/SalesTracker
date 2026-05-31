"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ITEMS, formatCaseBottleDisplay, getItemByName, convertBottlesToCases } from "@/app/lib/items";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, LogOut, ShieldCheck, Package, AlertCircle, CheckCircle } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RoleBasedNav } from "@/components/navigation/RoleBasedNav";

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
};

type UserStock = {
  itemName: string;
  loaded: number;
  sold: number;
  remaining: number;
  returned: number;
};

type StockResponse = {
  date: string;
  stock: UserStock[];
  hasStock: boolean;
  totalItems: number;
};

type LineItem = {
  id: number;
  item: (typeof ITEMS)[0];
  variant: (typeof ITEMS)[0]["variants"][0];
  cases: number | "";
  bottles: number | "";
  casePrice: number | ""; // Allow empty string for erasable input
  totalQuantity: number; // Total bottles for backend
  totalAmount: number; // Total price
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  credit: "bg-purple-100 text-purple-700",
};

let nextId = 1;
const newLine = (): LineItem => ({
  id: nextId++,
  item: ITEMS[0],
  variant: ITEMS[0].variants[0],
  cases: "",
  bottles: "",
  casePrice: "", // Start with empty string for erasable input
  totalQuantity: 0,
  totalAmount: 0,
});

async function fetchSales(): Promise<Sale[]> {
  const res = await fetch("/api/sales");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();

  // Add payment filter state
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ["sales"],
    queryFn: fetchSales,
    enabled: !!session?.user,
  });

  const { data: stockData, isLoading: stockLoading } = useQuery<StockResponse>({
    queryKey: ["user-stock", new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      const res = await fetch("/api/user-stock");
      if (!res.ok) throw new Error("Failed to fetch stock");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [billTitle, setBillTitle] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "cheque" | "credit">("cash");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billPreviewModal, setBillPreviewModal] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Calculate total quantity and amount for a line item
  const calculateLineItem = (line: LineItem) => {
    const cases = Number(line.cases) || 0;
    const bottles = Number(line.bottles) || 0;
    const casePrice = Number(line.casePrice) || 0;
    const bottlesPerCase = line.item.caseInfo.bottlesPerCase;
    
    const totalQuantity = (cases * bottlesPerCase) + bottles;
    
    // Calculate bottle price: case_rate ÷ bottles_per_case
    const bottlePrice = bottlesPerCase > 0 ? casePrice / bottlesPerCase : 0;
    
    // Total amount = (cases × case_price) + (bottles × bottle_price)
    const totalAmount = (cases * casePrice) + (bottles * bottlePrice);
    
    return { totalQuantity, totalAmount, bottlePrice };
  };

  useEffect(() => {
    if (!isPending && !session?.user) router.push("/login");
    if (!isPending && session?.user) {
      const role = session.user.role;
      if (role === "admin") router.replace("/admin");
    }
  }, [isPending, session, router]);

  function updateLine(id: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => {
      if (l.id === id) {
        const updatedLine = { ...l, ...patch };
        const { totalQuantity, totalAmount } = calculateLineItem(updatedLine);
        return { ...updatedLine, totalQuantity, totalAmount };
      }
      return l;
    }));
  }

  const grandTotal = lines.reduce((sum, l) => sum + (l.totalAmount || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    const fd = new FormData();
    fd.append("billTitle", billTitle.trim());
    fd.append("items", JSON.stringify(lines.map((l) => ({
      itemName: l.item.name,
      quantity: l.totalQuantity,
      unitPrice: l.totalQuantity > 0 ? l.totalAmount / l.totalQuantity : 0,
    }))));
    fd.append("paymentMethod", paymentMethod);
    if (billFile) fd.append("billImage", billFile);

    const res = await fetch("/api/sales", { method: "POST", body: fd });
    setSubmitting(false);

    if (res.ok) {
      setFormMsg({ type: "success", text: "Sale recorded." });
      setLines([newLine()]);
      setBillTitle("");
      setBillFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["user-stock"] }); // Refresh stock data
    } else {
      let msg = "Something went wrong.";
      try {
        const data = await res.json();
        msg = data.error ?? msg;
      } catch {}
      setFormMsg({ type: "error", text: msg });
    }
  }

  if (isPending || !session?.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const user = session.user;
  
  // Filter sales based on payment method
  const filteredSales = paymentFilter === "all" 
    ? sales 
    : sales.filter(sale => sale.paymentMethod === paymentFilter);
  
  const totalRevenue = filteredSales.reduce((s, x) => s + x.totalAmount, 0);

  return (
    <RoleBasedNav>
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Stock Display */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5" />
                My Stock
              </h2>
              {stockData && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  stockData.hasStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {stockData.hasStock ? (() => {
                    // Calculate total in case/bottle format for display
                    const totalBottles = stockData.totalItems;
                    // Use first item's case info for total display (or use a common format)
                    const firstStockItem = stockData.stock[0];
                    if (firstStockItem) {
                      const itemConfig = getItemByName(firstStockItem.itemName);
                      const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                      return formatCaseBottleDisplay(totalBottles, bottlesPerCase);
                    }
                    return `${totalBottles} items available`;
                  })() : 'No stock assigned'}
                </span>
              )}
            </div>
            
            {stockLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : stockData?.hasStock ? (
              <div className="space-y-3">
                {/* Summary Header */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-800">Today's Stock Summary</span>
                    <span className="text-sm text-blue-600">
                      {stockData.stock.length} item{stockData.stock.length > 1 ? 's' : ''} assigned
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-blue-600">Total Loaded:</span>
                      <div className="font-bold text-blue-800">
                        {stockData.stock.reduce((sum, item) => sum + item.loaded, 0)} bottles
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-600">Total Sold:</span>
                      <div className="font-bold text-blue-800">
                        {stockData.stock.reduce((sum, item) => sum + item.sold, 0)} bottles
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-600">Remaining:</span>
                      <div className="font-bold text-blue-800">
                        {stockData.totalItems} bottles
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Items */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stockData.stock.map((item) => {
                    const itemConfig = getItemByName(item.itemName);
                    const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                    const loadedDisplay = formatCaseBottleDisplay(item.loaded, bottlesPerCase);
                    const soldDisplay = formatCaseBottleDisplay(item.sold, bottlesPerCase);
                    const returnedDisplay = formatCaseBottleDisplay(item.returned, bottlesPerCase);
                    const remainingDisplay = formatCaseBottleDisplay(item.remaining, bottlesPerCase);
                    
                    return (
                      <div key={item.itemName} className={`border rounded-lg p-3 ${
                        item.remaining > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-500">
                              1 case = {bottlesPerCase} bottles
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${item.remaining > 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {remainingDisplay}
                            </p>
                            <p className="text-xs text-gray-500">available</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center p-2 bg-white rounded border">
                            <div className="text-gray-500">Loaded</div>
                            <div className="font-medium text-blue-600">{loadedDisplay}</div>
                          </div>
                          <div className="text-center p-2 bg-white rounded border">
                            <div className="text-gray-500">Sold</div>
                            <div className="font-medium text-orange-600">{soldDisplay}</div>
                          </div>
                          <div className="text-center p-2 bg-white rounded border">
                            <div className="text-gray-500">Returned</div>
                            <div className="font-medium text-purple-600">{returnedDisplay}</div>
                          </div>
                        </div>
                        
                        {/* Stock Status Indicator */}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.remaining > 0 ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className={`text-xs font-medium ${
                              item.remaining > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {item.remaining > 0 ? 'In Stock' : item.remaining === 0 ? 'Sold Out' : 'Oversold'}
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="flex-1 mx-3">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  item.remaining > 0 ? 'bg-green-500' : 'bg-red-500'
                                }`}
                                style={{ 
                                  width: `${Math.min(100, Math.max(0, (item.remaining / item.loaded) * 100))}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                          
                          <span className="text-xs text-gray-400">
                            {item.loaded > 0 ? Math.round((item.remaining / item.loaded) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No stock assigned for today</p>
                <p className="text-gray-400 text-xs mt-1">Contact admin to get stock assigned</p>
              </div>
            )}
          </div>

          {/* Sales Form */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-5 text-gray-900">New Sale</h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-sm text-gray-600 font-medium mb-1.5">Bill Title</label>
                <input
                  type="text"
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                  placeholder="e.g. April wholesale order"
                  required
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Line items */}
              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const bottlesPerCase = line.item.caseInfo.bottlesPerCase;
                  const { totalQuantity, totalAmount, bottlePrice } = calculateLineItem(line);
                  const stockItem = stockData?.stock.find(s => s.itemName === line.item.name);
                  const availableBottles = stockItem ? stockItem.remaining : 0;
                  const { cases: availableCases, bottles: availableBottlesRemainder } = convertBottlesToCases(availableBottles, bottlesPerCase);
                  
                  return (
                    <div key={line.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => setLines((p) => p.filter((l) => l.id !== line.id))} className="text-gray-300 hover:text-red-500 text-lg leading-none">&times;</button>
                        )}
                      </div>
                      
                      <select
                        value={line.item.name}
                        onChange={(e) => {
                          const item = ITEMS.find((i) => i.name === e.target.value)!;
                          updateLine(line.id, { 
                            item, 
                            variant: item.variants[0], 
                            cases: "",
                            bottles: "",
                            casePrice: ""
                          });
                        }}
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        {ITEMS.map((item) => {
                          const stockItem = stockData?.stock.find(s => s.itemName === item.name);
                          const hasStock = stockItem && stockItem.remaining > 0;
                          const itemConfig = getItemByName(item.name);
                          const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                          const availableDisplay = stockItem ? formatCaseBottleDisplay(stockItem.remaining, bottlesPerCase) : 'No stock';
                          
                          return (
                            <option key={item.name} value={item.name} disabled={!hasStock}>
                              {item.name} {stockItem ? `(${availableDisplay} available)` : '(No stock)'}
                            </option>
                          );
                        })}
                      </select>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Cases</label>
                          <input
                            type="number" 
                            min={0} 
                            max={availableCases}
                            value={line.cases} 
                            placeholder="0"
                            onChange={(e) => {
                              const cases = e.target.value === "" ? "" : parseInt(e.target.value);
                              updateLine(line.id, { cases });
                            }}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Bottles</label>
                          <input
                            type="number" 
                            min={0} 
                            max={(() => {
                              const cases = Number(line.cases) || 0;
                              if (cases >= availableCases) {
                                return availableBottlesRemainder;
                              }
                              return bottlesPerCase - 1;
                            })()} 
                            value={line.bottles} 
                            placeholder="0"
                            onChange={(e) => {
                              const bottles = e.target.value === "" ? "" : parseInt(e.target.value);
                              updateLine(line.id, { bottles });
                            }}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Price per Case</label>
                          <input
                            type="number" 
                            min={0} 
                            step="0.01"
                            value={line.casePrice} 
                            placeholder="0.00"
                            onChange={(e) => {
                              const casePrice = e.target.value === "" ? "" : parseFloat(e.target.value);
                              updateLine(line.id, { casePrice });
                            }}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs">
                        <div className="text-gray-500">
                          <div>1 case = {bottlesPerCase} bottles</div>
                          <div>1 bottle = Rs {bottlePrice > 0 ? bottlePrice.toFixed(2) : '0.00'}</div>
                        </div>
                        <div className="text-right font-medium">
                          <div>Qty: {totalQuantity} bottles</div>
                          <div className="text-lg font-bold text-gray-900">Rs {totalAmount.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      {(() => {
                        if (stockItem && totalQuantity > stockItem.remaining) {
                          return (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                              ⚠️ Only {formatCaseBottleDisplay(stockItem.remaining, bottlesPerCase)} available
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={() => setLines((p) => [...p, newLine()])}
                className="w-full border border-dashed border-gray-300 hover:border-gray-900 text-gray-400 hover:text-gray-900 text-sm py-2 rounded-xl transition-colors">
                + Add another item
              </button>

              {/* Payment */}
              <div>
                <label className="block text-sm text-gray-600 font-medium mb-2">Payment Method</label>
                <div className="flex gap-3">
                  {(["cash", "cheque", "credit"] as const).map((m) => (
                    <label key={m} className={`flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer capitalize text-sm font-medium transition-colors ${paymentMethod === m ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}>
                      <input type="radio" name="payment" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} className="sr-only" />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              {/* Bill image */}
              <div>
                <label className="block text-sm text-gray-600 font-medium mb-1.5">Bill Image (optional)</label>
                <input ref={fileRef} type="file" accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; setBillFile(f); setPreview(f ? URL.createObjectURL(f) : null); }}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:text-xs"
                />
                {preview && <img src={preview} alt="preview" className="mt-2 max-h-32 rounded-lg object-contain border border-gray-200" />}
              </div>

              <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <span className="text-gray-500 text-sm">{lines.length} item{lines.length > 1 ? "s" : ""} · Total</span>
                <span className="text-xl font-bold text-gray-900">Rs {grandTotal.toFixed(2)}</span>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
                {submitting ? "Saving..." : "Record Sale"}
              </button>

              {formMsg && (
                <p className={`text-sm text-center ${formMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{formMsg.text}</p>
              )}
            </form>
          </div>
        </div>

        {/* Sales list */}
        <div className="lg:col-span-3 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {loadingSales ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ))
            ) : (
              <>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-gray-400 text-xs">Total Sales</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900">{filteredSales.length}</p>
                  {paymentFilter !== "all" && (
                    <p className="text-xs text-gray-500 capitalize">{paymentFilter} only</p>
                  )}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-gray-400 text-xs">Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900">Rs {totalRevenue.toFixed(0)}</p>
                  {paymentFilter !== "all" && (
                    <p className="text-xs text-gray-500 capitalize">{paymentFilter} only</p>
                  )}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-gray-400 text-xs">This Month</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">
                    Rs {filteredSales.filter((s) => new Date(s.createdAt).getMonth() === new Date().getMonth()).reduce((a, s) => a + s.totalAmount, 0).toFixed(0)}
                  </p>
                  {paymentFilter !== "all" && (
                    <p className="text-xs text-gray-500 capitalize">{paymentFilter} only</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">My Sales</h2>
                {paymentFilter !== "all" && (
                  <p className="text-xs text-gray-500 mt-1">
                    Showing {filteredSales.length} {paymentFilter} sale{filteredSales.length !== 1 ? 's' : ''} 
                    {sales.length > filteredSales.length && ` of ${sales.length} total`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="all">All Payments</option>
                  <option value="cash">Cash Only</option>
                  <option value="cheque">Cheque Only</option>
                  <option value="credit">Credit Only</option>
                </select>
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ["sales"] })} className="text-xs text-gray-400 hover:text-gray-700">Refresh</button>
              </div>
            </div>

            {loadingSales ? (
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <p className="text-gray-400 text-center py-12 text-sm">
                {paymentFilter === "all" ? "No sales yet." : `No ${paymentFilter} sales found.`}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                      {["SN", "Title", "Item", "Qty", "Unit", "Total", "Payment", "Date", "Bill"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{sale.billNumber}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{sale.billTitle || "Untitled Bill"}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{sale.itemName}</td>
                        <td className="px-4 py-3 text-gray-500">{sale.quantity}</td>
                        <td className="px-4 py-3 text-gray-500">Rs {sale.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">Rs {sale.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PAYMENT_COLORS[sale.paymentMethod] ?? ""}`}>{sale.paymentMethod}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(sale.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {sale.billImageBase64
                            ? <button onClick={() => setBillPreviewModal(sale.billImageBase64)} className="text-blue-600 hover:underline text-xs">View</button>
                            : <span className="text-gray-300 text-xs">—</span>}
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
    </RoleBasedNav>
  );
}
