"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminToken } from "@/lib/admin/use-admin-fetch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Brain,
  Zap,
  FileText,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Power,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiToggleResponse {
  enabled: boolean;
  runtimeEnabled: boolean;
  source: "env" | "redis";
  updatedAt: string | null;
  status: "enabled" | "disabled" | "not_configured";
  message: string;
  model: string;
  hasApiKey: boolean;
}

interface TriggerStatsResponse {
  papersWithoutSummaries: number;
  papersWithoutAnalysis: number;
  totalNeedingAI: number;
}

interface TriggerAiResponse {
  message: string;
  summaries: { queued: number; estimatedMinutes: number };
  analyses: { queued: number; estimatedMinutes: number };
  totalEstimatedMinutes: number;
}

interface QueueSummariesResponse {
  queued: number;
  totalWithoutSummaries: number;
  estimatedMinutes: number;
}

interface QueueAnalysesResponse {
  queued: number;
  totalWithoutAnalyses: number;
  estimatedMinutes: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminAiPage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  // ---- State for trigger results ----
  const [triggerBothResult, setTriggerBothResult] =
    useState<TriggerAiResponse | null>(null);
  const [summariesResult, setSummariesResult] =
    useState<QueueSummariesResponse | null>(null);
  const [analysesResult, setAnalysesResult] =
    useState<QueueAnalysesResponse | null>(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ---- Queries ----

  const toggleQuery = useQuery<AiToggleResponse>({
    queryKey: ["admin", "ai-toggle"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai-toggle", { headers });
      if (!res.ok) throw new Error(`Failed to fetch AI toggle (${res.status})`);
      return res.json();
    },
    refetchInterval: 10_000,
    enabled: !!token,
  });

  const statsQuery = useQuery<TriggerStatsResponse>({
    queryKey: ["admin", "trigger-ai-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/trigger-ai", { headers });
      if (!res.ok) throw new Error(`Failed to fetch stats (${res.status})`);
      return res.json();
    },
    refetchInterval: 10_000,
    enabled: !!token,
  });

  // ---- Mutations ----

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/admin/ai-toggle", {
        method: "POST",
        headers,
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(`Toggle failed (${res.status})`);
      return res.json() as Promise<AiToggleResponse>;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "ai-toggle"] });
      const prev = queryClient.getQueryData<AiToggleResponse>([
        "admin",
        "ai-toggle",
      ]);
      if (prev) {
        queryClient.setQueryData<AiToggleResponse>(["admin", "ai-toggle"], {
          ...prev,
          enabled,
          runtimeEnabled: enabled,
          status: enabled ? "enabled" : "disabled",
        });
      }
      return { prev };
    },
    onError: (_err, _enabled, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["admin", "ai-toggle"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-toggle"] });
    },
  });

  const triggerBothMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/trigger-ai", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      if (res.status === 503) {
        const data = await res.json();
        throw new Error(data.error ?? "AI processing is disabled");
      }
      if (!res.ok) throw new Error(`Trigger failed (${res.status})`);
      return res.json() as Promise<TriggerAiResponse>;
    },
    onSuccess: (data) => {
      setTriggerBothResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "trigger-ai-stats"] });
    },
  });

  const queueSummariesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/queue-summaries", {
        method: "POST",
        headers,
        body: JSON.stringify({ limit: 100 }),
      });
      if (res.status === 503) {
        const data = await res.json();
        throw new Error(data.error ?? "AI processing is disabled");
      }
      if (!res.ok) throw new Error(`Queue summaries failed (${res.status})`);
      return res.json() as Promise<QueueSummariesResponse>;
    },
    onSuccess: (data) => {
      setSummariesResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "trigger-ai-stats"] });
    },
  });

  const queueAnalysesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/queue-analyses", {
        method: "POST",
        headers,
        body: JSON.stringify({ limit: 50 }),
      });
      if (res.status === 503) {
        const data = await res.json();
        throw new Error(data.error ?? "AI processing is disabled");
      }
      if (!res.ok) throw new Error(`Queue analyses failed (${res.status})`);
      return res.json() as Promise<QueueAnalysesResponse>;
    },
    onSuccess: (data) => {
      setAnalysesResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "trigger-ai-stats"] });
    },
  });

  // ---- Derived values ----

  const toggle = toggleQuery.data;
  const stats = statsQuery.data;

  const statusBadgeVariant = (
    status: string | undefined,
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "enabled") return "default";
    if (status === "not_configured") return "outline";
    return "secondary";
  };

  const statusLabel = (status: string | undefined): string => {
    if (status === "enabled") return "Enabled";
    if (status === "not_configured") return "Not configured";
    return "Disabled";
  };

  // Stats-derived progress
  const totalPapers = stats
    ? Math.max(stats.totalNeedingAI, stats.papersWithoutSummaries, stats.papersWithoutAnalysis)
    : 0;
  const processedSummaries = stats
    ? totalPapers - stats.papersWithoutSummaries
    : 0;
  const processedAnalyses = stats
    ? totalPapers - stats.papersWithoutAnalysis
    : 0;
  const summaryPct = totalPapers > 0 ? (processedSummaries / totalPapers) * 100 : 0;
  const analysisPct = totalPapers > 0 ? (processedAnalyses / totalPapers) * 100 : 0;

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="size-6" />
          AI Processing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage AI processing settings and trigger batch jobs.
        </p>
      </div>

      <Separator />

      {/* AI Toggle Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="size-4" />
            AI Processing Toggle
          </CardTitle>
          <CardDescription>
            Enable or disable AI-powered paper processing across the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {toggleQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : toggleQuery.isError ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 flex-shrink-0" />
              Failed to load AI toggle status. Check your connection.
            </div>
          ) : toggle ? (
            <div className="space-y-4">
              {/* Toggle row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={toggle.runtimeEnabled}
                    onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                    disabled={toggleMutation.isPending}
                    aria-label="Toggle AI processing"
                  />
                  <span className="text-sm font-medium">
                    {toggle.runtimeEnabled
                      ? "AI processing is enabled"
                      : "AI processing is disabled"}
                  </span>
                </div>
                <Badge
                  variant={statusBadgeVariant(toggle.status)}
                  className={cn(
                    toggle.status === "enabled" &&
                      "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
                    toggle.status === "not_configured" &&
                      "bg-amber-500/15 text-amber-600 border-amber-500/20",
                    toggle.status === "disabled" &&
                      "bg-red-500/10 text-red-500 border-red-500/20",
                  )}
                >
                  {statusLabel(toggle.status)}
                </Badge>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <span className="font-medium text-foreground">Source:</span>{" "}
                  {toggle.source === "redis"
                    ? "Set via admin panel"
                    : "Set via environment variable"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Model:</span>{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {toggle.model}
                  </code>
                </div>
                {toggle.updatedAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="size-3" />
                    <span className="font-medium text-foreground">
                      Last changed:
                    </span>{" "}
                    {relativeTime(toggle.updatedAt)}
                  </div>
                )}
              </div>

              {!toggle.hasApiKey && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  No API key configured. AI processing will not function.
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Processing Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            Processing Stats
          </CardTitle>
          <CardDescription>
            Current progress of AI-powered paper processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : statsQuery.isError ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 flex-shrink-0" />
              Failed to load processing stats.
            </div>
          ) : stats ? (
            <div className="space-y-5">
              {/* Summaries progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Summaries</span>
                  <span className="text-muted-foreground">
                    {formatNumber(stats.papersWithoutSummaries)} remaining of{" "}
                    {formatNumber(totalPapers)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(summaryPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(processedSummaries)} papers have summaries (
                  {summaryPct.toFixed(1)}%)
                </p>
              </div>

              {/* Analyses progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Analyses</span>
                  <span className="text-muted-foreground">
                    {formatNumber(stats.papersWithoutAnalysis)} remaining of{" "}
                    {formatNumber(totalPapers)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(analysisPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(processedAnalyses)} papers have analyses (
                  {analysisPct.toFixed(1)}%)
                </p>
              </div>

              <Separator />

              {/* Total needing AI */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total papers needing AI</span>
                <Badge variant="outline">
                  {formatNumber(stats.totalNeedingAI)}
                </Badge>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Trigger Panel */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Trigger Processing</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Trigger Both */}
          <TriggerCard
            icon={<Zap className="size-4" />}
            title="Trigger Both"
            description="Queue summaries and analyses together in a single batch."
            isPending={triggerBothMutation.isPending}
            error={triggerBothMutation.error?.message ?? null}
            onTrigger={() => {
              setTriggerBothResult(null);
              triggerBothMutation.mutate();
            }}
            result={
              triggerBothResult ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="size-3.5" />
                    <span className="font-medium">Queued</span>
                  </div>
                  <p className="text-muted-foreground">
                    Summaries: {triggerBothResult.summaries.queued} jobs (
                    ~{triggerBothResult.summaries.estimatedMinutes}m)
                  </p>
                  <p className="text-muted-foreground">
                    Analyses: {triggerBothResult.analyses.queued} jobs (
                    ~{triggerBothResult.analyses.estimatedMinutes}m)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total est. ~{triggerBothResult.totalEstimatedMinutes} min
                  </p>
                </div>
              ) : null
            }
          />

          {/* Queue Summaries */}
          <TriggerCard
            icon={<FileText className="size-4" />}
            title="Queue Summaries"
            description="Queue up to 100 papers for AI summary generation."
            isPending={queueSummariesMutation.isPending}
            error={queueSummariesMutation.error?.message ?? null}
            onTrigger={() => {
              setSummariesResult(null);
              queueSummariesMutation.mutate();
            }}
            result={
              summariesResult ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="size-3.5" />
                    <span className="font-medium">
                      {summariesResult.queued} queued
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {formatNumber(summariesResult.totalWithoutSummaries)} still
                    without summaries
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Est. ~{summariesResult.estimatedMinutes} min
                  </p>
                </div>
              ) : null
            }
          />

          {/* Queue Analyses */}
          <TriggerCard
            icon={<BarChart3 className="size-4" />}
            title="Queue Analyses"
            description="Queue up to 50 papers for AI analysis generation."
            isPending={queueAnalysesMutation.isPending}
            error={queueAnalysesMutation.error?.message ?? null}
            onTrigger={() => {
              setAnalysesResult(null);
              queueAnalysesMutation.mutate();
            }}
            result={
              analysesResult ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="size-3.5" />
                    <span className="font-medium">
                      {analysesResult.queued} queued
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {formatNumber(analysesResult.totalWithoutAnalyses)} still
                    without analyses
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Est. ~{analysesResult.estimatedMinutes} min
                  </p>
                </div>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trigger Card sub-component
// ---------------------------------------------------------------------------

function TriggerCard({
  icon,
  title,
  description,
  isPending,
  error,
  result,
  onTrigger,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  isPending: boolean;
  error: string | null;
  result: React.ReactNode;
  onTrigger: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          onClick={onTrigger}
          disabled={isPending}
          aria-label={`Trigger ${title}`}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Trigger"
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {result}
      </CardContent>
    </Card>
  );
}
