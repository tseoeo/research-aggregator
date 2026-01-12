"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, FileText } from "lucide-react";
import { SaveButton } from "./save-button";
import {
  SummaryTab,
  AbstractTab,
  Eli5Tab,
  SocialTab,
  NewsTab,
} from "./card-tabs";
import type { Paper } from "./paper-list";

interface PaperCardProps {
  paper: Paper;
}

export function PaperCard({ paper }: PaperCardProps) {
  const publishedDate = paper.publishedAt
    ? formatDistanceToNow(new Date(paper.publishedAt), { addSuffix: true })
    : null;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
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
          <h3 className="font-semibold text-base sm:text-lg leading-tight hover:text-primary transition-colors line-clamp-2">
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

      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {/* Tabs for content */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-8">
            <TabsTrigger value="summary" className="text-xs">
              Summary
            </TabsTrigger>
            <TabsTrigger value="abstract" className="text-xs">
              Abstract
            </TabsTrigger>
            <TabsTrigger value="eli5" className="text-xs">
              ELI5
            </TabsTrigger>
            <TabsTrigger value="social" className="text-xs">
              Social
              {paper.mentionCount ? ` (${paper.mentionCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="news" className="text-xs">
              News
              {paper.newsMentions?.length ? ` (${paper.newsMentions.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <div className="mt-3 min-h-[100px] max-h-[200px] overflow-y-auto">
            <TabsContent value="summary" className="mt-0">
              <SummaryTab bullets={paper.summaryBullets} />
            </TabsContent>

            <TabsContent value="abstract" className="mt-0">
              <AbstractTab abstract={paper.abstract} />
            </TabsContent>

            <TabsContent value="eli5" className="mt-0">
              <Eli5Tab eli5={paper.summaryEli5} />
            </TabsContent>

            <TabsContent value="social" className="mt-0">
              <SocialTab mentions={paper.socialMentions} />
            </TabsContent>

            <TabsContent value="news" className="mt-0">
              <NewsTab news={paper.newsMentions} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
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

          <SaveButton arxivId={paper.externalId} variant="ghost" />
        </div>
      </CardContent>
    </Card>
  );
}
