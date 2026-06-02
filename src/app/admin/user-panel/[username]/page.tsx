"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ITEMS, formatCaseBottleDisplay, getItemByName, convertBottlesToCases, convertCasesToBottles } from "@/app/lib/items";
import { 
  Users, 
  Package, 
  Plus, 
  Trash2, 
  Save, 
  Eye,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type User = {
  id: string;
  username: string;
};

type VanLoad = {
  id: string;
  itemName: string;
  loaded: number;
  returned: number;
  userId: string;
  date: string;
  createdAt: string;
  user: { username: string };
};

type Sale = {
  id: string;
  itemName: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  userId: string;
  user: { username: string };
};

type StockItem = {
  itemName: string;
  cases: number | "";
  bottles: number | "";
  totalBottles: number;
};

const emptyStockItem = (itemName: string = ITEMS[0].name): StockItem => ({
  itemName,
  cases: "",
  bottles: "",
  totalBottles: 0,
});

type UserStockSummary = {
  itemName: string;
  loaded: number;
  sold: number;
  remaining: number;
  returned: number;
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function UserPanelPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [activeTab, setActiveTab] = useState<"assign" | "summary" | "returns">("assign");
  
  // Stock assignment state
  const [stockItems, setStockItems] = useState<StockItem[]>([emptyStockItem()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Calculate total bottles for an item
  const calculateTotalBottles = (item: StockItem): number => {
    const itemConfig = getItemByName(item.itemName);
    if (!itemConfig) return 0;
    const cases = Number(item.cases) || 0;
    const bottles = Number(item.bottles) || 0;
    return convertCasesToBottles(cases, bottles, itemConfig.caseInfo.bottlesPerCase);
  };

  useEffect(() => {
    if (!isPending) {
      if (!session?.user) { router.push("/login"); return; }
      if (session.user.role !== "admin") { router.push("/dashboard"); return; }
    }
  }, [isPending, session, router]);

  // Set initial tab based on URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['assign', 'summary', 'returns'].includes(tabParam)) {
      const timeoutId = setTimeout(() => {
        setActiveTab(tabParam as "assign" | "summary" | "returns");
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [searchParams]);

  const { data: user, isLoading: loadingUser } = useQuery<User>({
    queryKey: ["user-by-username", username],
    queryFn: async () => {
      const res = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: !!username && session?.user?.role === "admin",
  });

  const { data: vanLoads = [], isLoading: loadingLoads } = useQuery<VanLoad[]>({
    queryKey: ["van-loads-user", user?.id, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/van-loads?userId=${user?.id}&date=${selectedDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && !!selectedDate && session?.user?.role === "admin",
  });

  const { data: sales = [], isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ["sales-user", user?.id, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/sales?userId=${user?.id}&date=${selectedDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && !!selectedDate && session?.user?.role === "admin",
  });

  if (isPending || !session?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate user stock summary
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

  const hasAssignedStock = vanLoads.length > 0;

  const addStockItem = () => {
    setStockItems(prev => [...prev, emptyStockItem()]);
  };

  const removeStockItem = (index: number) => {
    setStockItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateStockItem = (index: number, field: keyof StockItem, value: string | number | "") => {
    setStockItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'cases' || field === 'bottles') {
          updatedItem.totalBottles = calculateTotalBottles(updatedItem);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const handleAssignStock = async () => {
    if (!user?.id) {
      setMessage({ type: "error", text: "User not found. Please refresh the page." });
      return;
    }

    const validItems = stockItems.filter(item => calculateTotalBottles(item) > 0);
    if (validItems.length === 0) {
      setMessage({ type: "error", text: "Please add at least one item with quantity > 0" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const requestBody = {
        userId: user.id,
        date: selectedDate,
        items: validItems.map(item => ({
          itemName: item.itemName,
          loaded: calculateTotalBottles(item),
          returned: 0
        }))
      };

      const res = await fetch("/api/van-load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (res.ok) {
        const data = await res.json();
        const itemCount = validItems.length;
        const assignmentNumber = vanLoads.length > 0 ? vanLoads.length + 1 : 1;
        
        setMessage({ 
          type: "success", 
          text: `Load #${assignmentNumber} added successfully! (${itemCount} item${itemCount > 1 ? 's' : ''})` 
        });
        setStockItems([emptyStockItem()]);
        queryClient.invalidateQueries({ queryKey: ["van-loads-user", user?.id, selectedDate] });
        setActiveTab("summary"); // Switch to summary tab after assignment
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to assign stock" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error occurred" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3 md:gap-4 min-w-0">
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
            size="icon"
            className="shrink-0"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold leading-tight break-words">
              {loadingUser ? <Skeleton className="h-7 w-44" /> : `${user?.username}'s Panel`}
            </h1>
            <p className="text-sm text-gray-600 mt-1">Manage stock and track sales</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("assign")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "assign"
              ? "bg-blue-100 text-blue-700 border border-blue-200"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Package className="w-4 h-4" />
          Assign Stock
          {hasAssignedStock && <CheckCircle className="w-4 h-4 text-green-600" />}
        </button>
        
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "summary"
              ? "bg-green-100 text-green-700 border border-green-200"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Eye className="w-4 h-4" />
          Stock Summary
          {hasAssignedStock && <CheckCircle className="w-4 h-4 text-green-600" />}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "assign" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {hasAssignedStock ? `Add More Stock to ${user?.username}` : `Assign Stock to ${user?.username}`}
            </CardTitle>
            {hasAssignedStock && (
              <p className="text-sm text-gray-600">
                {user?.username} already has stock assigned for {selectedDate}. You can add more items below.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Stock Items</h3>
                <Button onClick={addStockItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {stockItems.map((item, index) => {
                const itemConfig = getItemByName(item.itemName);
                const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                
                return (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <select
                      value={item.itemName}
                      onChange={(e) => updateStockItem(index, 'itemName', e.target.value)}
                      className="flex-1 p-2 border rounded-md"
                    >
                      {ITEMS.map(i => (
                        <option key={i.name} value={i.name}>{i.name}</option>
                      ))}
                    </select>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <Label>Cases</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.cases}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateStockItem(index, "cases", v === "" ? "" : parseInt(v, 10) || 0);
                          }}
                        />
                      </div>
                      
                      <div className="w-20">
                        <Label>Bottles</Label>
                        <Input
                          type="number"
                          min="0"
                          max={bottlesPerCase - 1}
                          placeholder="0"
                          value={item.bottles}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") {
                              updateStockItem(index, "bottles", "");
                              return;
                            }
                            const bottles = parseInt(v, 10);
                            if (!isNaN(bottles) && bottles < bottlesPerCase) {
                              updateStockItem(index, "bottles", bottles);
                            }
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 text-center min-w-20">
                      <div>1 case =</div>
                      <div>{bottlesPerCase} bottles</div>
                    </div>
                    
                    {stockItems.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeStockItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <Button onClick={handleAssignStock} disabled={saving || !user?.id}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Assigning..." : hasAssignedStock ? "Add More Stock" : "Assign Stock"}
              </Button>
              
              {message && (
                <span className={`text-sm font-medium ${
                  message.type === "success" ? "text-green-600" : "text-red-600"
                }`}>
                  {message.text}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "summary" && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Summary - {user?.username} ({selectedDate})</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasAssignedStock ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                <p className="text-gray-700 font-medium mb-2">No Stock Assigned for {selectedDate}</p>
                <p className="text-sm text-gray-500 mb-4">
                  Please assign stock to {user?.username} for this date first, or select a different date.
                </p>
                <Button 
                  onClick={() => setActiveTab("assign")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Assign Stock
                </Button>
              </div>
            ) : stockSummary.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No stock data found for this date</p>
                <p className="text-sm text-gray-400">Try selecting a different date or assign stock first</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="sm:hidden space-y-3">
                  {stockSummary.map(item => {
                    const itemConfig = getItemByName(item.itemName);
                    const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                    const itemLoads = vanLoads.filter(load => load.itemName === item.itemName);
                    return (
                      <div key={item.itemName} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-500">1 case = {bottlesPerCase} bottles</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            item.remaining > 0
                              ? "bg-green-100 text-green-700"
                              : item.remaining === 0
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-700"
                          }`}>
                            {item.remaining > 0 ? "Good" : item.remaining === 0 ? "Sold Out" : "Over Sold"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Loaded</div>
                            <div className="font-medium text-gray-900">{formatCaseBottleDisplay(item.loaded, bottlesPerCase)}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Sold</div>
                            <div className="font-medium text-gray-900">{formatCaseBottleDisplay(item.sold, bottlesPerCase)}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">To Return</div>
                            <div className={`font-semibold ${item.remaining >= 0 ? "text-green-700" : "text-red-700"}`}>
                              {formatCaseBottleDisplay(item.remaining, bottlesPerCase)}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-gray-500">Assignments</div>
                            <div className="font-medium text-gray-900">{itemLoads.length}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Item</th>
                      <th className="text-right p-2">Previously Added</th>
                      <th className="text-right p-2">Total Loaded</th>
                      <th className="text-right p-2">Sold</th>
                      <th className="text-right p-2">To Return</th>
                      <th className="text-right p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockSummary.map(item => {
                      const itemConfig = getItemByName(item.itemName);
                      const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                      
                      // Get all loads for this item to show individual assignments
                      const itemLoads = vanLoads.filter(load => load.itemName === item.itemName);
                      
                      return (
                        <tr key={item.itemName} className="border-b">
                          <td className="p-2 font-medium align-top">{item.itemName}</td>
                          <td className="p-2 text-right align-top">
                            <div className="space-y-1">
                              {itemLoads.length > 0 ? (
                                <>
                                  {itemLoads.map((load, index) => (
                                    <div key={load.id} className="text-xs border-b border-gray-100 pb-1 mb-1 last:border-b-0">
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Load #{index + 1}:</span>
                                        <span className="font-medium text-gray-700">
                                          {formatCaseBottleDisplay(load.loaded, bottlesPerCase)}
                                        </span>
                                      </div>
                                      <div className="text-gray-400 text-xs">
                                        {new Date(load.createdAt).toLocaleTimeString([], { 
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                  <div className="text-xs font-medium text-blue-600 pt-1 border-t border-blue-100">
                                    {itemLoads.length} assignment{itemLoads.length > 1 ? 's' : ''}
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">No loads</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right align-top font-medium">
                            {formatCaseBottleDisplay(item.loaded, bottlesPerCase)}
                          </td>
                          <td className="p-2 text-right align-top">
                            {formatCaseBottleDisplay(item.sold, bottlesPerCase)}
                          </td>
                          <td className={`p-2 text-right font-bold align-top ${
                            item.remaining >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {formatCaseBottleDisplay(item.remaining, bottlesPerCase)}
                          </td>
                          <td className="p-2 text-right align-top">
                            {item.remaining > 0 ? (
                              <span className="text-green-600 text-xs">✓ Good</span>
                            ) : item.remaining === 0 ? (
                              <span className="text-blue-600 text-xs">Sold Out</span>
                            ) : (
                              <span className="text-red-600 text-xs">Over Sold</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                
                {/* Summary Row */}
                {stockSummary.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Total Assignments:</span>
                        <div className="text-lg font-bold text-purple-600">
                          {vanLoads.length} loads
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Total Loaded:</span>
                        <div className="text-lg font-bold text-blue-600">
                          {stockSummary.reduce((sum, item) => sum + item.loaded, 0)} bottles
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Total Sold:</span>
                        <div className="text-lg font-bold text-orange-600">
                          {stockSummary.reduce((sum, item) => sum + item.sold, 0)} bottles
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Total To Return:</span>
                        <div className={`text-lg font-bold ${
                          stockSummary.reduce((sum, item) => sum + item.remaining, 0) >= 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {stockSummary.reduce((sum, item) => sum + item.remaining, 0)} bottles
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}