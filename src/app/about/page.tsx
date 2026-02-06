"use client";

import { useEffect, useState, useCallback } from "react";
import { PipelineViz } from "@/components/about/PipelineViz";
import { FieldExplainer } from "@/components/about/FieldExplainer";
import { PaperExample } from "@/components/about/PaperExample";
import { StatsGrid } from "@/components/about/StatsGrid";
import { DistributionCharts } from "@/components/about/DistributionCharts";

interface ShowcaseData {
  stats: {
    totalPapers: number;
    analyzedPapers: number;
    totalTokens: number;
    avgPapersPerDay: number;
    categoriesTracked: number;
    categories: string[];
  };
  distributions: {
    practicalValue: Array<{ score: number; count: number }>;
    whatKind: Array<{ kind: string; count: number }>;
    timeToValue: Array<{ value: string; count: number }>;
    impactAreas: Array<{ area: string; count: number }>;
    readinessLevel: Array<{ level: string; count: number }>;
  };
  examplePaper: {
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
      keyNumbers: Array<{ metric: string; value: string; source?: string }>;
      readinessLevel: string;
      howThisChangesThings: string[];
      whatCameBefore: string;
    };
  } | null;
}

export default function AboutPage() {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examplePaper, setExamplePaper] = useState<ShowcaseData["examplePaper"]>(null);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setExamplePaper(d.examplePaper);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refreshExample = useCallback(() => {
    fetch("/api/showcase?refresh=true")
      .then((r) => r.json())
      .then((d) => {
        if (d.examplePaper) setExamplePaper(d.examplePaper);
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="container px-6 py-20">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-80 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container px-6 py-20 text-center">
        <p className="text-muted-foreground">Failed to load data. {error}</p>
      </div>
    );
  }

  return (
    <div className="container px-6 py-12 max-w-4xl mx-auto space-y-16">
      {/* Section 1: Intro */}
      <section>
        <h1 className="text-3xl font-bold tracking-tight">How It Works</h1>
        <p className="text-muted-foreground mt-3 text-lg leading-relaxed max-w-2xl">
          Research Aggregator tracks AI research papers from arXiv, then uses AI
          to analyze each one for practical value — what it does, who it affects,
          and whether you can use it today.
        </p>
        <p className="text-muted-foreground mt-2 text-lg">Here&apos;s how.</p>
      </section>

      {/* Section 2: Pipeline */}
      <section>
        <h2 className="text-xl font-semibold mb-6">The Pipeline</h2>
        <PipelineViz />
      </section>

      {/* Section 3: 10 Fields */}
      <section>
        <h2 className="text-xl font-semibold mb-6">The 10 Fields</h2>
        <FieldExplainer />
      </section>

      {/* Section 4: Real Example */}
      <section>
        <h2 className="text-xl font-semibold mb-6">A Real Example</h2>
        <PaperExample paper={examplePaper} onRefresh={refreshExample} />
      </section>

      {/* Section 5: Live Stats */}
      <section>
        <h2 className="text-xl font-semibold mb-6">Live Stats</h2>
        <StatsGrid stats={data.stats} />
      </section>

      {/* Section 6: Distributions */}
      <section>
        <h2 className="text-xl font-semibold mb-6">How the Data Distributes</h2>
        <DistributionCharts
          distributions={data.distributions}
          analyzedCount={data.stats.analyzedPapers}
        />
      </section>
    </div>
  );
}
