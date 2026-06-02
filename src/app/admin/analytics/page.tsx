"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Calendar,
  Filter,
  Download,
  Eye,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Sale = {
  id: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  user: { 
    id: string;
    username: string;
  };
};

type VanLoad = {
  id: string;
  itemName: string;
  loaded: number;
  returned: number;
  casePrice: number;
  schemeBottles: number;
  date: string;
  userId: string;
  user: {
    username: string;
  };
};

type UserSalesData = {
  userId: string;
  username: string;
  totalSales: number;
  totalAmount: number;
  totalBills: number;
  averageBillValue: number;
  paymentMethods: {
    cash: number;
    cheque: number;
    credit: number;
  };
  recentSales: Sale[];
  salesByDate: { [date: string]: number };
};

async function fetchUserSalesData(startDate?: string, endDate?: string): Promise<{
  userSalesData: UserSalesData[];
  summary: {
    totalRevenue: number;
    totalSalesCount: number;
    totalUsers: number;
    averagePerUser: number;
  };
}> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `/api/admin/user-sales${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch user sales data");
  return res.json();
}

function toDateStr(date: Date) {
  return date.toISOString().split("T")[0];
}

async function fetchVanLoads(date: string): Promise<VanLoad[]> {
  const res = await fetch(`/api/admin/van-loads?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch stock cost data");
  return res.json();
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  const [searchUser, setSearchUser] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'amount' | 'sales' | 'bills'>('amount');
  const [stockDate, setStockDate] = useState(toDateStr(new Date()));

  const { data: salesData, isLoading } = useQuery({
    queryKey: ["user-sales-analytics", dateFilter.startDate, dateFilter.endDate],
    queryFn: () => fetchUserSalesData(dateFilter.startDate, dateFilter.endDate),
    enabled: session?.user?.role === "admin",
  });

  const { data: stockLoads = [], isLoading: loadingStockLoads } = useQuery({
    queryKey: ["admin-stock-cost", stockDate],
    queryFn: () => fetchVanLoads(stockDate),
    enabled: session?.user?.role === "admin",
  });

  if (isPending || !session?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter sales by date if filters are applied
  const userSalesData = salesData?.userSalesData || [];
  const summary = salesData?.summary || {
    totalRevenue: 0,
    totalSalesCount: 0,
    totalUsers: 0,
    averagePerUser: 0
  };
  
  // Filter by search
  const filteredUserData = userSalesData.filter(user =>
    user.username.toLowerCase().includes(searchUser.toLowerCase())
  );

  // Sort data
  const sortedUserData = [...filteredUserData].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return b.totalAmount - a.totalAmount;
      case 'sales':
        return b.totalSales - a.totalSales;
      case 'bills':
        return b.totalBills - a.totalBills;
      default:
        return b.totalAmount - a.totalAmount;
    }
  });

  const clearFilters = () => {
    setDateFilter({ startDate: "", endDate: "" });
    setSearchUser("");
  };

  const stockCostRows = Array.from(
    stockLoads.reduce((acc, load) => {
      const key = `${load.userId}:${load.itemName}`;
      const current = acc.get(key) ?? {
        userId: load.userId,
        username: load.user.username,
        itemName: load.itemName,
        loaded: 0,
        returned: 0,
        schemeBottles: 0,
        casePrice: 0,
      };

      current.loaded += load.loaded;
      current.returned += load.returned;
      current.schemeBottles += load.schemeBottles || 0;
      current.casePrice += load.casePrice || 0;

      acc.set(key, current);
      return acc;
    }, new Map<string, {
      userId: string;
      username: string;
      itemName: string;
      loaded: number;
      returned: number;
      schemeBottles: number;
      casePrice: number;
    }>() ).values()
  ).map((row) => ({
    ...row,
    effectiveBottles: row.loaded,
    perBottleCost: row.loaded > 0 ? row.casePrice / row.loaded : 0,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales Analytics</h1>
        <Button variant="outline" onClick={() => router.push('/admin/export')}>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="searchUser">Search User</Label>
              <Input
                id="searchUser"
                placeholder="Enter username..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">Rs {summary.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold">{summary.totalSalesCount}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold">{summary.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg per User</p>
                <p className="text-2xl font-bold">Rs {summary.averagePerUser.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Stock Cost Analysis</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="stockDate" className="text-sm">Date</Label>
              <Input
                id="stockDate"
                type="date"
                value={stockDate}
                onChange={(e) => setStockDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStockLoads ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
              ))}
            </div>
          ) : stockCostRows.length === 0 ? (
            <p className="text-sm text-gray-500">No stock assignments found for {stockDate}.</p>
          ) : (
            <div className="space-y-3">
              {stockCostRows.map((row) => (
                <div key={`${row.userId}:${row.itemName}`} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{row.username} · {row.itemName}</p>
                      <p className="text-sm text-gray-600">
                        Case price: Rs {row.casePrice.toFixed(2)} · Scheme: {row.schemeBottles} bottles
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        Rs {row.perBottleCost.toFixed(2)} / bottle
                      </p>
                      <p className="text-sm text-gray-600">
                        {row.casePrice > 0 ? `${row.casePrice.toFixed(2)} / ${row.effectiveBottles} bottles` : "No price set"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white rounded border p-2">
                      <div className="text-gray-500">Loaded bottles</div>
                      <div className="font-semibold text-gray-900">{row.loaded}</div>
                    </div>
                    <div className="bg-white rounded border p-2">
                      <div className="text-gray-500">Scheme bottles</div>
                      <div className="font-semibold text-gray-900">{row.schemeBottles}</div>
                    </div>
                    <div className="bg-white rounded border p-2">
                      <div className="text-gray-500">Returned</div>
                      <div className="font-semibold text-gray-900">{row.returned}</div>
                    </div>
                    <div className="bg-white rounded border p-2">
                      <div className="text-gray-500">Effective rate</div>
                      <div className="font-semibold text-gray-900">Rs {row.perBottleCost.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sales by User</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="sortBy" className="text-sm">Sort by:</Label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'amount' | 'sales' | 'bills')}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="amount">Total Amount</option>
                <option value="sales">Total Sales</option>
                <option value="bills">Total Bills</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : sortedUserData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No sales data found for the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedUserData.map((user, index) => (
                <div key={user.userId} className="border rounded-lg">
                  <div 
                    className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedUser(expandedUser === user.userId ? null : user.userId)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{user.username}</p>
                        <p className="text-sm text-gray-600">
                          {user.totalSales} sales • {user.totalBills} bills
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-bold text-lg">Rs {user.totalAmount.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">
                          Avg: Rs {user.averageBillValue.toFixed(2)}
                        </p>
                      </div>
                      {expandedUser === user.userId ? 
                        <ChevronUp className="h-5 w-5" /> : 
                        <ChevronDown className="h-5 w-5" />
                      }
                    </div>
                  </div>

                  {expandedUser === user.userId && (
                    <div className="border-t bg-gray-50 p-4 space-y-4">
                      {/* Payment Methods Breakdown */}
                      <div>
                        <h4 className="font-semibold mb-2">Payment Methods</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-green-100 rounded-lg">
                            <p className="text-sm text-green-700">Cash</p>
                            <p className="font-bold text-green-800">Rs {user.paymentMethods.cash.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-3 bg-yellow-100 rounded-lg">
                            <p className="text-sm text-yellow-700">Cheque</p>
                            <p className="font-bold text-yellow-800">Rs {user.paymentMethods.cheque.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-3 bg-purple-100 rounded-lg">
                            <p className="text-sm text-purple-700">Credit</p>
                            <p className="font-bold text-purple-800">Rs {user.paymentMethods.credit.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Recent Sales */}
                      <div>
                        <h4 className="font-semibold mb-2">Recent Sales</h4>
                        <div className="space-y-2">
                          {user.recentSales.map(sale => (
                            <div key={sale.id} className="flex justify-between items-center p-2 bg-white rounded border">
                              <div>
                                <p className="font-medium">{sale.itemName}</p>
                                <p className="text-sm text-gray-600">
                                  Bill #{sale.billNumber} • {new Date(sale.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">Rs {sale.totalAmount.toFixed(2)}</p>
                                <p className="text-sm text-gray-600 capitalize">{sale.paymentMethod}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}