"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { FilterBar } from "./FilterBar";
import { PaperHeadline, type FeedPaper } from "./PaperHeadline";
import { PaperDrawer } from "./PaperDrawer";
import { Pagination } from "./Pagination";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { Skeleton } from "@/components/ui/skeleton";

interface FeedResponse {
  papers: FeedPaper[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function FeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [drawerPaperId, setDrawerPaperId] = useState<string | null>(null);

  // Fetch data whenever search params change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("category")) {
      params.set("category", "cs.AI");
    }

    fetch(`/api/papers/feed?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch papers");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Close drawer when data changes (page/filter change)
  useEffect(() => {
    setDrawerPaperId(null);
    setSelectedPaperId(null);
  }, [searchParams]);

  const handlePaperClick = useCallback((paperId: string) => {
    setSelectedPaperId(paperId);
    setDrawerPaperId(paperId);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerPaperId(null);
  }, []);

  const handleOpenDrawer = useCallback((paperId: string) => {
    setSelectedPaperId(paperId);
    setDrawerPaperId(paperId);
  }, []);

  const handleNextPage = useCallback(() => {
    const page = data?.page || 1;
    const totalPages = data?.totalPages || 1;
    if (page < totalPages) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page + 1));
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [data, searchParams, router]);

  const handlePrevPage = useCallback(() => {
    const page = data?.page || 1;
    if (page > 1) {
      const params = new URLSearchParams(searchParams.toString());
      if (page - 1 === 1) {
        params.delete("page");
      } else {
        params.set("page", String(page - 1));
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [data, searchParams, router]);

  // Keyboard navigation
  useKeyboardNavigation({
    papers: data?.papers || [],
    selectedPaperId,
    drawerOpen: !!drawerPaperId,
    onSelectPaper: setSelectedPaperId,
    onOpenDrawer: handleOpenDrawer,
    onCloseDrawer: handleCloseDrawer,
    onNextPage: handleNextPage,
    onPrevPage: handlePrevPage,
  });

  const page = data?.page || 1;
  const pageSize = data?.pageSize || 20;
  const totalPages = data?.totalPages || 0;
  const drawerPaper = data?.papers.find((p) => p.id === drawerPaperId) || null;

  return (
    <div className="space-y-0">
      {/* Filter bar */}
      <FilterBar total={data?.total || 0} />

      {/* Paper list */}
      <div id="feed-list" className="mt-4">
        {loading && <FeedSkeleton />}

        {error && (
          <div className="py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && data.papers.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No papers match your filters. Try adjusting or clearing filters.
            </p>
          </div>
        )}

        {!loading && !error && data && data.papers.length > 0 && (
          <div className="border border-border/30 rounded-lg overflow-hidden">
            {data.papers.map((paper) => (
              <PaperHeadline
                key={paper.id}
                paper={paper}
                isSelected={selectedPaperId === paper.id}
                onClick={() => handlePaperClick(paper.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && data && data.totalPages > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
        />
      )}

      {/* Detail drawer */}
      <PaperDrawer
        paper={drawerPaper}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="px-3 py-3 border-b border-border/30 last:border-b-0"
        >
          <div className="flex items-start gap-2.5">
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-2 w-2 rounded-full" />
              ))}
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Feed() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedContent />
    </Suspense>
  );
}
