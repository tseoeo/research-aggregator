"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  RoleBadge,
  TimeToValueBadge,
  InterestBadge,
  ReadinessBadge,
  BusinessPrimitiveBadge,
  FitConfidenceBadge,
  ConfidenceIndicator,
} from "./analysis-badges";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Target,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface InterestingnessCheck {
  check_id: string;
  score: number;
  answer: string;
  evidence_pointers: string[];
  notes?: string;
}

export interface Interestingness {
  total_score: number;
  tier: "low" | "moderate" | "high" | "very_high";
  checks: InterestingnessCheck[];
}

export interface BusinessPrimitives {
  selected: ("cost" | "reliability" | "speed" | "quality" | "risk" | "new_capability")[];
  justification: string;
  evidence_pointers: string[];
}

export interface KeyNumber {
  metric_name: string;
  value: string;
  direction: "up" | "down";
  baseline?: string;
  conditions: string;
  evidence_pointer: string;
}

export interface Constraint {
  constraint: string;
  why_it_matters: string;
  evidence_pointer: string;
}

export interface FailureMode {
  failure_mode: string;
  why_it_matters: string;
  evidence_pointer: string;
}

export interface UseCaseMapping {
  name: string;
  definition?: string;
  fitConfidence: "low" | "med" | "high";
  because: string;
  evidencePointers?: string[];
}

export interface PublicViews {
  hook_sentence: string;
  "30s_summary": string[];
  "3m_summary": string;
  "8m_operator_addendum"?: string;
}

export interface PaperAnalysis {
  role: "Primitive" | "Platform" | "Proof" | "Provocation";
  roleConfidence: number;
  timeToValue: "Now" | "Soon" | "Later" | "Unknown";
  timeToValueConfidence: number;
  interestingness: Interestingness;
  businessPrimitives: BusinessPrimitives;
  keyNumbers: KeyNumber[];
  constraints: Constraint[];
  failureModes: FailureMode[];
  whatIsMissing?: string[];
  readinessLevel: "research_only" | "prototype_candidate" | "deployable_with_work";
  readinessJustification?: string;
  readinessEvidencePointers?: string[];
  useCaseMappings: UseCaseMapping[];
  publicViews: PublicViews;
}

interface AnalysisPanelProps {
  analysis: PaperAnalysis;
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AnalysisPanel({ analysis, className }: AnalysisPanelProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Overview Badges */}
      <div className="flex flex-wrap gap-2">
        <RoleBadge
          role={analysis.role}
          confidence={analysis.roleConfidence}
        />
        <TimeToValueBadge
          ttv={analysis.timeToValue}
          confidence={analysis.timeToValueConfidence}
        />
        <InterestBadge
          tier={analysis.interestingness.tier}
          score={analysis.interestingness.total_score}
        />
        <ReadinessBadge level={analysis.readinessLevel} />
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="summary" className="w-full">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="risks">Risks</TabsTrigger>
            <TabsTrigger value="usecases">Use Cases</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="summary" className="mt-4">
          <SummaryTab analysis={analysis} />
        </TabsContent>

        <TabsContent value="scores" className="mt-4">
          <ScoresTab analysis={analysis} />
        </TabsContent>

        <TabsContent value="business" className="mt-4">
          <BusinessTab analysis={analysis} />
        </TabsContent>

        <TabsContent value="risks" className="mt-4">
          <RisksTab analysis={analysis} />
        </TabsContent>

        <TabsContent value="usecases" className="mt-4">
          <UseCasesTab analysis={analysis} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function SummaryTab({ analysis }: { analysis: PaperAnalysis }) {
  const { publicViews } = analysis;

  return (
    <div className="space-y-4">
      {/* Hook Sentence */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-lg font-medium leading-relaxed">
          {publicViews.hook_sentence}
        </p>
      </div>

      {/* 30-second Summary */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-muted-foreground">
          Quick Takeaways
        </h4>
        <ul className="space-y-2">
          {publicViews["30s_summary"].map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 3-minute Summary */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-muted-foreground">
          Detailed Summary
        </h4>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {publicViews["3m_summary"]}
          </p>
        </div>
      </div>

      {/* 8-minute Operator Addendum */}
      {publicViews["8m_operator_addendum"] && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">
            Technical Deep Dive
          </h4>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {publicViews["8m_operator_addendum"]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoresTab({ analysis }: { analysis: PaperAnalysis }) {
  const { interestingness } = analysis;

  const checkLabels: Record<string, { label: string; description: string }> = {
    business_primitive_impact: {
      label: "Business Impact",
      description: "Does this clearly impact a business primitive?",
    },
    delta_specificity: {
      label: "Delta Specificity",
      description: "Are improvements quantified with conditions?",
    },
    comparison_credibility: {
      label: "Comparison Quality",
      description: "Are baselines fair and credible?",
    },
    real_world_plausibility: {
      label: "Real-World Fit",
      description: "Is this feasible in production environments?",
    },
    evidence_strength: {
      label: "Evidence Strength",
      description: "Multiple datasets, robustness, ablations?",
    },
    failure_disclosure: {
      label: "Failure Disclosure",
      description: "Are limitations and failure modes discussed?",
    },
  };

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold">
          {interestingness.total_score}
          <span className="text-lg text-muted-foreground">/12</span>
        </div>
        <InterestBadge
          tier={interestingness.tier}
          score={interestingness.total_score}
        />
      </div>

      {/* Individual Checks */}
      <div className="space-y-3">
        {interestingness.checks.map((check) => {
          const meta = checkLabels[check.check_id] || {
            label: check.check_id,
            description: "",
          };

          return (
            <div
              key={check.check_id}
              className="rounded-lg border p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-sm">{meta.label}</h5>
                  <p className="text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
                <ScorePill score={check.score} />
              </div>
              <p className="text-sm text-muted-foreground">{check.answer}</p>
              {check.evidence_pointers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {check.evidence_pointers.map((ptr, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {ptr}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BusinessTab({ analysis }: { analysis: PaperAnalysis }) {
  const { businessPrimitives, keyNumbers, readinessLevel, readinessJustification } = analysis;

  return (
    <div className="space-y-6">
      {/* Business Primitives */}
      <div>
        <h4 className="mb-2 text-sm font-medium">Business Primitives Affected</h4>
        {businessPrimitives.selected.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              {businessPrimitives.selected.map((p) => (
                <BusinessPrimitiveBadge key={p} primitive={p} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {businessPrimitives.justification}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No clear business primitives identified.
          </p>
        )}
      </div>

      {/* Key Numbers */}
      {keyNumbers.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Key Numbers</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {keyNumbers.map((num, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-start gap-2">
                  {num.direction === "up" ? (
                    <ArrowUpRight className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-blue-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-lg">{num.value}</div>
                    <div className="text-sm font-medium truncate">
                      {num.metric_name}
                    </div>
                    {num.baseline && (
                      <div className="text-xs text-muted-foreground">
                        vs. {num.baseline}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {num.conditions}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Readiness */}
      <div>
        <h4 className="mb-2 text-sm font-medium">Deployment Readiness</h4>
        <div className="flex items-center gap-2 mb-2">
          <ReadinessBadge level={readinessLevel} />
        </div>
        {readinessJustification && (
          <p className="text-sm text-muted-foreground">
            {readinessJustification}
          </p>
        )}
      </div>
    </div>
  );
}

function RisksTab({ analysis }: { analysis: PaperAnalysis }) {
  const { constraints, failureModes, whatIsMissing } = analysis;

  return (
    <div className="space-y-6">
      {/* Constraints */}
      {constraints.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Constraints
          </h4>
          <div className="space-y-2">
            {constraints.map((c, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="font-medium text-sm">{c.constraint}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {c.why_it_matters}
                </p>
                {c.evidence_pointer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-2 inline-block">
                    {c.evidence_pointer}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failure Modes */}
      {failureModes.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            Failure Modes
          </h4>
          <div className="space-y-2">
            {failureModes.map((f, i) => (
              <div key={i} className="rounded-lg border border-red-200 dark:border-red-900/30 p-3">
                <p className="font-medium text-sm">{f.failure_mode}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {f.why_it_matters}
                </p>
                {f.evidence_pointer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-2 inline-block">
                    {f.evidence_pointer}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What's Missing */}
      {whatIsMissing && whatIsMissing.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            What&apos;s Missing
          </h4>
          <ul className="space-y-1">
            {whatIsMissing.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty State */}
      {constraints.length === 0 && failureModes.length === 0 && (!whatIsMissing || whatIsMissing.length === 0) && (
        <p className="text-sm text-muted-foreground">
          No constraints, failure modes, or gaps identified in the analysis.
        </p>
      )}
    </div>
  );
}

function UseCasesTab({ analysis }: { analysis: PaperAnalysis }) {
  const { useCaseMappings } = analysis;

  if (useCaseMappings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No use cases mapped for this paper.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {useCaseMappings.map((uc, i) => (
        <div key={i} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground shrink-0" />
              <h5 className="font-medium text-sm">{uc.name}</h5>
            </div>
            <FitConfidenceBadge fit={uc.fitConfidence} />
          </div>
          {uc.definition && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              {uc.definition}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2 ml-6">
            {uc.because}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function ScorePill({ score }: { score: number }) {
  const colors = {
    0: "bg-gray-500/10 text-gray-500",
    1: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    2: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium min-w-[24px]",
        colors[score as 0 | 1 | 2] || colors[0]
      )}
    >
      {score}
    </span>
  );
}
