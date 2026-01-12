"use client";

import { PaperCard } from "./paper-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface Paper {
  id: string;
  title: string;
  abstract?: string | null;
  publishedAt?: Date | null;
  primaryCategory?: string | null;
  summaryBullets?: string[] | null;
  pdfUrl?: string | null;
  externalId: string;
  authors?: { name: string; id?: string }[];
  mentionCount?: number;
}

interface PaperListProps {
  papers: Paper[];
  isLoading?: boolean;
}

export function PaperList({ papers, isLoading }: PaperListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <PaperCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No papers found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {papers.map((paper) => (
        <PaperCard key={paper.id} paper={paper} />
      ))}
    </div>
  );
}

function PaperCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4 mt-1" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}
