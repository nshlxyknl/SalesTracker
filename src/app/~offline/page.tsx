"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">You are offline</h1>
      <p className="text-gray-600 max-w-md mb-6">
        Sales Tracker is still available. Your sales are saved on this device and will sync
        when you are back online, or use Sync Now from the dashboard.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
