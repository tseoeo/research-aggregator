import { Suspense } from "react";
import { PaperList } from "@/components/papers/paper-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UpdateStatus } from "@/components/update-status";
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
        <Card key={i} className="border-border/50">
          <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
            <div className="flex items-center gap-2.5 mb-3">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-3/4 mt-1" />
            <div className="flex gap-2 mt-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            <Skeleton className="h-10 w-full rounded-lg mb-4" />
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyTrendingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="heading-display text-xl mb-2">No Trending Papers Yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
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
    <div className="space-y-6 sm:space-y-8">
      {/* Hero section */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-primary tracking-wide uppercase">
              Most Discussed
            </p>
          </div>
          <h1 className="heading-display text-3xl sm:text-4xl lg:text-5xl">
            Trending Papers
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Papers generating the most buzz on social media, ranked by mentions,
          likes, and community engagement.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center justify-end">
        <UpdateStatus />
      </div>

      {/* Paper list */}
      <Suspense fallback={<TrendingLoading />}>
        <TrendingSection />
      </Suspense>
    </div>
  );
}
