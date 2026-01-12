import { Suspense } from "react";
import Link from "next/link";
import { PaperList } from "@/components/papers/paper-list";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { headers } from "next/headers";

// Fetch papers via internal API route
async function getPapers(category?: string) {
  try {
    // Get the host from headers for internal API call
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    const params = new URLSearchParams();
    if (category) params.set("category", category);
    params.set("limit", "20");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${protocol}://${host}/api/papers?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error("Failed to fetch papers");
    }

    const data = await res.json();

    // Transform dates from strings to Date objects
    const papers = data.papers.map((paper: any) => ({
      ...paper,
      publishedAt: paper.publishedAt ? new Date(paper.publishedAt) : null,
    }));

    return { papers, pagination: data.pagination };
  } catch (error) {
    console.error("Error fetching papers:", error);
    return { papers: [], pagination: { total: 0 } };
  }
}

const categories = [
  { value: "cs.AI", label: "AI" },
  { value: "cs.LG", label: "ML" },
  { value: "cs.CL", label: "NLP" },
  { value: "cs.CV", label: "Vision" },
  { value: "stat.ML", label: "Stats ML" },
];

function CategoryFilter({ selected }: { selected?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <Link
          key={cat.value}
          href={selected === cat.value ? "/" : `/?category=${cat.value}`}
        >
          <Badge
            variant={selected === cat.value ? "default" : "outline"}
            className="cursor-pointer hover:bg-accent transition-colors"
          >
            {cat.label}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

function PapersLoading() {
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

async function PapersSection({ category }: { category?: string }) {
  const data = await getPapers(category);

  return <PaperList papers={data.papers} />;
}

interface HomePageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { category } = await searchParams;
  const selectedCategory = category || "cs.AI";
  const categoryLabel = categories.find(c => c.value === selectedCategory)?.label || "AI";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero section */}
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Latest {categoryLabel} Research
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Discover the latest papers from arXiv with AI-generated summaries and
          social context.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CategoryFilter selected={selectedCategory} />
        <p className="text-xs sm:text-sm text-muted-foreground">
          Updated every 6 hours from arXiv
        </p>
      </div>

      {/* Paper list */}
      <Suspense key={selectedCategory} fallback={<PapersLoading />}>
        <PapersSection category={selectedCategory} />
      </Suspense>
    </div>
  );
}
