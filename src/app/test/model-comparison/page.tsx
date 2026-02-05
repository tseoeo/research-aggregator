import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ModelComparisonClient } from "./model-comparison";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Model Comparison Test | Research Aggregator",
  robots: "noindex",
};

/**
 * Verify admin access for the test page.
 * Returns true if:
 * - ADMIN_SECRET is set AND
 * - The request includes a valid admin_token query parameter
 */
async function verifyAdminAccess(searchParams: { [key: string]: string | string[] | undefined }): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;

  // If no admin secret configured, deny access (fail closed)
  if (!adminSecret) {
    return false;
  }

  // Check for admin_token in query params
  const token = searchParams.admin_token;
  if (typeof token === "string" && token === adminSecret) {
    return true;
  }

  return false;
}

export default async function ModelComparisonPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const hasAccess = await verifyAdminAccess(params);

  if (!hasAccess) {
    return (
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-destructive">Access Denied</h1>
          <p className="text-muted-foreground">
            This page requires admin authentication.
          </p>
          <p className="text-sm text-muted-foreground">
            Access this page with: <code className="bg-muted px-1 py-0.5 rounded">?admin_token=YOUR_ADMIN_SECRET</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Model Comparison Test</h1>
        <p className="text-muted-foreground">
          Compare AI models by running summary and analysis on the same paper.
          See token costs and quality side-by-side.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Admin access verified. API calls require Authorization header.
        </p>
      </div>
      <Suspense fallback={<LoadingSkeleton />}>
        <ModelComparisonClient />
      </Suspense>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-32" />
        ))}
      </div>
    </div>
  );
}
