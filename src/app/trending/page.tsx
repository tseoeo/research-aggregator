import { Suspense } from "react";
import { PaperList } from "@/components/papers/paper-list";
import { Skeleton } from "@/components/ui/skeleton";
import { headers } from "next/headers";
import { TrendingUp, Sparkles } from "lucide-react";

async function getTrendingPapers() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${protocol}://${host}/api/papers/trending`, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error("Failed to fetch trending papers");
    }

    const data = await res.json();

    // Transform dates from strings to Date objects
    const papers = data.papers.map((paper: any) => ({
      ...paper,
      publishedAt: paper.publishedAt ? new Date(paper.publishedAt) : null,
    }));

    return { papers, total: data.total };
  } catch (error) {
    console.error("Error fetching trending papers:", error);
    return { papers: [], total: 0 };
  }
}

function TrendingLoading() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border rounded-lg p-4 sm:p-6 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTrendingState() {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <Sparkles className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No Trending Papers Yet</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Trending papers are determined by social media mentions and engagement.
        Check back soon as we gather more social data!
      </p>
    </div>
  );
}

async function TrendingSection() {
  const data = await getTrendingPapers();

  if (data.papers.length === 0) {
    return <EmptyTrendingState />;
  }

  return <PaperList papers={data.papers} />;
}

export default function TrendingPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero section */}
      <div className="space-y-1 sm:space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Trending Papers
          </h1>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          Papers generating the most buzz on social media - ranked by mentions, likes, and engagement.
        </p>
      </div>

      {/* Paper list */}
      <Suspense fallback={<TrendingLoading />}>
        <TrendingSection />
      </Suspense>
    </div>
  );
}
