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
    keyNumbers: Array<{
      metric: string;
      value: string;
      direction: string;
      baseline: string | null;
      conditions: string;
      source?: string;
    }>;
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

// ── Tooltip content maps ──────────────────────────────────────────────

const WHAT_KIND_TOOLTIPS: Record<string, string> = {
  "New Method": "This paper introduces a new technique or algorithm",
  "New Model": "This paper introduces a new AI model architecture",
  "Infrastructure / Tooling": "This paper improves the systems that AI runs on",
  "Benchmark / Evaluation": "This paper evaluates and compares existing approaches",
  "Dataset": "This paper introduces a new dataset for training or evaluation",
  "Application Study": "This paper applies AI to solve a specific real-world problem",
  "Survey / Review": "This paper reviews and organizes existing research in an area",
  "Scaling Study": "This paper studies how performance changes with scale",
  "Safety / Alignment": "This paper addresses AI safety, alignment, or trustworthiness",
};

const IMPACT_AREA_TOOLTIPS: Record<string, string> = {
  "Reasoning & Planning": "Affects how AI thinks through problems and plans actions",
  "Tool Use & Agents": "Affects how AI uses tools, browses, codes, or acts autonomously",
  "Cost & Efficiency": "Affects how much it costs to run AI or how fast it runs",
  "Context & Memory": "Affects how much information AI can remember or process at once",
  "Human-AI Interaction": "Affects how people work with, control, or communicate with AI",
  "Code & Engineering": "Affects how AI writes, reviews, or understands code",
  "Multimodal": "Affects how AI works across text, images, audio, and video",
  "Safety & Trust": "Affects how reliable, honest, or safe AI systems are",
  "Training & Data": "Affects how AI learns from, stores, or retrieves information",
  "Domain-Specific AI": "Affects how AI adapts to specialized fields or industries",
};

const TIME_TOOLTIPS: Record<string, string> = {
  Now: "Ready to use or integrate today",
  Soon: "Usable within weeks to months with some engineering",
  Later: "Needs significant research/engineering before practical use",
  Unknown: "Timeline to practical use is unclear",
};

const READINESS_TOOLTIPS: Record<string, string> = {
  "Ready to Try": "Can be used or integrated today with minimal effort",
  "Needs Engineering": "Requires significant engineering work before practical use",
  "Research Only": "Still in research phase, not ready for production",
};

// ── Shared components ─────────────────────────────────────────────────

// Practical value dots
function ValueDots({
  total,
  score,
}: {
  total: number;
  score: Record<string, number> | null;
}) {
  const filled = Math.min(6, Math.max(0, total));

  const lines: string[] = [`Practical Value: ${total}/6`];
  if (score && typeof score === "object") {
    const rp = score.real_problem ?? score.realProblem;
    const cr = score.concrete_result ?? score.concreteResult;
    const au = score.actually_usable ?? score.actuallyUsable;
    if (rp != null) lines.push(`Real problem? ${rp}/2`);
    if (cr != null) lines.push(`Concrete result? ${cr}/2`);
    if (au != null) lines.push(`Actually usable? ${au}/2`);
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
      <TooltipContent side="top" className="max-w-[280px]">
        <div className="space-y-0.5">
          {lines.map((line, i) => (
            <p key={i} className={i === 0 ? "font-medium" : "text-muted-foreground"}>
              {line}
            </p>
          ))}
        </div>
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
        <p>{TIME_TOOLTIPS[time] || time}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// What Kind badge (blue-tinted)
function WhatKindBadge({ kind }: { kind: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full shrink-0 bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/20">
          {kind}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px]">
        <p>{WHAT_KIND_TOOLTIPS[kind] || kind}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Readiness badge
function ReadinessBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    "Ready to Try": "bg-green-500/15 text-green-700 dark:text-green-400",
    "Needs Engineering": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    "Research Only": "bg-muted text-muted-foreground",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full shrink-0",
            colorMap[level] || "bg-muted text-muted-foreground"
          )}
        >
          {level}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px]">
        <p>{READINESS_TOOLTIPS[level] || level}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Redundancy rule: should readiness show in headline? ───────────────

function shouldShowReadinessInHeadline(time: string, readiness: string): boolean {
  // Redundant combos — only show Time-to-Value
  if (time === "Now" && readiness === "Ready to Try") return false;
  if (time === "Later" && readiness === "Research Only") return false;
  return true;
}

// ── Headline component ────────────────────────────────────────────────

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

  const showReadiness =
    hasAnalysis &&
    paper.analysis!.readinessLevel &&
    shouldShowReadinessInHeadline(
      paper.analysis!.timeToValue,
      paper.analysis!.readinessLevel
    );

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

          {/* Line 2: kind + tags + readiness + attribution */}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            {hasAnalysis && paper.analysis!.whatKind && (
              <WhatKindBadge kind={paper.analysis!.whatKind} />
            )}
            {tags.length > 0 && (
              <>
                {tags.map((tag, i) => (
                  <Tooltip key={tag}>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">
                        {i > 0 && <span className="text-border"> · </span>}
                        {tag}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <p>{IMPACT_AREA_TOOLTIPS[tag] || tag}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </>
            )}
            {/* Readiness badge — desktop only, with redundancy rule */}
            {showReadiness && (
              <span className="hidden md:inline-flex">
                <ReadinessBadge level={paper.analysis!.readinessLevel} />
              </span>
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

// Re-export tooltip maps for use in PaperDrawer
export { WHAT_KIND_TOOLTIPS, IMPACT_AREA_TOOLTIPS, TIME_TOOLTIPS, READINESS_TOOLTIPS };
