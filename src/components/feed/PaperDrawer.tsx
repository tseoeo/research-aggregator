"use client";

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { type FeedPaper } from "./PaperHeadline";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  X,
  ExternalLink,
  FileText,
  Heart,
  MessageCircle,
  ArrowUp,
} from "lucide-react";

interface PaperDrawerProps {
  paper: FeedPaper | null;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export function PaperDrawer({
  paper,
  onClose,
  isSaved,
  onToggleSave,
}: PaperDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const isOpen = !!paper;

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "ArrowLeft") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasAnalysis = !!paper.analysis;
  const arxivUrl = `https://arxiv.org/abs/${paper.externalId}`;
  const pdfUrl = paper.pdfUrl || `https://arxiv.org/pdf/${paper.externalId}.pdf`;

  return (
    <>
      {/* Overlay — desktop: dimmed feed, mobile: dimmed backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 lg:bg-black/10"
        onClick={onClose}
      />

      {/* Drawer panel */}
      {/* Desktop: right panel. Mobile: bottom sheet */}
      <div
        ref={drawerRef}
        className={cn(
          "fixed z-50 bg-background shadow-xl overflow-y-auto",
          // Desktop
          "hidden lg:flex lg:flex-col lg:inset-y-0 lg:right-0 lg:w-[480px] xl:w-[min(480px,40vw)] lg:border-l lg:border-border/50",
          // Animation
          "animate-in slide-in-from-right duration-200"
        )}
      >
        <DrawerContent
          paper={paper}
          hasAnalysis={hasAnalysis}
          arxivUrl={arxivUrl}
          pdfUrl={pdfUrl}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          onClose={onClose}
        />
      </div>

      {/* Mobile bottom sheet */}
      <div
        className={cn(
          "fixed z-50 bg-background shadow-xl overflow-y-auto rounded-t-xl lg:hidden",
          "inset-x-0 bottom-0 max-h-[85vh] border-t border-border/50",
          "animate-in slide-in-from-bottom duration-250"
        )}
      >
        {/* Drag handle */}
        <div className="sticky top-0 bg-background pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <DrawerContent
          paper={paper}
          hasAnalysis={hasAnalysis}
          arxivUrl={arxivUrl}
          pdfUrl={pdfUrl}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          onClose={onClose}
        />
      </div>
    </>
  );
}

function DrawerContent({
  paper,
  hasAnalysis,
  arxivUrl,
  pdfUrl,
  isSaved,
  onToggleSave,
  onClose,
}: {
  paper: FeedPaper;
  hasAnalysis: boolean;
  arxivUrl: string;
  pdfUrl: string;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col p-5 space-y-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Close drawer"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Title */}
      <h2 className="text-lg font-semibold leading-snug pr-8 font-serif">
        {paper.title}
      </h2>

      {/* Hook sentence */}
      {hasAnalysis && paper.analysis!.hookSentence && (
        <div className="border-l-2 border-amber-500 pl-3 py-1">
          <p className="text-sm text-foreground leading-relaxed">
            {paper.analysis!.hookSentence}
          </p>
        </div>
      )}

      {/* Badges row: What Kind + Impact Area Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasAnalysis && paper.analysis!.whatKind && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
            {paper.analysis!.whatKind}
          </span>
        )}
        {hasAnalysis &&
          paper.analysis!.impactAreaTags.map((tag) => (
            <Tooltip key={tag}>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-muted/60 text-muted-foreground">
                  {tag}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tag}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        {/* Fallback: arXiv categories when no analysis */}
        {!hasAnalysis &&
          paper.categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-muted/60 text-muted-foreground"
            >
              {cat}
            </span>
          ))}
      </div>

      {/* Signals row: dots + time + readiness */}
      {hasAnalysis && (
        <div className="flex items-center gap-3">
          {/* Practical value dots */}
          <ValueDotsLarge
            total={paper.analysis!.practicalValueTotal}
            score={paper.analysis!.practicalValueScore}
          />

          {/* Time-to-value */}
          {paper.analysis!.timeToValue && paper.analysis!.timeToValue !== "Unknown" && (
            <TimeBadge time={paper.analysis!.timeToValue} />
          )}

          {/* Readiness level */}
          {paper.analysis!.readinessLevel && (
            <ReadinessBadge level={paper.analysis!.readinessLevel} />
          )}
        </div>
      )}

      {/* Who's Behind This */}
      {paper.whoBehindThis && (
        <p className="text-sm text-muted-foreground">{paper.whoBehindThis}</p>
      )}

      {/* Published date */}
      {paper.publishedAt && (
        <p className="text-xs text-muted-foreground">
          Published{" "}
          {new Date(paper.publishedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      )}

      <div className="h-px bg-border/50" />

      {/* Key Numbers */}
      {hasAnalysis && paper.analysis!.keyNumbers && paper.analysis!.keyNumbers.length > 0 && (
        <DrawerSection title="Key Numbers">
          <ul className="space-y-2">
            {paper.analysis!.keyNumbers.map((kn, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-foreground">{kn.metric}:</span>{" "}
                <span className="text-foreground">{kn.value}</span>
                {kn.context && (
                  <span className="text-muted-foreground"> ({kn.context})</span>
                )}
              </li>
            ))}
          </ul>
        </DrawerSection>
      )}

      {/* How This Changes Things */}
      {hasAnalysis &&
        paper.analysis!.howThisChangesThings &&
        paper.analysis!.howThisChangesThings.length > 0 && (
          <DrawerSection title="How This Changes Things">
            <ul className="space-y-2">
              {paper.analysis!.howThisChangesThings.map((item, i) => (
                <li key={i} className="text-sm text-foreground leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </DrawerSection>
        )}

      {/* What Came Before */}
      {hasAnalysis && paper.analysis!.whatCameBefore && (
        <DrawerSection title="What Came Before">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {paper.analysis!.whatCameBefore}
          </p>
        </DrawerSection>
      )}

      {/* Abstract (shown when no analysis) */}
      {!hasAnalysis && paper.abstract && (
        <DrawerSection title="Abstract">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {paper.abstract}
          </p>
        </DrawerSection>
      )}

      {/* Discussions */}
      <DrawerSection title="Discussions">
        {paper.mentionCount > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                {paper.mentionCount} mention{paper.mentionCount !== 1 ? "s" : ""}
              </span>
              {paper.totalEngagement > 0 && (
                <>
                  <span className="text-border">·</span>
                  <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{paper.totalEngagement} engagement</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No discussions yet</p>
        )}
      </DrawerSection>

      <div className="h-px bg-border/50" />

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1">
        <a
          href={arxivUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border/50 hover:bg-muted transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View on arXiv
        </a>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border/50 hover:bg-muted transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          PDF
        </a>
        <div className="flex-1" />
        <button
          onClick={onToggleSave}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors",
            isSaved
              ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-border/50 hover:bg-muted"
          )}
        >
          <Heart
            className={cn(
              "h-3.5 w-3.5",
              isSaved && "fill-current"
            )}
          />
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ValueDotsLarge({
  total,
  score,
}: {
  total: number;
  score: Record<string, number> | null;
}) {
  const filled = Math.min(6, Math.max(0, total));

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
        <div className="flex items-center gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                i < filled ? "bg-amber-500 dark:bg-amber-400" : "bg-muted-foreground/20"
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-1">{total}/6</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TimeBadge({ time }: { time: string }) {
  const colorMap: Record<string, string> = {
    Now: "bg-green-500/15 text-green-700 dark:text-green-400",
    Soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Later: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
        colorMap[time] || "bg-muted text-muted-foreground"
      )}
    >
      {time}
    </span>
  );
}

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
            "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
            colorMap[level] || "bg-muted text-muted-foreground"
          )}
        >
          {level}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {level === "Ready to Try"
            ? "Can be used or integrated today with minimal effort"
            : level === "Needs Engineering"
              ? "Requires significant engineering work before practical use"
              : "Still in research phase, not ready for production"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
