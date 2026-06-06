"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OfflinePage() {
  const router = useRouter();

  // Redirect to home page immediately
  // The app should work offline without showing this page
  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="w-12 h-12 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-600">Loading...</p>
    </div>
  );
}
