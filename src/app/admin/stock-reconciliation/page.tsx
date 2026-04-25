"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StockReconciliationItem {
  itemName: string;
  loaded: number;
  returned: number;
  expectedSold: number;
  actualSold: number;
  difference: number;
  unitPrice: number;
  valueDifference: number;
}

interface StockReconciliationResult {
  date: string;
  userId: string;
  username: string;
  items: StockReconciliationItem[];
  totalValueDifference: number;
  summary: {
    totalLoaded: number;
    totalReturned: number;
    totalExpectedSold: number;
    totalActualSold: number;
    totalDifference: number;
  };
}

export default function StockReconciliationPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<StockReconciliationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<Array<{id: string, username: string}>>([]);

  // Load users on component mount
  useEffect(() => {
    fetch("/api/users")
      .then(res => res.json())
      .then(users => setUsers(users))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !userId) {
      setError("Please select both date and user");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch(`/api/stock-reconciliation?date=${date}&userId=${userId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch reconciliation data");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100); // Assuming prices are in cents
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Stock Reconciliation</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate Reconciliation Report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="userId">User</Label>
                <select
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="">Select a user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate Report"}
            </Button>
          </form>
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>
                Reconciliation Summary - {data.username} ({data.date})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{data.summary.totalLoaded}</div>
                  <div className="text-sm text-gray-600">Total Loaded</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{data.summary.totalReturned}</div>
                  <div className="text-sm text-gray-600">Total Returned</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{data.summary.totalExpectedSold}</div>
                  <div className="text-sm text-gray-600">Expected Sold</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{data.summary.totalActualSold}</div>
                  <div className="text-sm text-gray-600">Actual Sold</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${data.summary.totalDifference === 0 ? 'text-green-600' : data.summary.totalDifference > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {data.summary.totalDifference > 0 ? '+' : ''}{data.summary.totalDifference}
                  </div>
                  <div className="text-sm text-gray-600">Difference</div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className={`text-xl font-bold ${data.totalValueDifference === 0 ? 'text-green-600' : data.totalValueDifference > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  Total Value Difference: {formatCurrency(data.totalValueDifference)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {data.totalValueDifference > 0 && "Positive = Missing stock (potential loss)"}
                  {data.totalValueDifference < 0 && "Negative = Extra sales recorded"}
                  {data.totalValueDifference === 0 && "Perfect match!"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Item-wise Reconciliation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left">Item</th>
                      <th className="border border-gray-300 p-2 text-center">Loaded</th>
                      <th className="border border-gray-300 p-2 text-center">Returned</th>
                      <th className="border border-gray-300 p-2 text-center">Expected Sold</th>
                      <th className="border border-gray-300 p-2 text-center">Actual Sold</th>
                      <th className="border border-gray-300 p-2 text-center">Difference</th>
                      <th className="border border-gray-300 p-2 text-center">Unit Price</th>
                      <th className="border border-gray-300 p-2 text-center">Value Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, index) => (
                      <tr key={index} className={item.difference !== 0 ? 'bg-yellow-50' : ''}>
                        <td className="border border-gray-300 p-2 font-medium">{item.itemName}</td>
                        <td className="border border-gray-300 p-2 text-center">{item.loaded}</td>
                        <td className="border border-gray-300 p-2 text-center">{item.returned}</td>
                        <td className="border border-gray-300 p-2 text-center">{item.expectedSold}</td>
                        <td className="border border-gray-300 p-2 text-center">{item.actualSold}</td>
                        <td className={`border border-gray-300 p-2 text-center font-bold ${
                          item.difference === 0 ? 'text-green-600' : 
                          item.difference > 0 ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">{formatCurrency(item.unitPrice)}</td>
                        <td className={`border border-gray-300 p-2 text-center font-bold ${
                          item.valueDifference === 0 ? 'text-green-600' : 
                          item.valueDifference > 0 ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {formatCurrency(item.valueDifference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}