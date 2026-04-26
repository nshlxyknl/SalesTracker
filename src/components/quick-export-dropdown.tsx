"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, File } from "lucide-react";

interface QuickExportDropdownProps {
  filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  };
}

export default function QuickExportDropdown({ filters = {} }: QuickExportDropdownProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: string, reportType?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.userId) params.append("userId", filters.userId);
      
      let url = "";
      if (format === "pdf") {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {loading ? "Exporting..." : "Quick Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport("excel")} className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Excel Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")} className="flex items-center gap-2">
          <File className="h-4 w-4 text-blue-600" />
          CSV Export
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf", "summary")} className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-600" />
          PDF Summary
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf", "detailed")} className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-600" />
          PDF Detailed
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}