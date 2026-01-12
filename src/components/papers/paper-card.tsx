"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  FileText,
  MessageCircle,
} from "lucide-react";
import { SaveButton } from "./save-button";

interface PaperCardProps {
  paper: {
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
  };
}

export function PaperCard({ paper }: PaperCardProps) {
  const publishedDate = paper.publishedAt
    ? formatDistanceToNow(new Date(paper.publishedAt), { addSuffix: true })
    : null;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        {/* Category and date */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <div className="flex items-center gap-2">
            {paper.primaryCategory && (
              <Badge variant="secondary" className="font-mono text-xs">
                {paper.primaryCategory}
              </Badge>
            )}
            {publishedDate && <span>{publishedDate}</span>}
          </div>
          <span className="font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {paper.externalId}
          </span>
        </div>

        {/* Title */}
        <Link href={`/papers/${paper.id}`} className="block">
          <h3 className="font-semibold text-lg leading-tight hover:text-primary transition-colors line-clamp-2">
            {paper.title}
          </h3>
        </Link>

        {/* Authors */}
        {paper.authors && paper.authors.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 text-sm text-muted-foreground">
            {paper.authors.slice(0, 5).map((author, idx) => (
              <span key={idx}>
                {author.id ? (
                  <Link
                    href={`/authors/${author.id}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {author.name}
                  </Link>
                ) : (
                  author.name
                )}
                {idx < Math.min(paper.authors!.length, 5) - 1 && ","}
              </span>
            ))}
            {paper.authors.length > 5 && (
              <span className="text-muted-foreground">
                +{paper.authors.length - 5} more
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Summary bullets */}
        {paper.summaryBullets && paper.summaryBullets.length > 0 && (
          <ul className="space-y-1 mb-4 text-sm text-muted-foreground">
            {paper.summaryBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary mt-1.5 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
                <span className="line-clamp-2">{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Abstract fallback if no summary */}
        {!paper.summaryBullets && paper.abstract && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {paper.abstract}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {paper.pdfUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={paper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  PDF
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`https://arxiv.org/abs/${paper.externalId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                arXiv
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Mention indicators */}
            {paper.mentionCount !== undefined && paper.mentionCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span>{paper.mentionCount}</span>
              </div>
            )}

            <SaveButton arxivId={paper.externalId} variant="ghost" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
