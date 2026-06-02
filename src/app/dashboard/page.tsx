"use client";

import { useRef, useState } from "react";
import { useSession } from "@/components/offline-auth-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ITEMS, formatCaseBottleDisplay, getItemByName, convertBottlesToCases } from "@/app/lib/items";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Package } from "lucide-react";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import {
  offlineSalesService,
  validateSaleItems,
  submitSaleWithOfflineSupport,
} from "@/lib/offline-sales-service";
import { useSync } from "@/lib/sync/sync-manager";

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
  pendingSync?: boolean;
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
  casePrice: number | "";
  totalQuantity: number;
  totalAmount: number;
};

type SchemeLineItem = {
  id: number;
  item: (typeof ITEMS)[0];
  cases: number | "";
  bottles: number | "";
  totalQuantity: number;
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  credit: "bg-purple-100 text-purple-700",
};

function toDateStr(date: Date) {
  return date.toISOString().split("T")[0];
}

let nextId = 1;
const newLine = (): LineItem => ({
  id: nextId++,
  item: ITEMS[0],
  variant: ITEMS[0].variants[0],
  cases: "",
  bottles: "",
  casePrice: "",
  totalQuantity: 0,
  totalAmount: 0,
});

let nextSchemeId = 1;
const newSchemeLine = (): SchemeLineItem => ({
  id: nextSchemeId++,
  item: ITEMS[0],
  cases: "",
  bottles: "",
  totalQuantity: 0,
});

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const { isOnline, forceSyncAll, refreshStatus } = useSync();

  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [schemeLines, setSchemeLines] = useState<SchemeLineItem[]>([]);
  const [billTitle, setBillTitle] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "cheque" | "credit">("cash");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billPreviewModal, setBillPreviewModal] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = toDateStr(new Date());

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ["sales", selectedDate],
    queryFn: () => offlineSalesService.getSalesForDate(session?.user?.id!, selectedDate),
    enabled: !!session?.user,
  });

  const { data: pendingSales = [], refetch: refetchPending } = useQuery({
    queryKey: ["pending-sales", session?.user?.id],
    queryFn: () => offlineSalesService.getPendingSales(),
    enabled: !!session?.user?.id,
  });

  const { data: stockData, isLoading: stockLoading } = useQuery<StockResponse>({
    queryKey: ["user-stock", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/user-stock?date=${encodeURIComponent(selectedDate)}`);
      if (!res.ok) throw new Error("Failed to fetch stock");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const calculateLineItem = (line: LineItem) => {
    const cases = Number(line.cases) || 0;
    const bottles = Number(line.bottles) || 0;
    const casePrice = Number(line.casePrice) || 0;
    const bottlesPerCase = line.item.caseInfo.bottlesPerCase;

    const totalQuantity = (cases * bottlesPerCase) + bottles;
    const bottlePrice = bottlesPerCase > 0 ? casePrice / bottlesPerCase : 0;
    const totalAmount = (cases * casePrice) + (bottles * bottlePrice);

    return { totalQuantity, totalAmount, bottlePrice };
  };

  const getItemRequestedQuantity = (itemName: string) => {
    const normalQty = lines
      .filter((l) => l.item.name === itemName)
      .reduce((sum, l) => sum + (Number(l.totalQuantity) || 0), 0);
    const schemeQty = schemeLines
      .filter((l) => l.item.name === itemName)
      .reduce((sum, l) => sum + (Number(l.totalQuantity) || 0), 0);
    return normalQty + schemeQty;
  };

  const getLineError = (line: LineItem) => {
    const itemName = line.item.name?.trim();
    if (!itemName) {
      return "Select an item before recording the sale.";
    }

    const price = Number(line.casePrice) || 0;
    if (price <= 0) {
      return `Set a case price for ${itemName}.`;
    }

    const quantity = Number(line.totalQuantity) || 0;
    if (quantity <= 0) {
      return `Enter a quantity for ${itemName}.`;
    }

    const stockItem = stockData?.stock.find((stock) => stock.itemName === itemName);
    if (!stockItem || stockItem.remaining <= 0) {
      return `${itemName} has no available stock.`;
    }

    const combinedRequested = getItemRequestedQuantity(itemName);
    if (combinedRequested > stockItem.remaining) {
      const bottlesPerCase = line.item.caseInfo.bottlesPerCase;
      return `Only ${formatCaseBottleDisplay(stockItem.remaining, bottlesPerCase)} available for ${itemName}.`;
    }

    return null;
  };

  const getSchemeLineError = (line: SchemeLineItem) => {
    const itemName = line.item.name?.trim();
    if (!itemName) {
      return "Select an item before recording the scheme.";
    }

    const quantity = Number(line.totalQuantity) || 0;
    if (quantity <= 0) {
      return `Enter a quantity for scheme ${itemName}.`;
    }

    const stockItem = stockData?.stock.find((stock) => stock.itemName === itemName);
    if (!stockItem || stockItem.remaining <= 0) {
      return `${itemName} has no available stock.`;
    }

    const combinedRequested = getItemRequestedQuantity(itemName);
    if (combinedRequested > stockItem.remaining) {
      const bottlesPerCase = line.item.caseInfo.bottlesPerCase;
      return `Only ${formatCaseBottleDisplay(stockItem.remaining, bottlesPerCase)} available for ${itemName}.`;
    }

    return null;
  };

  const saleValidationError = (() => {
    const activeLines = lines.filter(line => (line.totalQuantity || 0) > 0);
    const activeSchemeLines = schemeLines.filter(line => (line.totalQuantity || 0) > 0);

    if (activeLines.length === 0 && activeSchemeLines.length === 0) {
      return "Add at least one item or scheme item with quantity greater than 0.";
    }

    // Combine active items to send validation payload
    const allActivePendingItems = [
      ...activeLines.map((line) => ({
        itemName: line.item.name,
        quantity: line.totalQuantity,
        unitPrice: line.totalQuantity > 0 ? line.totalAmount / line.totalQuantity : 0,
      })),
      ...activeSchemeLines.map((line) => ({
        itemName: line.item.name,
        quantity: line.totalQuantity,
        unitPrice: 0,
      })),
    ];

    const itemValidationError = validateSaleItems(allActivePendingItems);
    if (itemValidationError) {
      return itemValidationError;
    }

    for (const line of lines) {
      if (line.cases !== "" || line.bottles !== "") {
        const lineError = getLineError(line);
        if (lineError) {
          return lineError;
        }
      }
    }

    for (const line of schemeLines) {
      if (line.cases !== "" || line.bottles !== "") {
        const lineError = getSchemeLineError(line);
        if (lineError) {
          return lineError;
        }
      }
    }

    return null;
  })();

  function updateLine(id: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((line) => {
      if (line.id !== id) return line;
      const updatedLine = { ...line, ...patch };
      const { totalQuantity, totalAmount } = calculateLineItem(updatedLine);
      return { ...updatedLine, totalQuantity, totalAmount };
    }));
  }

  const calculateSchemeLineItem = (line: SchemeLineItem) => {
    const cases = Number(line.cases) || 0;
    const bottles = Number(line.bottles) || 0;
    const bottlesPerCase = line.item.caseInfo.bottlesPerCase;
    const totalQuantity = (cases * bottlesPerCase) + bottles;
    return { totalQuantity };
  };

  function updateSchemeLine(id: number, patch: Partial<SchemeLineItem>) {
    setSchemeLines((prev) => prev.map((line) => {
      if (line.id !== id) return line;
      const updatedLine = { ...line, ...patch };
      const { totalQuantity } = calculateSchemeLineItem(updatedLine);
      return { ...updatedLine, totalQuantity };
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user) return;

    if (saleValidationError) {
      setFormMsg({ type: "error", text: saleValidationError });
      return;
    }

    setSubmitting(true);
    setFormMsg(null);

    const activeLines = lines.filter(line => (line.totalQuantity || 0) > 0);
    const activeSchemeLines = schemeLines.filter(line => (line.totalQuantity || 0) > 0);

    const items = [
      ...activeLines.map((line) => ({
        itemName: line.item.name,
        quantity: line.totalQuantity,
        unitPrice: line.totalQuantity > 0 ? line.totalAmount / line.totalQuantity : 0,
      })),
      ...activeSchemeLines.map((line) => ({
        itemName: line.item.name,
        quantity: line.totalQuantity,
        unitPrice: 0,
      })),
    ];

    const result = await submitSaleWithOfflineSupport({
      userId: session.user.id,
      billTitle: billTitle.trim(),
      items,
      paymentMethod,
      billFile,
    });

    setSubmitting(false);

    if (!result.ok) {
      setFormMsg({ type: "error", text: result.error ?? "Something went wrong." });
      return;
    }

    setFormMsg({
      type: "success",
      text: result.offline
        ? "Sale saved on this device. It will sync when you are online (or tap Sync Now)."
        : "Sale recorded.",
    });
    setLines([newLine()]);
    setSchemeLines([]);
    setBillTitle("");
    setBillFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";

    queryClient.invalidateQueries({ queryKey: ["sales", selectedDate] });
    queryClient.invalidateQueries({ queryKey: ["user-stock", selectedDate] });
    refetchPending();
    refreshStatus();

    if (!result.offline && isOnline) {
      try {
        await forceSyncAll();
      } catch {
        // queue may still have other items
      }
    }
  }

  if (isPending || !session?.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingRows = pendingSales;
  const pendingForDate = pendingRows.filter((row) => row.createdAt.split("T")[0] === selectedDate);

  const allSales: Sale[] = [
    ...sales,
    ...pendingForDate
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredSales = paymentFilter === "all"
    ? allSales
    : allSales.filter((sale) => sale.paymentMethod === paymentFilter);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const grandTotal = lines.reduce((sum, line) => sum + line.totalAmount, 0);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 flex flex-col gap-4 sm:gap-6">
      <section className="order-1 bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-5 text-gray-900">New Sale</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 font-medium mb-1.5">Bill Title</label>
            <input
              type="text"
              value={billTitle}
              onChange={(event) => setBillTitle(event.target.value)}
              placeholder="e.g. April wholesale order"
              required
              className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const bottlesPerCase = line.item.caseInfo.bottlesPerCase;
              const { totalQuantity, totalAmount, bottlePrice } = calculateLineItem(line);
              const stockItem = stockData?.stock.find((stock) => stock.itemName === line.item.name);
              const availableBottles = stockItem ? stockItem.remaining : 0;
              const { cases: availableCases, bottles: availableBottlesRemainder } = convertBottlesToCases(availableBottles, bottlesPerCase);

              return (
                <div key={line.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">Item {index + 1}</span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((existingLine) => existingLine.id !== line.id))}
                        className="text-gray-300 hover:text-red-500 text-lg leading-none"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  <select
                    value={line.item.name}
                    onChange={(event) => {
                      const item = ITEMS.find((existingItem) => existingItem.name === event.target.value)!;
                      updateLine(line.id, {
                        item,
                        variant: item.variants[0],
                        cases: "",
                        bottles: "",
                        casePrice: "",
                      });
                    }}
                    className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {ITEMS.map((item) => {
                      const stockItem = stockData?.stock.find((stock) => stock.itemName === item.name);
                      const hasStock = !!stockItem && stockItem.remaining > 0;
                      const itemConfig = getItemByName(item.name);
                      const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                      const availableDisplay = stockItem ? formatCaseBottleDisplay(stockItem.remaining, bottlesPerCase) : "No stock";

                      return (
                        <option key={item.name} value={item.name} disabled={!hasStock}>
                          {item.name} {stockItem ? `(${availableDisplay} available)` : "(No stock)"}
                        </option>
                      );
                    })}
                  </select>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cases</label>
                      <input
                        type="number"
                        min={0}
                        max={availableCases}
                        value={line.cases}
                        placeholder="0"
                        onChange={(event) => {
                          const cases = event.target.value === "" ? "" : parseInt(event.target.value, 10);
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
                          if (cases >= availableCases) return availableBottlesRemainder;
                          return bottlesPerCase - 1;
                        })()}
                        value={line.bottles}
                        placeholder="0"
                        onChange={(event) => {
                          const bottles = event.target.value === "" ? "" : parseInt(event.target.value, 10);
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
                        onChange={(event) => {
                          const casePrice = event.target.value === "" ? "" : parseFloat(event.target.value);
                          updateLine(line.id, { casePrice });
                        }}
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className="text-gray-500">
                      <div>1 case = {bottlesPerCase} bottles</div>
                      <div>1 bottle = Rs {bottlePrice > 0 ? bottlePrice.toFixed(2) : "0.00"}</div>
                    </div>
                    <div className="text-right font-medium">
                      <div>Qty: {totalQuantity} bottles</div>
                      <div className="text-lg font-bold text-gray-900">Rs {totalAmount.toFixed(2)}</div>
                    </div>
                  </div>

                  {getLineError(line) && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      ⚠️ {getLineError(line)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="w-full border border-dashed border-gray-300 hover:border-gray-900 text-gray-400 hover:text-gray-900 text-sm py-2 rounded-xl transition-colors"
          >
            + Add another item
          </button>

          {/* Scheme Items Section */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-500" />
              Scheme Items (Free Stock)
            </h3>
            
            {schemeLines.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No scheme items added to this bill.</p>
            ) : (
              <div className="space-y-3">
                {schemeLines.map((line, index) => {
                  const bottlesPerCase = line.item.caseInfo.bottlesPerCase;
                  const stockItem = stockData?.stock.find((stock) => stock.itemName === line.item.name);
                  const availableBottles = stockItem ? stockItem.remaining : 0;
                  const { cases: availableCases, bottles: availableBottlesRemainder } = convertBottlesToCases(availableBottles, bottlesPerCase);

                  return (
                    <div key={line.id} className="bg-blue-50/40 border border-blue-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-medium">Scheme Item {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => setSchemeLines((prev) => prev.filter((existingLine) => existingLine.id !== line.id))}
                          className="text-gray-300 hover:text-red-500 text-lg leading-none"
                        >
                          &times;
                        </button>
                      </div>

                      <select
                        value={line.item.name}
                        onChange={(event) => {
                          const item = ITEMS.find((existingItem) => existingItem.name === event.target.value)!;
                          updateSchemeLine(line.id, {
                            item,
                            cases: "",
                            bottles: "",
                          });
                        }}
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {ITEMS.map((item) => {
                          const stockItem = stockData?.stock.find((stock) => stock.itemName === item.name);
                          const hasStock = !!stockItem && stockItem.remaining > 0;
                          const itemConfig = getItemByName(item.name);
                          const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                          const availableDisplay = stockItem ? formatCaseBottleDisplay(stockItem.remaining, bottlesPerCase) : "No stock";

                          return (
                            <option key={item.name} value={item.name} disabled={!hasStock}>
                              {item.name} {stockItem ? `(${availableDisplay} available)` : "(No stock)"}
                            </option>
                          );
                        })}
                      </select>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-blue-600 mb-1">Cases</label>
                          <input
                            type="number"
                            min={0}
                            max={availableCases}
                            value={line.cases}
                            placeholder="0"
                            onChange={(event) => {
                              const cases = event.target.value === "" ? "" : parseInt(event.target.value, 10);
                              updateSchemeLine(line.id, { cases });
                            }}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-blue-600 mb-1">Bottles</label>
                          <input
                            type="number"
                            min={0}
                            max={(() => {
                              const cases = Number(line.cases) || 0;
                              if (cases >= availableCases) return availableBottlesRemainder;
                              return bottlesPerCase - 1;
                            })()}
                            value={line.bottles}
                            placeholder="0"
                            onChange={(event) => {
                              const bottles = event.target.value === "" ? "" : parseInt(event.target.value, 10);
                              updateSchemeLine(line.id, { bottles });
                            }}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <div className="text-gray-400">
                          <div>1 case = {bottlesPerCase} bottles</div>
                          <div className="text-blue-600 font-medium font-sans">Price: Not Applicable (Free)</div>
                        </div>
                        <div className="text-right font-medium">
                          <div className="text-blue-800">Qty: {line.totalQuantity} bottles</div>
                        </div>
                      </div>

                      {getSchemeLineError(line) && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          ⚠️ {getSchemeLineError(line)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            <button
              type="button"
              onClick={() => setSchemeLines((prev) => [...prev, newSchemeLine()])}
              className="w-full border border-dashed border-blue-200 hover:border-blue-500 text-blue-400 hover:text-blue-600 text-sm py-2 rounded-xl transition-colors bg-blue-50/10 hover:bg-blue-50/20"
            >
              + Add scheme item
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-600 font-medium mb-2">Payment Method</label>
            <div className="flex gap-3">
              {(["cash", "cheque", "credit"] as const).map((method) => (
                <label
                  key={method}
                  className={`flex-1 flex items-center justify-center py-2 rounded-lg border cursor-pointer capitalize text-sm font-medium transition-colors ${
                    paymentMethod === method
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                    className="sr-only"
                  />
                  {method}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 font-medium mb-1.5">Bill Image (optional)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setBillFile(file);
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:text-xs"
            />
            {preview && <img src={preview} alt="preview" className="mt-2 max-h-32 rounded-lg object-contain border border-gray-200" />}
          </div>

          <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <span className="text-gray-500 text-sm">
              {lines.filter(l => l.totalQuantity > 0).length} regular item{lines.filter(l => l.totalQuantity > 0).length !== 1 ? "s" : ""}
              {schemeLines.filter(l => l.totalQuantity > 0).length > 0 && ` · ${schemeLines.filter(l => l.totalQuantity > 0).length} scheme item${schemeLines.filter(l => l.totalQuantity > 0).length !== 1 ? "s" : ""}`}
              {" "}· Total
            </span>
            <span className="text-xl font-bold text-gray-900">Rs {grandTotal.toFixed(2)}</span>
          </div>

          <button
            type="submit"
            disabled={submitting || !!saleValidationError}
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
      </section>

      <section className="order-2">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-4 sm:mb-6">
          <div className="flex items-start sm:items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 shrink-0">
              <Package className="w-5 h-5" />
              My Stock
            </h2>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <OfflineSyncStatus compact className="shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              {stockData && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${stockData.hasStock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {stockData.hasStock ? (() => {
                    const totalBottles = stockData.totalItems;
                    const firstStockItem = stockData.stock[0];
                    if (firstStockItem) {
                      const itemConfig = getItemByName(firstStockItem.itemName);
                      const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                      return formatCaseBottleDisplay(totalBottles, bottlesPerCase);
                    }
                    return `${totalBottles} items available`;
                  })() : "No stock assigned"}
                </span>
              )}
            </div>
          </div>

          {stockLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : stockData?.hasStock ? (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="text-sm font-medium text-blue-800">
                    Stock Summary ({selectedDate === today ? "Today" : selectedDate})
                  </span>
                  <span className="text-sm text-blue-600">
                    {stockData.stock.length} item{stockData.stock.length > 1 ? "s" : ""} assigned
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-blue-600">Total Loaded:</span>
                    <div className="font-bold text-blue-800">{stockData.stock.reduce((sum, item) => sum + item.loaded, 0)} bottles</div>
                  </div>
                  <div>
                    <span className="text-blue-600">Total Sold:</span>
                    <div className="font-bold text-blue-800">{stockData.stock.reduce((sum, item) => sum + item.sold, 0)} bottles</div>
                  </div>
                  <div>
                    <span className="text-blue-600">Remaining:</span>
                    <div className="font-bold text-blue-800">{stockData.totalItems} bottles</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-none md:max-h-128 overflow-y-visible md:overflow-y-auto pr-0 md:pr-1">
                {stockData.stock.map((item) => {
                  const itemConfig = getItemByName(item.itemName);
                  const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                  const loadedDisplay = formatCaseBottleDisplay(item.loaded, bottlesPerCase);
                  const soldDisplay = formatCaseBottleDisplay(item.sold, bottlesPerCase);
                  const returnedDisplay = formatCaseBottleDisplay(item.returned, bottlesPerCase);
                  const remainingDisplay = formatCaseBottleDisplay(item.remaining, bottlesPerCase);

                  return (
                    <div
                      key={item.itemName}
                      className={`border rounded-lg p-3 ${item.remaining > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-xs text-gray-500">1 case = {bottlesPerCase} bottles</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${item.remaining > 0 ? "text-green-700" : "text-red-700"}`}>
                            {remainingDisplay}
                          </p>
                          <p className="text-xs text-gray-500">available</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
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

                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {item.remaining > 0 ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                          <span className={`text-xs font-medium ${item.remaining > 0 ? "text-green-700" : "text-red-700"}`}>
                            {item.remaining > 0 ? "In Stock" : item.remaining === 0 ? "Sold Out" : "Oversold"}
                          </span>
                        </div>

                        <div className="flex-1 sm:mx-3">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${item.remaining > 0 ? "bg-green-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, Math.max(0, (item.remaining / item.loaded) * 100))}%` }}
                            />
                          </div>
                        </div>

                        <span className="text-xs text-gray-400 sm:shrink-0">
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
      </section>

      <section className="order-3 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {loadingSales ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-gray-400 text-xs">Total Sales</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{filteredSales.length}</p>
                {paymentFilter !== "all" && <p className="text-xs text-gray-500 capitalize">{paymentFilter} only</p>}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-gray-400 text-xs">Revenue</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">Rs {totalRevenue.toFixed(0)}</p>
                {paymentFilter !== "all" && <p className="text-xs text-gray-500 capitalize">{paymentFilter} only</p>}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-gray-400 text-xs">{selectedDate === today ? "Today's Bills" : `Bills on ${selectedDate}`}</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{new Set(filteredSales.map((sale) => sale.billNumber || sale.id)).size}</p>
                {paymentFilter !== "all" && <p className="text-xs text-gray-500 capitalize">{paymentFilter} only</p>}
              </div>
            </>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">My Sales</h2>
              <p className="text-xs text-gray-500 mt-1">
                {selectedDate === today ? "Today" : selectedDate}
                {paymentFilter !== "all" && ` · ${paymentFilter} only`}
                {paymentFilter !== "all" && filteredSales.length !== sales.length && ` (${filteredSales.length} of ${sales.length})`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash Only</option>
                <option value="cheque">Cheque Only</option>
                <option value="credit">Credit Only</option>
              </select>
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["sales", selectedDate] });
                  queryClient.invalidateQueries({ queryKey: ["user-stock", selectedDate] });
                }}
                className="text-xs text-gray-400 hover:text-gray-700 px-2"
              >
                Refresh
              </button>
            </div>
          </div>

          {loadingSales ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="px-4 py-3 flex gap-4">
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
              {paymentFilter === "all"
                ? `No sales on ${selectedDate}.`
                : `No ${paymentFilter} sales on ${selectedDate}.`}
            </p>
          ) : (
            <>
              <div className="sm:hidden divide-y divide-gray-100">
                {filteredSales.map((sale) => (
                  <div key={sale.id} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{sale.billTitle || "Untitled Bill"}</p>
                        <p className="text-xs text-gray-500 font-mono">#{sale.billNumber}{sale.pendingSync ? " (pending)" : ""}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${PAYMENT_COLORS[sale.paymentMethod] ?? ""}`}>
                        {sale.paymentMethod}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-gray-400">Item</div>
                        <div className="font-medium text-gray-900 wrap-break-word">
                          {sale.itemName}
                          {sale.unitPrice === 0 && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                              Scheme
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-gray-400">Qty</div>
                        <div className="font-medium text-gray-900">{sale.quantity}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-gray-400">Unit</div>
                        <div className="font-medium text-gray-900">
                          {sale.unitPrice === 0 ? "Scheme" : `Rs ${sale.unitPrice.toFixed(2)}`}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-gray-400">Total</div>
                        <div className="font-semibold text-gray-900">
                          {sale.unitPrice === 0 ? "—" : `Rs ${sale.totalAmount.toFixed(2)}`}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 col-span-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-gray-400">Date</div>
                          <div className="font-medium text-gray-900">{new Date(sale.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div>
                          {sale.billImageBase64 ? (
                            <button onClick={() => setBillPreviewModal(sale.billImageBase64)} className="text-blue-600 hover:underline text-xs">
                              View bill
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">No bill</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                      {['SN', 'Title', 'Item', 'Qty', 'Unit', 'Total', 'Payment', 'Date', 'Bill'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left font-medium">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">
                          {sale.billNumber}
                          {sale.pendingSync && <span className="ml-1 text-amber-600 font-sans">(pending)</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{sale.billTitle || "Untitled Bill"}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {sale.itemName}
                          {sale.unitPrice === 0 && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Scheme
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{sale.quantity}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {sale.unitPrice === 0 ? "—" : `Rs ${sale.unitPrice.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {sale.unitPrice === 0 ? "—" : `Rs ${sale.totalAmount.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PAYMENT_COLORS[sale.paymentMethod] ?? ""}`}>
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(sale.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {sale.billImageBase64 ? (
                            <button onClick={() => setBillPreviewModal(sale.billImageBase64)} className="text-blue-600 hover:underline text-xs">
                              View
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {billPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBillPreviewModal(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-xl w-full border border-gray-200 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium text-sm text-gray-900">Bill Image</span>
              <button onClick={() => setBillPreviewModal(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
                &times;
              </button>
            </div>
            <img src={billPreviewModal} alt="Bill" className="w-full max-h-[70vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}