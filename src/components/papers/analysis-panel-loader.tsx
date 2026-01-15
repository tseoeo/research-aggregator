"use client";

import { useEffect, useState } from "react";
import { AnalysisPanel, type PaperAnalysis } from "./analysis-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, SparklesIcon } from "lucide-react";

interface AnalysisPanelLoaderProps {
  paperId: string;
  className?: string;
}

interface AnalysisResponse {
  paperId: string;
  paperTitle: string;
  status: "complete" | "pending";
  analysis: {
    role: "Primitive" | "Platform" | "Proof" | "Provocation";
    roleConfidence: number;
    timeToValue: "Now" | "Soon" | "Later" | "Unknown";
    timeToValueConfidence: number;
    interestingness: {
      total_score: number;
      tier: "low" | "moderate" | "high" | "very_high";
      checks: Array<{
        check_id: string;
        score: number;
        answer: string;
        evidence_pointers: string[];
        notes?: string;
      }>;
    };
    businessPrimitives: {
      selected: ("cost" | "reliability" | "speed" | "quality" | "risk" | "new_capability")[];
      justification: string;
      evidence_pointers: string[];
    };
    keyNumbers: Array<{
      metric_name: string;
      value: string;
      direction: "up" | "down";
      baseline?: string;
      conditions: string;
      evidence_pointer: string;
    }>;
    constraints: Array<{
      constraint: string;
      why_it_matters: string;
      evidence_pointer: string;
    }>;
    failureModes: Array<{
      failure_mode: string;
      why_it_matters: string;
      evidence_pointer: string;
    }>;
    whatIsMissing?: string[];
    readinessLevel: "research_only" | "prototype_candidate" | "deployable_with_work";
    readinessJustification?: string;
    readinessEvidencePointers?: string[];
    useCaseMappings: Array<{
      name: string;
      definition?: string;
      fitConfidence: "low" | "med" | "high";
      because: string;
      evidencePointers?: string[];
    }>;
    publicViews: {
      hook_sentence: string;
      "30s_summary": string[];
      "3m_summary": string;
      "8m_operator_addendum"?: string;
    };
  } | null;
  message?: string;
}

export function AnalysisPanelLoader({ paperId, className }: AnalysisPanelLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        setLoading(true);
        setError(null);

        // Fetch from our internal API using the arxiv ID
        const response = await fetch(`/api/papers/arxiv/${paperId}/analysis`);

        if (!response.ok) {
          if (response.status === 404) {
            // Paper not found in our DB - might not be indexed yet
            setData(null);
            setError("This paper hasn't been indexed yet. Check back later.");
            return;
          }
          throw new Error(`Failed to fetch analysis: ${response.status}`);
        }

        const result: AnalysisResponse = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching analysis:", err);
        setError(err instanceof Error ? err.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    }

    if (paperId) {
      fetchAnalysis();
    }
  }, [paperId]);

  if (loading) {
    return <AnalysisLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data || data.status === "pending" || !data.analysis) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Analysis in progress...</span>
        </div>
        <p className="text-xs text-muted-foreground max-w-md">
          {data?.message || "This paper is queued for DTL-P analysis. The structured analysis will appear here once processing is complete."}
        </p>
      </div>
    );
  }

  // Transform API response to component props
  const analysis: PaperAnalysis = {
    role: data.analysis.role,
    roleConfidence: data.analysis.roleConfidence,
    timeToValue: data.analysis.timeToValue,
    timeToValueConfidence: data.analysis.timeToValueConfidence,
    interestingness: data.analysis.interestingness,
    businessPrimitives: data.analysis.businessPrimitives,
    keyNumbers: data.analysis.keyNumbers,
    constraints: data.analysis.constraints,
    failureModes: data.analysis.failureModes,
    whatIsMissing: data.analysis.whatIsMissing,
    readinessLevel: data.analysis.readinessLevel,
    readinessJustification: data.analysis.readinessJustification,
    readinessEvidencePointers: data.analysis.readinessEvidencePointers,
    useCaseMappings: data.analysis.useCaseMappings,
    publicViews: data.analysis.publicViews,
  };

  return <AnalysisPanel analysis={analysis} className={className} />;
}

function AnalysisLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Badge skeletons */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-full max-w-md" />

      {/* Content skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
