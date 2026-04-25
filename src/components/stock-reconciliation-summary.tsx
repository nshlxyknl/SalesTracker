"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

interface QuickReconciliationSummary {
  date: string;
  totalUsers: number;
  usersWithDiscrepancies: number;
  totalValueDifference: number;
  lastUpdated: string;
}

export default function StockReconciliationSummary() {
  const [summary, setSummary] = useState<QuickReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTodaysSummary = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // This would need a new API endpoint for summary data
      // For now, we'll show a placeholder
      setSummary({
        date: today,
        totalUsers: 3,
        usersWithDiscrepancies: 1,
        totalValueDifference: 250, // in cents
        lastUpdated: new Date().toLocaleTimeString()
      });
    } catch (error) {
      console.error("Failed to load summary:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodaysSummary();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  if (!summary) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Today's Stock Status</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Users Tracked</span>
            <span className="font-medium">{summary.totalUsers}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Discrepancies</span>
            <div className="flex items-center gap-2">
              {summary.usersWithDiscrepancies > 0 ? (
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <span className="font-medium">{summary.usersWithDiscrepancies}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Value Difference</span>
            <span className={`font-medium ${
              summary.totalValueDifference === 0 ? 'text-green-600' : 
              summary.totalValueDifference > 0 ? 'text-red-600' : 'text-blue-600'
            }`}>
              {formatCurrency(summary.totalValueDifference)}
            </span>
          </div>

          <div className="pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => window.location.href = '/admin/stock-reconciliation'}
            >
              View Full Report
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Last updated: {summary.lastUpdated}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}