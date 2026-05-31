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
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Clock,
  DollarSign
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
  cases: number;
  bottles: number;
  totalBottles: number;
};

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
  const [stockItems, setStockItems] = useState<StockItem[]>([
    { itemName: ITEMS[0].name, cases: 0, bottles: 0, totalBottles: 0 }
  ]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Calculate total bottles for an item
  const calculateTotalBottles = (item: StockItem): number => {
    const itemConfig = getItemByName(item.itemName);
    if (!itemConfig) return 0;
    return convertCasesToBottles(item.cases, item.bottles, itemConfig.caseInfo.bottlesPerCase);
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
      setActiveTab(tabParam as "assign" | "summary" | "returns");
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
  const hasSales = sales.length > 0;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);

  const addStockItem = () => {
    setStockItems(prev => [...prev, { itemName: ITEMS[0].name, cases: 0, bottles: 0, totalBottles: 0 }]);
  };

  const removeStockItem = (index: number) => {
    setStockItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateStockItem = (index: number, field: keyof StockItem, value: any) => {
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
    const validItems = stockItems.filter(item => calculateTotalBottles(item) > 0);
    if (validItems.length === 0) {
      setMessage({ type: "error", text: "Please add at least one item with quantity > 0" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/van-load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          date: selectedDate,
          items: validItems.map(item => ({
            itemName: item.itemName,
            loaded: calculateTotalBottles(item),
            returned: 0
          }))
        })
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Stock assigned successfully!" });
        setStockItems([{ itemName: ITEMS[0].name, cases: 0, bottles: 0, totalBottles: 0 }]);
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

  const handleUpdateReturns = async (itemName: string, returnedQuantity: number) => {
    try {
      const load = vanLoads.find(l => l.itemName === itemName);
      if (!load) return;

      const res = await fetch("/api/van-load", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: load.id,
          returned: returnedQuantity
        })
      });

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["van-loads-user", user?.id, selectedDate] });
        setMessage({ type: "success", text: "Returns updated successfully!" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update returns" });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {loadingUser ? <Skeleton className="h-8 w-48" /> : `${user?.username} Panel`}
            </h1>
            <p className="text-gray-600 mt-1">Manage stock and track sales for this user</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Status</p>
                <p className="text-2xl font-bold">
                  {hasAssignedStock ? "Assigned" : "Not Assigned"}
                </p>
              </div>
              <Package className={`h-8 w-8 ${hasAssignedStock ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold">{sales.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold">Rs {totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Items Remaining</p>
                <p className="text-2xl font-bold">
                  {stockSummary.reduce((sum, item) => sum + Math.max(0, item.remaining), 0)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("assign")}
          disabled={hasAssignedStock}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "assign"
              ? "bg-blue-100 text-blue-700 border border-blue-200"
              : hasAssignedStock
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Package className="w-4 h-4" />
          Assign Stock
          {hasAssignedStock && <CheckCircle className="w-4 h-4 text-green-600" />}
        </button>
        
        <button
          onClick={() => setActiveTab("summary")}
          disabled={!hasAssignedStock}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "summary"
              ? "bg-green-100 text-green-700 border border-green-200"
              : !hasAssignedStock
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Eye className="w-4 h-4" />
          Stock Summary
        </button>
        
        <button
          onClick={() => setActiveTab("returns")}
          disabled={!hasSales}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "returns"
              ? "bg-orange-100 text-orange-700 border border-orange-200"
              : !hasSales
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Manage Returns
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "assign" && !hasAssignedStock && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Stock to {user?.username}</CardTitle>
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
                          onChange={(e) => updateStockItem(index, 'cases', parseInt(e.target.value) || 0)}
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
                            const bottles = parseInt(e.target.value) || 0;
                            if (bottles < bottlesPerCase) {
                              updateStockItem(index, 'bottles', bottles);
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
              <Button onClick={handleAssignStock} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Assigning..." : "Assign Stock"}
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

      {activeTab === "summary" && hasAssignedStock && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Summary - {user?.username} ({selectedDate})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2">Loaded</th>
                    <th className="text-right p-2">Sold</th>
                    <th className="text-right p-2">Remaining</th>
                    <th className="text-right p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.map(item => {
                    const itemConfig = getItemByName(item.itemName);
                    const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                    
                    return (
                      <tr key={item.itemName} className="border-b">
                        <td className="p-2 font-medium">{item.itemName}</td>
                        <td className="p-2 text-right">
                          {formatCaseBottleDisplay(item.loaded, bottlesPerCase)}
                        </td>
                        <td className="p-2 text-right">
                          {formatCaseBottleDisplay(item.sold, bottlesPerCase)}
                        </td>
                        <td className={`p-2 text-right font-bold ${
                          item.remaining >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {formatCaseBottleDisplay(item.remaining, bottlesPerCase)}
                        </td>
                        <td className="p-2 text-right">
                          {item.remaining > 0 ? (
                            <span className="text-green-600">✓</span>
                          ) : item.remaining === 0 ? (
                            <span className="text-blue-600">Sold Out</span>
                          ) : (
                            <span className="text-red-600">Over Sold</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "returns" && hasSales && (
        <Card>
          <CardHeader>
            <CardTitle>Manage Returns - {user?.username} ({selectedDate})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stockSummary.map(item => {
                const itemConfig = getItemByName(item.itemName);
                const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                const load = vanLoads.find(l => l.itemName === item.itemName);
                
                return (
                  <div key={item.itemName} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{item.itemName}</h4>
                      <p className="text-sm text-gray-600">
                        Remaining: {formatCaseBottleDisplay(item.remaining, bottlesPerCase)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <Label>Returned Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          max={item.remaining}
                          value={item.returned}
                          onChange={(e) => {
                            const returned = parseInt(e.target.value) || 0;
                            if (returned <= item.remaining) {
                              handleUpdateReturns(item.itemName, returned);
                            }
                          }}
                          className="w-24"
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        Max: {formatCaseBottleDisplay(item.remaining, bottlesPerCase)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {activeTab === "assign" && hasAssignedStock && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle className="h-6 w-6" />
              <div>
                <p className="font-medium">Stock Already Assigned</p>
                <p className="text-sm text-gray-600">Stock has been assigned to {user?.username} for {selectedDate}. Use the Summary tab to view details.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "summary" && !hasAssignedStock && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-orange-700">
              <AlertCircle className="h-6 w-6" />
              <div>
                <p className="font-medium">No Stock Assigned</p>
                <p className="text-sm text-gray-600">Please assign stock to {user?.username} first using the Assign Stock tab.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "returns" && !hasSales && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-blue-700">
              <AlertCircle className="h-6 w-6" />
              <div>
                <p className="font-medium">No Sales Yet</p>
                <p className="text-sm text-gray-600">{user?.username} hasn't made any sales yet for {selectedDate}. Returns can be managed after sales are recorded.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}