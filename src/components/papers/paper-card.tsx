"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ExternalLink,
  FileText,
  MessageCircle,
  Newspaper,
  BookOpen,
  Lightbulb,
  ListTree,
  Calendar,
} from "lucide-react";
import { SaveButton } from "./save-button";
import {
  SummaryTab,
  AbstractTab,
  Eli5Tab,
  SocialTab,
  NewsTab,
} from "./card-tabs";
import type { Paper } from "./paper-list";
import { cn } from "@/lib/utils";

interface PaperCardProps {
  paper: Paper;
}

export function PaperCard({ paper }: PaperCardProps) {
  const publishedDate = paper.publishedAt
    ? formatDistanceToNow(new Date(paper.publishedAt), { addSuffix: true })
    : null;

  const hasSocial = paper.mentionCount && paper.mentionCount > 0;
  const hasNews = paper.newsMentions && paper.newsMentions.length > 0;

  return (
    <Card className="paper-card group border-border/50 hover:border-border transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
        {/* Top row: Category + Date + arXiv ID */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            {paper.primaryCategory && (
              <Badge
                variant="secondary"
                className="badge-category bg-primary/10 text-primary border-0 hover:bg-primary/15"
              >
                {paper.primaryCategory}
              </Badge>
            )}
            {publishedDate && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {publishedDate}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
            {paper.externalId}
          </span>
        </div>

        {/* Title */}
        <Link href={`/papers/${paper.id}`} className="block group/title">
          <h3 className="heading-display text-lg sm:text-xl leading-snug text-foreground group-hover/title:text-primary transition-colors duration-200">
            {paper.title}
          </h3>
        </Link>

        {/* Authors */}
        {paper.authors && paper.authors.length > 0 && (
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-3 text-sm text-muted-foreground">
            {paper.authors.slice(0, 4).map((author, idx) => (
              <span key={idx} className="inline-flex items-center">
                {author.id ? (
                  <Link
                    href={`/authors/${author.id}`}
                    className="hover:text-foreground transition-colors link-underline"
                  >
                    {author.name}
                  </Link>
                ) : (
                  <span>{author.name}</span>
                )}
                {idx < Math.min(paper.authors!.length, 4) - 1 && (
                  <span className="text-muted-foreground/50 ml-1">,</span>
                )}
              </span>
            ))}
            {paper.authors.length > 4 && (
              <span className="text-muted-foreground/70 text-xs ml-1">
                +{paper.authors.length - 4} more
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        {/* Tabs for content */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full h-10 p-1 bg-muted/50 gap-0.5">
            <TabsTrigger
              value="summary"
              className="flex-1 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5"
            >
              <ListTree className="h-3.5 w-3.5 hidden sm:block" />
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="abstract"
              className="flex-1 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5 hidden sm:block" />
              Abstract
            </TabsTrigger>
            <TabsTrigger
              value="eli5"
              className="flex-1 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5"
            >
              <Lightbulb className="h-3.5 w-3.5 hidden sm:block" />
              ELI5
            </TabsTrigger>
            <TabsTrigger
              value="social"
              className={cn(
                "flex-1 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5",
                hasSocial && "text-primary"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5 hidden sm:block" />
              <span>Social</span>
              {hasSocial && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-4 px-1 text-[10px] bg-primary/10 text-primary border-0"
                >
                  {paper.mentionCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="news"
              className={cn(
                "flex-1 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5",
                hasNews && "text-primary"
              )}
            >
              <Newspaper className="h-3.5 w-3.5 hidden sm:block" />
              <span>News</span>
              {hasNews && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-4 px-1 text-[10px] bg-primary/10 text-primary border-0"
                >
                  {paper.newsMentions!.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 min-h-[120px] max-h-[180px] overflow-y-auto pr-1">
            <TabsContent value="summary" className="mt-0 animate-fade-in">
              <SummaryTab bullets={paper.summaryBullets} />
            </TabsContent>

            <TabsContent value="abstract" className="mt-0 animate-fade-in">
              <AbstractTab abstract={paper.abstract} />
            </TabsContent>

            <TabsContent value="eli5" className="mt-0 animate-fade-in">
              <Eli5Tab eli5={paper.summaryEli5} />
            </TabsContent>

            <TabsContent value="social" className="mt-0 animate-fade-in">
              <SocialTab mentions={paper.socialMentions} />
            </TabsContent>

            <TabsContent value="news" className="mt-0 animate-fade-in">
              <NewsTab news={paper.newsMentions} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-1">
            {paper.pdfUrl && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground hover:text-foreground h-8 px-3"
              >
                <a
                  href={paper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  PDF
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-foreground h-8 px-3"
            >
              <a
                href={`https://arxiv.org/abs/${paper.externalId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
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
