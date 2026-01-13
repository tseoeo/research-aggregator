"use client";

import { PaperCard } from "./paper-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export interface SocialMention {
  id: string;
  platformName: string;
  authorHandle?: string | null;
  authorName?: string | null;
  content?: string | null;
  url: string;
  likes?: number | null;
  reposts?: number | null;
  replies?: number | null;
  postedAt?: string | null;
}

export interface NewsMention {
  id: string;
  title: string;
  snippet?: string | null;
  url: string;
  sourceName?: string | null;
  publishedAt?: string | null;
  imageUrl?: string | null;
}

export interface Paper {
  id: string;
  title: string;
  abstract?: string | null;
  publishedAt?: Date | null;
  primaryCategory?: string | null;
  summaryBullets?: string[] | null;
  summaryEli5?: string | null;
  pdfUrl?: string | null;
  externalId: string;
  authors?: { name: string; id?: string }[];
  socialMentions?: SocialMention[];
  newsMentions?: NewsMention[];
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="heading-display text-xl mb-2">No papers found</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Try adjusting your filters or check back later for new research.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger-children">
      {papers.map((paper) => (
        <PaperCard key={paper.id} paper={paper} />
      ))}
    </div>
  );
}

function PaperCardSkeleton() {
  return (
    <Card className="border-border/50">
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
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        <Skeleton className="h-10 w-full rounded-lg mb-4" />
        <div className="space-y-2.5 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex justify-between pt-4 border-t border-border/50">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}
