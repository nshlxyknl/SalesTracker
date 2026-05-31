"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ITEMS, convertCasesToBottles, convertBottlesToCases, formatCaseBottleDisplay, getItemByName } from "@/app/lib/items";
import { 
  Users, 
  Package, 
  Plus, 
  Trash2, 
  Save, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Copy,
  History,
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

type StockItem = {
  itemName: string;
  cases: number;
  bottles: number;
  totalBottles: number; // Calculated field for backend storage
};

type StockAssignment = {
  userId: string;
  username: string;
  items: StockItem[];
  totalItems: number;
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function AssignStockPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [assignments, setAssignments] = useState<StockAssignment[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copyFromDate, setCopyFromDate] = useState("");

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

  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: session?.user?.role === "admin",
  });

  const { data: existingLoads = [], isLoading: loadingLoads } = useQuery<VanLoad[]>({
    queryKey: ["van-loads-date", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/van-loads?date=${selectedDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedDate && session?.user?.role === "admin",
  });

  // Initialize assignments when users load
  useEffect(() => {
    if (users.length > 0 && assignments.length === 0) {
      const initialAssignments = users.map(user => ({
        userId: user.id,
        username: user.username,
        items: [{ itemName: ITEMS[0].name, cases: 0, bottles: 0, totalBottles: 0 }],
        totalItems: 0
      }));
      setAssignments(initialAssignments);
    }
  }, [users, assignments.length]);

  // Update assignments with existing loads
  useEffect(() => {
    if (existingLoads.length > 0 && assignments.length > 0) {
      const updatedAssignments = assignments.map(assignment => {
        const userLoads = existingLoads.filter(load => load.userId === assignment.userId);
        if (userLoads.length > 0) {
          const items = userLoads.map(load => {
            const itemConfig = getItemByName(load.itemName);
            const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
            const { cases, bottles } = convertBottlesToCases(load.loaded, bottlesPerCase);
            return {
              itemName: load.itemName,
              cases,
              bottles,
              totalBottles: load.loaded
            };
          });
          return {
            ...assignment,
            items,
            totalItems: items.reduce((sum, item) => sum + item.totalBottles, 0)
          };
        }
        return assignment;
      });
      setAssignments(updatedAssignments);
    }
  }, [existingLoads]);

  if (isPending || !session?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const addItemToUser = (userId: string) => {
    setAssignments(prev => prev.map(assignment => 
      assignment.userId === userId 
        ? {
            ...assignment,
            items: [...assignment.items, { itemName: ITEMS[0].name, cases: 0, bottles: 0, totalBottles: 0 }]
          }
        : assignment
    ));
  };

  const removeItemFromUser = (userId: string, itemIndex: number) => {
    setAssignments(prev => prev.map(assignment => 
      assignment.userId === userId 
        ? {
            ...assignment,
            items: assignment.items.filter((_, index) => index !== itemIndex)
          }
        : assignment
    ));
  };

  const updateUserItem = (userId: string, itemIndex: number, field: keyof StockItem, value: any) => {
    setAssignments(prev => prev.map(assignment => 
      assignment.userId === userId 
        ? {
            ...assignment,
            items: assignment.items.map((item, index) => {
              if (index === itemIndex) {
                const updatedItem = { ...item, [field]: value };
                // Recalculate totalBottles when cases or bottles change
                if (field === 'cases' || field === 'bottles') {
                  updatedItem.totalBottles = calculateTotalBottles(updatedItem);
                }
                return updatedItem;
              }
              return item;
            }),
            totalItems: assignment.items.reduce((sum, item, index) => {
              if (index === itemIndex) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'cases' || field === 'bottles') {
                  updatedItem.totalBottles = calculateTotalBottles(updatedItem);
                }
                return sum + updatedItem.totalBottles;
              }
              return sum + item.totalBottles;
            }, 0)
          }
        : assignment
    ));
  };

  const copyFromPreviousDate = async () => {
    if (!copyFromDate) {
      setMessage({ type: "error", text: "Please select a date to copy from" });
      return;
    }

    try {
      const res = await fetch(`/api/admin/van-loads?date=${copyFromDate}`);
      if (!res.ok) throw new Error("Failed to fetch previous data");
      
      const previousLoads: VanLoad[] = await res.json();
      
      if (previousLoads.length === 0) {
        setMessage({ type: "error", text: "No stock assignments found for the selected date" });
        return;
      }

      // Group by user
      const userLoadsMap = new Map<string, StockItem[]>();
      previousLoads.forEach(load => {
        if (!userLoadsMap.has(load.userId)) {
          userLoadsMap.set(load.userId, []);
        }
        const itemConfig = getItemByName(load.itemName);
        const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
        const { cases, bottles } = convertBottlesToCases(load.loaded, bottlesPerCase);
        
        userLoadsMap.get(load.userId)!.push({
          itemName: load.itemName,
          cases,
          bottles,
          totalBottles: load.loaded
        });
      });

      // Update assignments
      const updatedAssignments = assignments.map(assignment => {
        const userItems = userLoadsMap.get(assignment.userId);
        if (userItems) {
          return {
            ...assignment,
            items: userItems,
            totalItems: userItems.reduce((sum, item) => sum + item.totalBottles, 0)
          };
        }
        return assignment;
      });

      setAssignments(updatedAssignments);
      setMessage({ type: "success", text: `Copied stock assignments from ${copyFromDate}` });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to copy from previous date" });
    }
  };

  const clearAllAssignments = () => {
    const clearedAssignments = assignments.map(assignment => ({
      ...assignment,
      items: [{ itemName: ITEMS[0].name, cases: 0, bottles: 0, totalBottles: 0 }],
      totalItems: 0
    }));
    setAssignments(clearedAssignments);
    setMessage({ type: "success", text: "All assignments cleared" });
  };

  const saveAllAssignments = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const savePromises = assignments.map(async (assignment) => {
        const validItems = assignment.items.filter(item => item.totalBottles > 0);
        
        if (validItems.length === 0) return null;

        const res = await fetch("/api/van-load", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: assignment.userId,
            date: selectedDate,
            items: validItems.map(item => ({
              itemName: item.itemName,
              loaded: item.totalBottles,
              returned: 0
            }))
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(`Failed to save for ${assignment.username}: ${data.error}`);
        }

        return res.json();
      });

      await Promise.all(savePromises);
      
      setMessage({ type: "success", text: "All stock assignments saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ["van-loads-date", selectedDate] });
      
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save assignments" });
    } finally {
      setSaving(false);
    }
  };

  const totalItemsAllUsers = assignments.reduce((sum, assignment) => sum + assignment.totalItems, 0);
  const usersWithStock = assignments.filter(assignment => assignment.totalItems > 0).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assign Stock to Users</h1>
          <p className="text-gray-600 mt-1">Assign inventory to users for sales activities</p>
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
                <p className="text-sm font-medium text-gray-600">Users with Stock</p>
                <p className="text-2xl font-bold">{usersWithStock}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold">{totalItemsAllUsers}</p>
              </div>
              <Package className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Selected Date</p>
                <p className="text-lg font-bold">{new Date(selectedDate).toLocaleDateString()}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={copyFromDate}
                onChange={(e) => setCopyFromDate(e.target.value)}
                className="w-40"
                placeholder="Select date"
              />
              <Button onClick={copyFromPreviousDate} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy from Date
              </Button>
            </div>
            
            <Button onClick={clearAllAssignments} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear All
            </Button>

            <Button onClick={() => router.push('/admin/stock-management')} variant="outline">
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stock Assignment Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stock Assignments - {selectedDate}</CardTitle>
            <div className="flex items-center gap-4">
              <Button onClick={saveAllAssignments} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save All Assignments"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`mb-6 p-4 rounded-lg border ${
              message.type === "success" 
                ? "bg-green-50 border-green-200 text-green-700" 
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <div className="flex items-center gap-2">
                {message.type === "success" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <span className="font-medium">{message.text}</span>
              </div>
            </div>
          )}

          {loadingUsers ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {assignments.map((assignment) => (
                <div key={assignment.userId} className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{assignment.username}</h3>
                      <p className="text-sm text-gray-600">
                        Total: {assignment.totalItems} items
                      </p>
                    </div>
                    <Button
                      onClick={() => addItemToUser(assignment.userId)}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {assignment.items.map((item, itemIndex) => {
                      const itemConfig = getItemByName(item.itemName);
                      const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                      
                      return (
                        <div key={itemIndex} className="flex items-center gap-4 p-4 bg-white rounded-lg border">
                          <div className="flex-1">
                            <select
                              value={item.itemName}
                              onChange={(e) => updateUserItem(assignment.userId, itemIndex, 'itemName', e.target.value)}
                              className="w-full p-2 border rounded-md"
                            >
                              {ITEMS.map(i => (
                                <option key={i.name} value={i.name}>{i.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <label className="block text-xs text-gray-500 mb-1">Cases</label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.cases}
                                onChange={(e) => updateUserItem(assignment.userId, itemIndex, 'cases', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            
                            <div className="w-20">
                              <label className="block text-xs text-gray-500 mb-1">Bottles</label>
                              <Input
                                type="number"
                                min="0"
                                max={bottlesPerCase - 1}
                                placeholder="0"
                                value={item.bottles}
                                onChange={(e) => {
                                  const bottles = parseInt(e.target.value) || 0;
                                  if (bottles < bottlesPerCase) {
                                    updateUserItem(assignment.userId, itemIndex, 'bottles', bottles);
                                  }
                                }}
                              />
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-500 text-center min-w-20">
                            <div>1 case =</div>
                            <div>{bottlesPerCase} bottles</div>
                          </div>
                          
                          {assignment.items.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeItemFromUser(assignment.userId, itemIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {assignment.items.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No items assigned</p>
                      <Button
                        onClick={() => addItemToUser(assignment.userId)}
                        size="sm"
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Item
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.filter(a => a.totalItems > 0).map(assignment => (
              <div key={assignment.userId} className="p-4 border rounded-lg bg-green-50 border-green-200">
                <h4 className="font-semibold text-green-800">{assignment.username}</h4>
                <p className="text-sm text-green-600">{assignment.totalItems} total items</p>
                <div className="mt-2 space-y-1">
                  {assignment.items.filter(item => item.totalBottles > 0).map((item, index) => {
                    const itemConfig = getItemByName(item.itemName);
                    const bottlesPerCase = itemConfig?.caseInfo.bottlesPerCase || 1;
                    const displayText = formatCaseBottleDisplay(item.totalBottles, bottlesPerCase);
                    
                    return (
                      <div key={index} className="text-xs text-green-700">
                        {item.itemName}: {displayText}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {usersWithStock === 0 && (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No stock assignments yet</p>
              <p className="text-sm">Add quantities to items above to see the summary</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}