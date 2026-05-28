"use client";

import { Loader2, BarChart3 } from "lucide-react";

export function AuthLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-900 rounded-xl mb-4">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Tracker</h1>
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    </div>
  );
}