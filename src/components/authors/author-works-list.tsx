"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, FileText, Quote } from "lucide-react";

interface Work {
  id: string;
  title: string;
  publicationYear: number;
  citedByCount: number;
  doi?: string;
  openAccessUrl?: string;
}

interface AuthorWorksListProps {
  authorId: string;
  limit?: number;
}

export function AuthorWorksList({ authorId, limit = 10 }: AuthorWorksListProps) {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorks() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/authors/${authorId}?include_works=true&works_limit=${limit}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch works");
        }

        const data = await response.json();
        setWorks(data.works || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load works");
      } finally {
        setLoading(false);
      }
    }

    fetchWorks();
  }, [authorId, limit]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 mt-1" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground">
        Failed to load works. Please try again later.
      </div>
    );
  }

  if (!works || works.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No works found for this author.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {works.map((work) => {
        // Check if this might be an arXiv paper (doi contains arxiv)
        const isArxiv = work.doi?.includes("arxiv");
        const arxivId = isArxiv
          ? work.doi?.replace("https://doi.org/10.48550/arXiv.", "")
          : null;

        return (
          <div key={work.id} className="flex items-start gap-3 group">
            <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {arxivId ? (
                    <Link
                      href={`/papers/${arxivId}`}
                      className="text-sm font-medium hover:underline line-clamp-2"
                    >
                      {work.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium line-clamp-2">
                      {work.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {work.openAccessUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      asChild
                    >
                      <a
                        href={work.openAccessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Access PDF"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{work.publicationYear}</span>
                {work.citedByCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Quote className="h-3 w-3" />
                    {work.citedByCount.toLocaleString()} citations
                  </span>
                )}
                {work.doi && (
                  <a
                    href={work.doi}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    DOI
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
