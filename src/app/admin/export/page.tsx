"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, FileText, File } from "lucide-react";

interface User {
  id: string;
  username: string;
  name: string;
}

export default function ExportPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    userId: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load users
    fetch("/api/users")
      .then(res => res.json())
      .then(setUsers)
      .catch(console.error);
  }, []);

  const handleExport = async (format: string, reportType?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.userId) params.append("userId", filters.userId);
      
      let url = "";
      if (format === "pdf") {
        url = `/api/export/bills-pdf?${params.toString()}`;
        if (reportType) params.append("type", reportType);
        url = `/api/export/bills-pdf?${params.toString()}`;
      } else {
        params.append("format", format);
        url = `/api/export/bills?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      // Get filename from response headers or create default
      const contentDisposition = response.headers.get("content-disposition");
      const filename = contentDisposition 
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `export-${Date.now()}.${format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv"}`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      userId: ""
    });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Export Bills & Reports</h1>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Export Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="userId">User (Optional)</Label>
              <select
                id="userId"
                value={filters.userId}
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button variant="outline" onClick={clearFilters} size="sm">
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Excel Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Excel Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Comprehensive Excel file with multiple sheets: Summary, Detailed Sales, and Bills Summary.
            </p>
            <Button 
              onClick={() => handleExport("excel")} 
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {loading ? "Exporting..." : "Download Excel"}
            </Button>
          </CardContent>
        </Card>

        {/* CSV Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="h-5 w-5 text-blue-600" />
              CSV Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Simple CSV file with all sales data. Perfect for importing into other systems.
            </p>
            <Button 
              onClick={() => handleExport("csv")} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              {loading ? "Exporting..." : "Download CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* PDF Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              PDF Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Professional PDF reports with different formats.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => handleExport("pdf", "summary")} 
                disabled={loading}
                className="w-full"
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Summary Report
              </Button>
              <Button 
                onClick={() => handleExport("pdf", "detailed")} 
                disabled={loading}
                className="w-full"
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Detailed Report
              </Button>
              <Button 
                onClick={() => handleExport("pdf", "bills")} 
                disabled={loading}
                className="w-full"
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Bills Summary
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Export Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Excel Export Includes:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Summary statistics</li>
                <li>• Detailed sales data</li>
                <li>• Bills summary</li>
                <li>• Formatted currency</li>
                <li>• Auto-sized columns</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">PDF Reports Include:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Professional formatting</li>
                <li>• Summary statistics</li>
                <li>• Filtered data tables</li>
                <li>• Page numbering</li>
                <li>• Export metadata</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">CSV Export Includes:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Raw sales data</li>
                <li>• All fields included</li>
                <li>• Easy to import</li>
                <li>• Lightweight format</li>
                <li>• Universal compatibility</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}