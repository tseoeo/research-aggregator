"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy AI Processing page — redirects to Analysis v3.
 */
export default function LegacyAiPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/analysis-v3");
  }, [router]);
  return null;
}
