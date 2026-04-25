"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Sales view lives on /admin — redirect there
export default function SalesPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin"); }, [router]);
  return null;
}
