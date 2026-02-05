import { Suspense } from "react";
import { ModelComparisonClient } from "./model-comparison";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Model Comparison Test | Research Aggregator",
  robots: "noindex",
};

export default function ModelComparisonPage() {
  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Model Comparison Test</h1>
        <p className="text-muted-foreground">
          Compare AI models by running summary and analysis on the same paper.
          See token costs and quality side-by-side.
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
