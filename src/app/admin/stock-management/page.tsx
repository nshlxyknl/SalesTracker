"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ITEMS, formatCaseBottleDisplay, getItemByName, convertCasesToBottles } from "@/app/lib/items";
import { 
  Users, 
  Package, 
  Plus, 
  Trash2, 
  Save, 
  Eye,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  RefreshCw
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

type UserStockItem = {
  itemName: string;
  loaded: number;
  sold: number;
  returned: number;
  remaining: number;
};

type UserStockSummary = {
  userId: string;
  username: string;
  totalLoaded: number;
  totalSold: number;
  totalReturned: number;
  totalRemaining: number;
  stockItems: UserStockItem[];
  salesCount: number;
  revenue: number;
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function StockManagementPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [selectedUser, setSelectedUser] = useState("");
  const [activeTab, setActiveTab] = useState<"assign" | "overview" | "reconciliation">("overview");
  
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
    return (item.cases * itemConfig.caseInfo.bottlesPerCase) + item.bottles;
  };

  useEffect(() => {
    if (!isPending) {
      if (!session?.user) { router.push("/login"); return; }
      if (session.user.role !== "admin") { router.push("/dashboard"); return; }
    }
  }, [isPending, session, router]);

  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: session?.user?.role === "admin",
  });

  const { data: vanLoads = [], isLoading: loadingLoads } = useQuery<VanLoad[]>({
    queryKey: ["van-loads-all", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/van-loads?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch van loads");
      return res.json();
    },
    enabled: !!selectedDate && session?.user?.role === "admin",
  });

  const { data: sales = [], isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ["sales-all", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/sales?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
    enabled: !!selectedDate && session?.user?.role === "admin",
  });

  if (isPending || !session?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Process data for overview
  const userStockSummaries: UserStockSummary[] = users.map(user => {
    const userLoads = vanLoads.filter(load => load.userId === user.id);
    const userSales = sales.filter(sale => sale.userId === user.id);
    
    const stockMap = new Map<string, UserStockItem>();
    
    // Process loads
    userLoads.forEach(load => {
      const key = load.itemName;
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          itemName: key,
          loaded: 0,
          sold: 0,
          returned: 0,
          remaining: 0
        });
      }
      const item = stockMap.get(key)!;
      item.loaded += load.loaded;
      item.returned += load.returned;
    });
    
    // Process sales
    userSales.forEach(sale => {
      const key = sale.itemName;
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          itemName: key,
          loaded: 0,
          sold: 0,
          returned: 0,
          remaining: 0
        });
      }
      const item = stockMap.get(key)!;
      item.sold += sale.quantity;
    });
    
    // Calculate remaining
    const stockItems = Array.from(stockMap.values()).map(item => {
      item.remaining = item.loaded - item.sold - item.returned;
      return item;
    });
    
    return {
      userId: user.id,
      username: user.username,
      totalLoaded: stockItems.reduce((sum, item) => sum + item.loaded, 0),
      totalSold: stockItems.reduce((sum, item) => sum + item.sold, 0),
      totalReturned: stockItems.reduce((sum, item) => sum + item.returned, 0),
      totalRemaining: stockItems.reduce((sum, item) => sum + item.remaining, 0),
      stockItems,
      salesCount: userSales.length,
      revenue: userSales.reduce((sum, sale) => sum + sale.totalAmount, 0)
    };
  });

  const handleAssignStock = async () => {
    if (!selectedUser) {
      setMessage({ type: "error", text: "Please select a user" });
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
      const res = await fetch("/api/van-load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
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
        queryClient.invalidateQueries({ queryKey: ["van-loads-all", selectedDate] });
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

  const addStockItem = () => {
    setStockItems(prev => [...prev, { itemName: ITEMS[0].name, cases: 0, bottles: 0, totalBottles: 0 }]);
  };

  const removeStockItem = (index: number) => {
    setStockItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateStockItem = (index: number, field: keyof StockItem, value: string | number) => {
    setStockItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        // Recalculate totalBottles when cases or bottles change
        if (field === 'cases' || field === 'bottles') {
          updatedItem.totalBottles = calculateTotalBottles(updatedItem);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stock Management</h1>
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
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["van-loads-all", selectedDate] });
              queryClient.invalidateQueries({ queryKey: ["sales-all", selectedDate] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {[
          { key: "overview", label: "Overview", icon: Eye },
          { key: "assign", label: "Assign Stock", icon: Package },
          { key: "reconciliation", label: "Reconciliation", icon: CheckCircle }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "assign" | "overview" | "reconciliation")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Stock Loaded</p>
                    <p className="text-2xl font-bold">
                      {(() => {
                        const totalLoaded = userStockSummaries.reduce((sum, user) => sum + user.totalLoaded, 0);
                        // Use a common case size for total display (e.g., 16 bottles per case as default)
                        return formatCaseBottleDisplay(totalLoaded, 16);
                      })()}
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Sold</p>
                    <p className="text-2xl font-bold">
                      {(() => {
                        const totalSold = userStockSummaries.reduce((sum, user) => sum + user.totalSold, 0);
                        return formatCaseBottleDisplay(totalSold, 16);
                      })()}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">
                      Rs {userStockSummaries.reduce((sum, user) => sum + user.revenue, 0).toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Stock Overview */}
          <Card>
            <CardHeader>
              <CardTitle>User Stock Overview - {selectedDate}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLoads || loadingSales ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {userStockSummaries.map(user => (
                    <div key={user.userId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{user.username}</h3>
                          <p className="text-sm text-gray-600">
                            {user.salesCount} sales • Rs {user.revenue.toFixed(2)} revenue
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600">
                              Loaded: {(() => {
                                const itemConfig = getItemByName(user.stockItems[0]?.itemName || 'NP-250ml');
                                const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 16;
                                return formatCaseBottleDisplay(user.totalLoaded, bottlesPerCase);
                              })()}
                            </span>
                            <span className="text-blue-600">
                              Sold: {(() => {
                                const itemConfig = getItemByName(user.stockItems[0]?.itemName || 'NP-250ml');
                                const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 16;
                                return formatCaseBottleDisplay(user.totalSold, bottlesPerCase);
                              })()}
                            </span>
                            <span className="text-orange-600">
                              Returned: {(() => {
                                const itemConfig = getItemByName(user.stockItems[0]?.itemName || 'NP-250ml');
                                const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 16;
                                return formatCaseBottleDisplay(user.totalReturned, bottlesPerCase);
                              })()}
                            </span>
                            <span className={`font-bold ${user.totalRemaining >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              Remaining: {(() => {
                                const itemConfig = getItemByName(user.stockItems[0]?.itemName || 'NP-250ml');
                                const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 16;
                                return formatCaseBottleDisplay(user.totalRemaining, bottlesPerCase);
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {user.stockItems.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {user.stockItems.map(item => {
                            const itemConfig = getItemByName(item.itemName);
                            const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                            const loadedDisplay = formatCaseBottleDisplay(item.loaded, bottlesPerCase);
                            const soldDisplay = formatCaseBottleDisplay(item.sold, bottlesPerCase);
                            const returnedDisplay = formatCaseBottleDisplay(item.returned, bottlesPerCase);
                            const remainingDisplay = formatCaseBottleDisplay(item.remaining, bottlesPerCase);
                            
                            return (
                              <div key={item.itemName} className={`p-3 rounded border ${
                                item.remaining >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                              }`}>
                                <p className="font-medium">{item.itemName}</p>
                                <p className="text-xs text-gray-600">
                                  L:{loadedDisplay} S:{soldDisplay} R:{returnedDisplay} = {remainingDisplay}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assign Stock Tab */}
      {activeTab === "assign" && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Stock to User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user">Select User</Label>
                <select
                  id="user"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Choose a user...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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

      {/* Reconciliation Tab */}
      {activeTab === "reconciliation" && (
        <Card>
          <CardHeader>
            <CardTitle>End of Day Reconciliation - {selectedDate}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {userStockSummaries.map(user => {
                const hasDiscrepancies = user.stockItems.some(item => item.remaining < 0);
                return (
                  <div key={user.userId} className={`border rounded-lg p-4 ${
                    hasDiscrepancies ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {hasDiscrepancies ? (
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        ) : (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">{user.username}</h3>
                          <p className="text-sm text-gray-600">
                            {hasDiscrepancies ? "Has discrepancies" : "All balanced"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">Rs {user.revenue.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">{user.salesCount} sales</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Item</th>
                            <th className="text-right p-2">Loaded</th>
                            <th className="text-right p-2">Sold</th>
                            <th className="text-right p-2">Returned</th>
                            <th className="text-right p-2">Expected</th>
                            <th className="text-right p-2">Remaining</th>
                            <th className="text-right p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {user.stockItems.map(item => {
                            const expected = item.loaded - item.sold - item.returned;
                            const isBalanced = item.remaining === expected;
                            const itemConfig = getItemByName(item.itemName);
                            const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                            
                            const loadedDisplay = formatCaseBottleDisplay(item.loaded, bottlesPerCase);
                            const soldDisplay = formatCaseBottleDisplay(item.sold, bottlesPerCase);
                            const returnedDisplay = formatCaseBottleDisplay(item.returned, bottlesPerCase);
                            const expectedDisplay = formatCaseBottleDisplay(expected, bottlesPerCase);
                            const remainingDisplay = formatCaseBottleDisplay(item.remaining, bottlesPerCase);
                            
                            return (
                              <tr key={item.itemName} className="border-b">
                                <td className="p-2 font-medium">{item.itemName}</td>
                                <td className="p-2 text-right text-xs">{loadedDisplay}</td>
                                <td className="p-2 text-right text-xs">{soldDisplay}</td>
                                <td className="p-2 text-right text-xs">{returnedDisplay}</td>
                                <td className="p-2 text-right text-xs">{expectedDisplay}</td>
                                <td className={`p-2 text-right font-bold text-xs ${
                                  item.remaining >= 0 ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {remainingDisplay}
                                </td>
                                <td className="p-2 text-right">
                                  {isBalanced ? (
                                    <span className="text-green-600">✓</span>
                                  ) : (
                                    <span className="text-red-600">
                                      {item.remaining < expected ? "Short" : "Over"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}