"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZES = [10, 20, 50, 100] as const;

interface PaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
}

export function Pagination({ page, pageSize, totalPages }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== getDefault(key)) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const goToPage = useCallback(
    (p: number) => {
      if (p < 1 || p > totalPages) return;
      setParam("page", p === 1 ? null : String(p));
      // Scroll to top of feed
      document.getElementById("feed-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [setParam, totalPages]
  );

  const changePageSize = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (size !== 20) {
        params.set("pageSize", String(size));
      } else {
        params.delete("pageSize");
      }
      params.delete("page"); // Reset to page 1
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-end py-3">
        <PageSizeSelector current={pageSize} onChange={changePageSize} />
      </div>
    );
  }

  // Calculate visible page numbers
  const pages = getPageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-between py-3 gap-4">
      {/* Desktop pagination */}
      <div className="hidden sm:flex items-center gap-1">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goToPage(p as number)}
              className={cn(
                "h-8 min-w-8 px-2 text-sm rounded-md transition-colors",
                p === page
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile pagination */}
      <div className="flex sm:hidden items-center gap-2">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <PageSizeSelector current={pageSize} onChange={changePageSize} />
    </div>
  );
}

function PageSizeSelector({
  current,
  onChange,
}: {
  current: number;
  onChange: (size: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="hidden sm:inline">Showing</span>
      <select
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent border border-border/50 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted transition-colors"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span>per page</span>
    </div>
  );
}

// Generate page numbers with ellipsis
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  // Pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  // Always show last page
  pages.push(total);

  return pages;
}

function getDefault(key: string): string {
  if (key === "page") return "1";
  if (key === "pageSize") return "20";
  return "";
}
