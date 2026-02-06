"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Heart } from "lucide-react";

// Types matching the feed API response
export interface FeedPaper {
  id: string;
  externalId: string;
  title: string;
  abstract: string | null;
  publishedAt: string | null;
  primaryCategory: string;
  categories: string[];
  pdfUrl: string | null;
  analysis: {
    hookSentence: string;
    whatKind: string;
    timeToValue: string;
    impactAreaTags: string[];
    practicalValueScore: Record<string, number>;
    practicalValueTotal: number;
    keyNumbers: Array<{ metric: string; value: string; context: string }>;
    readinessLevel: string;
    howThisChangesThings: string[];
    whatCameBefore: string;
    status: string;
  } | null;
  whoBehindThis: string | null;
  authorCount: number;
  firstAuthorAffiliation: string | null;
  mentionCount: number;
  totalEngagement: number;
}

// Practical value dots
function ValueDots({
  total,
  score,
}: {
  total: number;
  score: Record<string, number> | null;
}) {
  const filled = Math.min(6, Math.max(0, total));

  // Build tooltip text from score breakdown
  let tooltipText = `Value: ${total}/6`;
  if (score && typeof score === "object") {
    const parts: string[] = [];
    if ("novelty" in score) parts.push(`Novelty: ${score.novelty}/2`);
    if ("applicability" in score) parts.push(`Applicability: ${score.applicability}/2`);
    if ("clarity" in score) parts.push(`Clarity: ${score.clarity}/2`);
    if (parts.length > 0) tooltipText = parts.join(" \u00b7 ");
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-0.5 shrink-0" aria-label={`Practical value: ${total} out of 6`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full",
                i < filled ? "bg-amber-500 dark:bg-amber-400" : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Time-to-value badge
function TimeBadge({ time }: { time: string }) {
  const colorMap: Record<string, string> = {
    Now: "bg-green-500/15 text-green-700 dark:text-green-400",
    Soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Later: "bg-muted text-muted-foreground",
  };

  const tooltipMap: Record<string, string> = {
    Now: "Ready to use or integrate today",
    Soon: "Usable within weeks to months with some engineering",
    Later: "Needs significant research/engineering before practical use",
  };

  if (!time || time === "Unknown") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full shrink-0",
            colorMap[time] || "bg-muted text-muted-foreground"
          )}
        >
          {time}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{tooltipMap[time] || time}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface PaperHeadlineProps {
  paper: FeedPaper;
  isSelected: boolean;
  isSaved?: boolean;
  onClick: () => void;
}

export function PaperHeadline({
  paper,
  isSelected,
  isSaved,
  onClick,
}: PaperHeadlineProps) {
  const hasAnalysis = !!paper.analysis;
  const hookText = hasAnalysis
    ? paper.analysis!.hookSentence
    : paper.abstract
      ? paper.abstract.substring(0, 120) + (paper.abstract.length > 120 ? "..." : "")
      : paper.title;

  // Limit tags shown
  const tags = hasAnalysis ? paper.analysis!.impactAreaTags.slice(0, 3) : [];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 transition-colors border-b border-border/30 group cursor-pointer",
        isSelected
          ? "bg-primary/5 border-l-2 border-l-primary"
          : "hover:bg-muted/50 border-l-2 border-l-transparent"
      )}
    >
      {/* Line 1: dots + hook + time badge */}
      <div className="flex items-start gap-2.5">
        {/* Value dots — hidden when no analysis */}
        {hasAnalysis ? (
          <div className="mt-1">
            <ValueDots
              total={paper.analysis!.practicalValueTotal}
              score={paper.analysis!.practicalValueScore}
            />
          </div>
        ) : (
          <div className="w-[52px] shrink-0" /> // Spacer for alignment
        )}

        {/* Hook sentence */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "text-sm leading-relaxed flex-1",
                hasAnalysis
                  ? "text-foreground"
                  : "text-muted-foreground italic"
              )}
            >
              {hookText}
            </p>

            {/* Time badge + saved icon — right aligned */}
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              {isSaved && (
                <Heart className="h-3 w-3 fill-red-500 text-red-500" />
              )}
              {hasAnalysis && paper.analysis!.timeToValue && (
                <TimeBadge time={paper.analysis!.timeToValue} />
              )}
            </div>
          </div>

          {/* Line 2: kind + tags + attribution */}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            {hasAnalysis && paper.analysis!.whatKind && (
              <span className="font-medium">{paper.analysis!.whatKind}</span>
            )}
            {tags.length > 0 && (
              <>
                {hasAnalysis && paper.analysis!.whatKind && (
                  <span className="text-border">·</span>
                )}
                {tags.map((tag, i) => (
                  <span key={tag}>
                    {i > 0 && <span className="text-border"> · </span>}
                    {tag}
                  </span>
                ))}
              </>
            )}
            {/* Attribution — right aligned */}
            {paper.whoBehindThis && (
              <span className="ml-auto hidden sm:inline truncate max-w-[200px]">
                {paper.whoBehindThis}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
