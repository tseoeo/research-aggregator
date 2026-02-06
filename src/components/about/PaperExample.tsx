"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface ExamplePaper {
  title: string;
  abstract: string;
  publishedAt: string | null;
  categories: string[] | null;
  authors: string[];
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
      source?: string;
    }>;
    readinessLevel: string;
    howThisChangesThings: string[];
    whatCameBefore: string;
  };
}

const timeColors: Record<string, string> = {
  Now: "bg-green-500/15 text-green-700 dark:text-green-400",
  Soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Later: "bg-muted text-muted-foreground",
};

const readinessColors: Record<string, string> = {
  "Ready to Try": "bg-green-500/15 text-green-700 dark:text-green-400",
  "Needs Engineering": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "Research Only": "bg-muted text-muted-foreground",
};

export function PaperExample({
  paper,
  onRefresh,
}: {
  paper: ExamplePaper | null;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  if (!paper) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No analyzed papers available yet.</p>
      </div>
    );
  }

  const a = paper.analysis;
  const filled = Math.min(6, Math.max(0, a.practicalValueTotal));

  async function handleRefresh() {
    setRefreshing(true);
    onRefresh();
    // Brief delay so spinner is visible
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Abstract */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            What the paper says
          </p>
          <h4 className="text-sm font-semibold text-foreground leading-snug mb-3">
            {paper.title}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {paper.abstract && paper.abstract.length > 600
              ? paper.abstract.substring(0, 600) + "..."
              : paper.abstract}
          </p>
          {paper.authors.length > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-3">
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 && ` + ${paper.authors.length - 3} more`}
            </p>
          )}
        </div>

        {/* Right: Analysis */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            What our analysis finds
          </p>

          {/* Hook */}
          <div className="border-l-2 border-amber-500 pl-3 mb-4">
            <p className="text-sm text-foreground leading-relaxed">{a.hookSentence}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/20">
              {a.whatKind}
            </span>
            {a.impactAreaTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-muted/60 text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Signals row */}
          <div className="flex items-center gap-3 mb-4">
            {/* Value dots */}
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    i < filled
                      ? "bg-amber-500 dark:bg-amber-400"
                      : "bg-muted-foreground/20"
                  )}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                {a.practicalValueTotal}/6
              </span>
            </div>

            {a.timeToValue && a.timeToValue !== "Unknown" && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
                  timeColors[a.timeToValue] || "bg-muted text-muted-foreground"
                )}
              >
                {a.timeToValue}
              </span>
            )}

            {a.readinessLevel && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
                  readinessColors[a.readinessLevel] || "bg-muted text-muted-foreground"
                )}
              >
                {a.readinessLevel}
              </span>
            )}
          </div>

          {/* Key Numbers */}
          {a.keyNumbers.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                Key Numbers
              </p>
              <ul className="space-y-1">
                {a.keyNumbers.map((kn, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{kn.metric}:</span> {kn.value}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* How This Changes Things */}
          {a.howThisChangesThings.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                How This Changes Things
              </p>
              <ul className="space-y-1.5">
                {a.howThisChangesThings.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                    <span className="text-amber-500 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What Came Before */}
          {a.whatCameBefore && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                What Came Before
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {a.whatCameBefore}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Refresh button */}
      <div className="flex justify-center">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border/50 hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          Show another example
        </button>
      </div>
    </div>
  );
}
