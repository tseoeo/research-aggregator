import { Suspense } from "react";
import Link from "next/link";
import { PaperList } from "@/components/papers/paper-list";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UpdateStatus } from "@/components/update-status";
import { headers } from "next/headers";
import { cn } from "@/lib/utils";

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
  { value: "cs.AI", label: "AI", description: "Artificial Intelligence" },
  { value: "cs.LG", label: "ML", description: "Machine Learning" },
  { value: "cs.CL", label: "NLP", description: "Natural Language Processing" },
  { value: "cs.CV", label: "Vision", description: "Computer Vision" },
  { value: "stat.ML", label: "Stats", description: "Statistical ML" },
];

function CategoryFilter({ selected }: { selected?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const isSelected = selected === cat.value;
        return (
          <Link
            key={cat.value}
            href={isSelected ? "/" : `/?category=${cat.value}`}
            title={cat.description}
          >
            <Badge
              variant="outline"
              className={cn(
                "cursor-pointer transition-all duration-200 border-border/50",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "hover:bg-muted hover:border-border"
              )}
            >
              {cat.label}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

function PapersLoading() {
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
  const categoryData = categories.find((c) => c.value === selectedCategory);
  const categoryLabel = categoryData?.label || "AI";
  const categoryDescription = categoryData?.description || "Artificial Intelligence";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero section */}
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary tracking-wide uppercase">
            Latest Research
          </p>
          <h1 className="heading-display text-3xl sm:text-4xl lg:text-5xl">
            {categoryDescription}
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Discover the latest papers from arXiv with AI-generated summaries and
          social context from the research community.
        </p>
      </div>

      {/* Filters and Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CategoryFilter selected={selectedCategory} />
        <UpdateStatus />
      </div>

      {/* Paper list */}
      <Suspense key={selectedCategory} fallback={<PapersLoading />}>
        <PapersSection category={selectedCategory} />
      </Suspense>
    </div>
  );
}
