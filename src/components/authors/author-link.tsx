"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, User, Building2 } from "lucide-react";
import { AuthorSocialLinks } from "./author-social-links";

interface DiscoveredAuthor {
  name: string;
  normalizedName: string;
  orcid?: string;
  openalexId?: string;
  twitterHandle?: string;
  blueskyHandle?: string;
  githubHandle?: string;
  linkedinUrl?: string;
  personalWebsite?: string;
  affiliations: {
    institution: string;
    country?: string;
    current: boolean;
  }[];
  topics: string[];
  worksCount?: number;
  citedByCount?: number;
  hIndex?: number;
  sources: string[];
}

interface AuthorLinkProps {
  name: string;
  affiliation?: string;
  paperTitle?: string;
}

export function AuthorLink({ name, affiliation, paperTitle }: AuthorLinkProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [author, setAuthor] = useState<DiscoveredAuthor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function discoverAuthor() {
    if (fetched) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ name });
      if (affiliation) params.set("affiliation", affiliation);
      if (paperTitle) params.set("paper_title", paperTitle);

      const response = await fetch(`/api/authors/discover?${params}`);

      if (response.status === 404) {
        setAuthor(null);
        setFetched(true);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to discover author");
      }

      const data = await response.json();
      setAuthor(data.author);
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load author");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !fetched) {
      discoverAuthor();
    }
  }

  const currentAffiliation = author?.affiliations.find((a) => a.current);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="hover:underline focus:outline-none focus:underline text-left">
          {name}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive">
              {error}
            </div>
          )}

          {fetched && !author && !loading && (
            <div className="text-sm text-muted-foreground">
              No additional information found for this author.
            </div>
          )}

          {author && (
            <>
              {/* Current affiliation */}
              {currentAffiliation && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{currentAffiliation.institution}</span>
                </div>
              )}

              {/* Metrics */}
              {(author.worksCount || author.citedByCount || author.hIndex) && (
                <div className="flex flex-wrap gap-4 text-sm">
                  {author.worksCount !== undefined && (
                    <div>
                      <span className="font-semibold">{author.worksCount.toLocaleString()}</span>
                      <span className="text-muted-foreground ml-1">works</span>
                    </div>
                  )}
                  {author.citedByCount !== undefined && (
                    <div>
                      <span className="font-semibold">{author.citedByCount.toLocaleString()}</span>
                      <span className="text-muted-foreground ml-1">citations</span>
                    </div>
                  )}
                  {author.hIndex !== undefined && (
                    <div>
                      <span className="text-muted-foreground">h-index:</span>
                      <span className="font-semibold ml-1">{author.hIndex}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Social links */}
              <AuthorSocialLinks
                social={{
                  twitter: author.twitterHandle,
                  bluesky: author.blueskyHandle,
                  github: author.githubHandle,
                  linkedin: author.linkedinUrl,
                  website: author.personalWebsite,
                }}
              />

              {/* Topics */}
              {author.topics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {author.topics.slice(0, 5).map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Link to full profile */}
              {(author.openalexId || author.orcid) && (
                <div className="pt-2 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/authors/${author.openalexId || author.orcid}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Full Profile
                    </Link>
                  </Button>
                </div>
              )}

              {/* Sources */}
              <div className="text-xs text-muted-foreground">
                Data from: {author.sources.join(", ")}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
