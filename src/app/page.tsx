import { Suspense } from "react";
import { PaperList } from "@/components/papers/paper-list";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { arxivService } from "@/lib/services/arxiv";

// Fetch papers directly from arXiv service (no HTTP roundtrip)
async function getPapers(category?: string) {
  try {
    const papers = await arxivService.fetchRecentPapers(category || "cs.AI", 20);

    // Transform to expected format
    const transformedPapers = papers.map((paper) => ({
      id: paper.arxivId,
      externalId: paper.arxivId,
      title: paper.title,
      abstract: paper.abstract,
      publishedAt: paper.publishedAt.toISOString(),
      primaryCategory: paper.primaryCategory,
      pdfUrl: paper.pdfUrl,
      summaryBullets: null,
      authors: paper.authors.map((a) => ({ name: a.name })),
      mentionCount: 0,
    }));

    return { papers: transformedPapers, pagination: { total: transformedPapers.length } };
  } catch (error) {
    console.error("Error fetching papers:", error);
    return { papers: [], pagination: { total: 0 } };
  }
}

function CategoryFilter({ selected }: { selected?: string }) {
  const categories = [
    { value: "cs.AI", label: "AI" },
    { value: "cs.LG", label: "ML" },
    { value: "cs.CL", label: "NLP" },
    { value: "cs.CV", label: "Vision" },
    { value: "stat.ML", label: "Stats ML" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <Badge
          key={cat.value}
          variant={selected === cat.value ? "default" : "outline"}
          className="cursor-pointer"
        >
          {cat.label}
        </Badge>
      ))}
    </div>
  );
}

function PapersLoading() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-3">
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

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Latest AI Research
        </h1>
        <p className="text-muted-foreground">
          Discover the latest papers from arXiv with AI-generated summaries and
          social context.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <CategoryFilter />
        <p className="text-sm text-muted-foreground">
          Updated every 6 hours from arXiv
        </p>
      </div>

      {/* Paper list */}
      <Suspense fallback={<PapersLoading />}>
        <PapersSection />
      </Suspense>
    </div>
  );
}
