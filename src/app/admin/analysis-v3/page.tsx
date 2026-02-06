"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminToken, adminFetch } from "@/lib/admin/use-admin-fetch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  DollarSign,
  Play,
  Pause,
  Square,
  FlaskConical,
  Calculator,
  Activity,
  History,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Type definitions                                                    */
/* ------------------------------------------------------------------ */

interface StatusResponse {
  coverage: { analyzed: number; total: number; percentage: number };
  budget: {
    dailyCents: number;
    monthlyCents: number;
    todaySpentCents: number;
    monthSpentCents: number;
  };
  autoAnalysis: {
    enabled: boolean;
    paused: boolean;
    pauseReason: string | null;
  };
  currentBatch: {
    id: string;
    batchSize: number;
    completed: number;
    failed: number;
    status: string;
    model: string;
    startedAt: string | null;
  } | null;
  model: string;
}

interface EstimateResponse {
  averages: {
    costCents: number;
    costDollars: string;
    tokens: number;
    timeMs: number;
    timeSeconds: string;
    ratePerMin: number;
    totalCompleted: number;
  };
  remaining: number;
  projections: {
    papers: number;
    estCostCents: number;
    estCostDollars: string;
    estTimeMinutes: number;
    estTimeFormatted: string;
    exceedsDailyBudget: boolean;
    exceedsMonthlyBudget: boolean;
  }[];
  sufficientData: boolean;
}

interface SpendingResponse {
  todayCents: number;
  weekCents: number;
  monthCents: number;
  allTimeCents: number;
}

interface BatchInfo {
  id: string;
  batchSize: number;
  completed: number;
  failed: number;
  totalCostCents: number;
  avgCostCents: number;
  model: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface ActivityItem {
  id: string;
  batchId: string | null;
  paperId: string | null;
  paperTitle: string;
  status: string;
  costCents: number | null;
  costDollars: string | null;
  processingTimeMs: number | null;
  processingTimeSeconds: string | null;
  errorMessage: string | null;
  completedAt: string | null;
}

interface TestResult {
  paper: { id: string; externalId: string; title: string };
  analysis: Record<string, unknown>;
  analysisStatus: string;
  validationErrors: string[];
  cost: {
    tokensUsed: number;
    costCents: number;
    costDollars: string;
    processingTimeMs: number;
    processingTimeSeconds: string;
  };
  model: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function cents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

function pct(used: number, budget: number): number {
  return budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
}

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

/* ------------------------------------------------------------------ */
/*  Page Component                                                      */
/* ------------------------------------------------------------------ */

export default function AnalysisV3Page() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  // ---- State ----
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [batchSize, setBatchSize] = useState("10");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ---- Queries ----

  const statusQuery = useQuery<StatusResponse>({
    queryKey: ["admin", "analysis-v3", "status"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/analysis-v3/status", token!);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 5_000,
  });

  const estimateQuery = useQuery<EstimateResponse>({
    queryKey: ["admin", "analysis-v3", "estimate"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/analysis-v3/estimate", token!);
      if (!res.ok) throw new Error("Failed to fetch estimates");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const spendingQuery = useQuery<SpendingResponse>({
    queryKey: ["admin", "analysis-v3", "spending"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/analysis-v3/spending", token!);
      if (!res.ok) throw new Error("Failed to fetch spending");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const activityQuery = useQuery<{ activity: ActivityItem[] }>({
    queryKey: ["admin", "analysis-v3", "activity"],
    queryFn: async () => {
      const res = await adminFetch(
        "/api/admin/analysis-v3/activity?limit=20",
        token!
      );
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 3_000,
  });

  const historyQuery = useQuery<{ batches: BatchInfo[] }>({
    queryKey: ["admin", "analysis-v3", "history"],
    queryFn: async () => {
      const res = await adminFetch(
        "/api/admin/analysis-v3/history?limit=20",
        token!
      );
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10_000,
  });

  // ---- Mutations ----

  const testMutation = useMutation({
    mutationFn: async (input: string) => {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          input
        );
      const body = isUuid ? { paperId: input } : { externalId: input };
      const res = await fetch("/api/admin/analysis-v3/test", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Test failed (${res.status})`);
      }
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (data) => {
      setTestResult(data);
      queryClient.invalidateQueries({
        queryKey: ["admin", "analysis-v3", "spending"],
      });
    },
  });

  const batchMutation = useMutation({
    mutationFn: async (size: number) => {
      const res = await fetch("/api/admin/analysis-v3/batch", {
        method: "POST",
        headers,
        body: JSON.stringify({ size }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Batch start failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "analysis-v3"],
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/analysis-v3/pause", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Pause failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "analysis-v3", "status"],
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/analysis-v3/resume", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Resume failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "analysis-v3", "status"],
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/analysis-v3/cancel", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Cancel failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "analysis-v3"],
      });
    },
  });

  const autoMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/admin/analysis-v3/auto", {
        method: "POST",
        headers,
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Auto toggle failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "analysis-v3", "status"],
      });
    },
  });

  const retryBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await fetch("/api/admin/analysis-v3/retry", {
        method: "POST",
        headers,
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) throw new Error("Batch retry failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "analysis-v3"],
      });
    },
  });

  // ---- Derived ----

  const status = statusQuery.data;
  const estimate = estimateQuery.data;
  const spending = spendingQuery.data;
  const activity = activityQuery.data?.activity ?? [];
  const batches = historyQuery.data?.batches ?? [];

  const hasBatch = status?.currentBatch != null;
  const batchProgress = hasBatch
    ? Math.round(
        ((status!.currentBatch!.completed + status!.currentBatch!.failed) /
          Math.max(status!.currentBatch!.batchSize, 1)) *
          100
      )
    : 0;

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="size-6" />
            Analysis v3
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage v3 paper analysis pipeline, budget, and batch processing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({
              queryKey: ["admin", "analysis-v3"],
            });
          }}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <Separator />

      {/* ============================================================ */}
      {/*  STATUS & BUDGET OVERVIEW                                     */}
      {/* ============================================================ */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Coverage */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="size-4" />
              v3 Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusQuery.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : status ? (
              <>
                <p className="text-2xl font-bold">
                  {status.coverage.percentage}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.coverage.analyzed.toLocaleString()} /{" "}
                  {status.coverage.total.toLocaleString()} papers
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold">--</p>
            )}
          </CardContent>
        </Card>

        {/* Today Spend */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="size-4" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : status ? (
              <>
                <p className="text-2xl font-bold">
                  {cents(status.budget.todaySpentCents)}
                </p>
                <div className="mt-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct(
                          status.budget.todaySpentCents,
                          status.budget.dailyCents
                        ) > 80
                          ? "bg-red-500"
                          : "bg-emerald-500"
                      )}
                      style={{
                        width: `${pct(status.budget.todaySpentCents, status.budget.dailyCents)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    of {cents(status.budget.dailyCents)} daily
                  </p>
                </div>
              </>
            ) : (
              <p className="text-2xl font-bold">--</p>
            )}
          </CardContent>
        </Card>

        {/* Month Spend */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="size-4" />
              Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : status ? (
              <>
                <p className="text-2xl font-bold">
                  {cents(status.budget.monthSpentCents)}
                </p>
                <div className="mt-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct(
                          status.budget.monthSpentCents,
                          status.budget.monthlyCents
                        ) > 80
                          ? "bg-red-500"
                          : "bg-blue-500"
                      )}
                      style={{
                        width: `${pct(status.budget.monthSpentCents, status.budget.monthlyCents)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    of {cents(status.budget.monthlyCents)} monthly
                  </p>
                </div>
              </>
            ) : (
              <p className="text-2xl font-bold">--</p>
            )}
          </CardContent>
        </Card>

        {/* Model */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BrainCircuit className="size-4" />
              Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusQuery.isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : status ? (
              <>
                <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                  {status.model.split("/").pop()}
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  {status.model}
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold">--</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/*  BATCH CONTROLS + AUTO ANALYSIS                               */}
      {/* ============================================================ */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Batch Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4" />
              Batch Processing
            </CardTitle>
            <CardDescription>
              Start, pause, resume, or cancel batch analysis runs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasBatch ? (
              <>
                {/* Active batch info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Batch{" "}
                      <Badge
                        variant={
                          status!.currentBatch!.status === "paused"
                            ? "secondary"
                            : "default"
                        }
                      >
                        {status!.currentBatch!.status}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">
                      {status!.currentBatch!.completed +
                        status!.currentBatch!.failed}{" "}
                      / {status!.currentBatch!.batchSize}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${batchProgress}%` }}
                    />
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>
                      {status!.currentBatch!.completed} completed
                    </span>
                    {status!.currentBatch!.failed > 0 && (
                      <span className="text-destructive">
                        {status!.currentBatch!.failed} failed
                      </span>
                    )}
                  </div>
                </div>

                {/* Batch actions */}
                <div className="flex gap-2">
                  {status!.currentBatch!.status === "running" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pauseMutation.mutate()}
                      disabled={pauseMutation.isPending}
                    >
                      {pauseMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Pause className="size-4" />
                      )}
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resumeMutation.mutate()}
                      disabled={resumeMutation.isPending}
                    >
                      {resumeMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Square className="size-4" />
                    )}
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Start new batch */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label
                      htmlFor="batch-size"
                      className="text-sm font-medium"
                    >
                      Papers to analyze
                    </label>
                    <Input
                      id="batch-size"
                      type="number"
                      min={1}
                      max={10000}
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                  <Button
                    onClick={() =>
                      batchMutation.mutate(parseInt(batchSize) || 10)
                    }
                    disabled={batchMutation.isPending}
                  >
                    {batchMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Start Batch
                  </Button>
                </div>

                {batchMutation.isError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="size-4 flex-shrink-0" />
                    {batchMutation.error?.message}
                  </div>
                )}

                {batchMutation.isSuccess && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                    <CheckCircle2 className="size-4 flex-shrink-0" />
                    Batch started
                  </div>
                )}

                {status && (
                  <p className="text-xs text-muted-foreground">
                    {(
                      status.coverage.total - status.coverage.analyzed
                    ).toLocaleString()}{" "}
                    papers remaining without v3 analysis
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Auto-Analysis Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              Auto-Analysis
            </CardTitle>
            <CardDescription>
              Automatically analyze new papers as they are ingested.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusQuery.isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : status ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={status.autoAnalysis.enabled}
                      onCheckedChange={(checked) =>
                        autoMutation.mutate(checked)
                      }
                      disabled={autoMutation.isPending}
                    />
                    <span className="text-sm font-medium">
                      {status.autoAnalysis.enabled
                        ? "Auto-analysis enabled"
                        : "Auto-analysis disabled"}
                    </span>
                  </div>
                  <Badge
                    variant={
                      status.autoAnalysis.enabled ? "default" : "secondary"
                    }
                    className={cn(
                      status.autoAnalysis.enabled &&
                        "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"
                    )}
                  >
                    {status.autoAnalysis.enabled ? "On" : "Off"}
                  </Badge>
                </div>

                {status.autoAnalysis.paused && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
                    <Pause className="size-4 flex-shrink-0" />
                    Paused
                    {status.autoAnalysis.pauseReason &&
                      `: ${status.autoAnalysis.pauseReason}`}
                  </div>
                )}

                {/* Spending overview */}
                {spending && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">This week</span>
                      <p className="font-medium">
                        {cents(spending.weekCents)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">All time</span>
                      <p className="font-medium">
                        {cents(spending.allTimeCents)}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/*  TEST LAB                                                     */}
      {/* ============================================================ */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4" />
            Test Lab
          </CardTitle>
          <CardDescription>
            Run a single synchronous analysis to test the pipeline. Enter a
            paper UUID or arXiv ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="test-input" className="text-sm font-medium">
                Paper ID or arXiv ID
              </label>
              <Input
                id="test-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="e.g. 2401.12345 or UUID"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && testInput.trim()) {
                    testMutation.mutate(testInput.trim());
                  }
                }}
              />
            </div>
            <Button
              onClick={() => testMutation.mutate(testInput.trim())}
              disabled={testMutation.isPending || !testInput.trim()}
            >
              {testMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FlaskConical className="size-4" />
              )}
              Analyze
            </Button>
          </div>

          {testMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 flex-shrink-0" />
              {testMutation.error?.message}
            </div>
          )}

          {testResult && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{testResult.paper.title}</h4>
                <Badge
                  variant={
                    testResult.analysisStatus === "complete"
                      ? "default"
                      : "secondary"
                  }
                  className={cn(
                    testResult.analysisStatus === "complete" &&
                      "bg-emerald-500/15 text-emerald-600"
                  )}
                >
                  {testResult.analysisStatus}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>
                  Tokens: {testResult.cost.tokensUsed.toLocaleString()}
                </span>
                <span>Cost: {testResult.cost.costDollars}</span>
                <span>Time: {testResult.cost.processingTimeSeconds}s</span>
                <span>Model: {testResult.model}</span>
              </div>

              {testResult.validationErrors.length > 0 && (
                <div className="text-xs text-amber-600">
                  Validation issues:{" "}
                  {testResult.validationErrors.join(", ")}
                </div>
              )}

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Raw analysis output
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(testResult.analysis, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  COST ESTIMATOR                                               */}
      {/* ============================================================ */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4" />
            Cost Estimator
          </CardTitle>
          <CardDescription>
            Projected cost and time based on{" "}
            {estimate?.averages.totalCompleted ?? 0} completed analyses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estimateQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : estimate ? (
            <div className="space-y-4">
              {/* Averages */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Avg cost</span>
                  <p className="font-medium">{estimate.averages.costDollars}/paper</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg tokens</span>
                  <p className="font-medium">
                    {estimate.averages.tokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg time</span>
                  <p className="font-medium">
                    {estimate.averages.timeSeconds}s
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rate</span>
                  <p className="font-medium">
                    {estimate.averages.ratePerMin}/min
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Remaining</span>
                  <p className="font-medium">
                    {estimate.remaining.toLocaleString()} papers
                  </p>
                </div>
              </div>

              {!estimate.sufficientData && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  Fewer than 5 analyses completed. Estimates may be inaccurate.
                </div>
              )}

              {/* Projections table */}
              {estimate.projections.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Papers</TableHead>
                      <TableHead>Est. Cost</TableHead>
                      <TableHead>Est. Time</TableHead>
                      <TableHead>Budget</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimate.projections.map((p) => (
                      <TableRow key={p.papers}>
                        <TableCell className="font-medium">
                          {p.papers.toLocaleString()}
                        </TableCell>
                        <TableCell>{p.estCostDollars}</TableCell>
                        <TableCell>{p.estTimeFormatted}</TableCell>
                        <TableCell>
                          {p.exceedsMonthlyBudget ? (
                            <Badge variant="destructive" className="text-xs">
                              Over monthly
                            </Badge>
                          ) : p.exceedsDailyBudget ? (
                            <Badge variant="secondary" className="text-xs">
                              Over daily
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            >
                              Within budget
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Unable to load estimates.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  LIVE MONITOR / HISTORY TABS                                  */}
      {/* ============================================================ */}

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="size-3.5" />
            Live Activity
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="size-3.5" />
            Batch History
          </TabsTrigger>
        </TabsList>

        {/* Activity tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="size-4" />
                Recent Activity
                <span className="text-xs font-normal text-muted-foreground">
                  (auto-refreshes every 3s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : activity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity yet. Start a batch or run a test analysis.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paper</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell
                          className="max-w-[200px] truncate text-xs"
                          title={item.paperTitle}
                        >
                          {item.paperTitle}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "completed"
                                ? "default"
                                : "destructive"
                            }
                            className={cn(
                              "text-xs",
                              item.status === "completed" &&
                                "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"
                            )}
                          >
                            {item.status === "completed" ? (
                              <CheckCircle2 className="size-3" />
                            ) : (
                              <AlertCircle className="size-3" />
                            )}
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.costDollars ?? "--"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.processingTimeSeconds
                            ? `${item.processingTimeSeconds}s`
                            : "--"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.completedAt
                            ? relativeTime(item.completedAt)
                            : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="size-4" />
                Batch History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : batches.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No batches have been run yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <Badge
                            variant={
                              batch.status === "completed"
                                ? "default"
                                : batch.status === "running"
                                  ? "secondary"
                                  : batch.status === "cancelled"
                                    ? "destructive"
                                    : "outline"
                            }
                            className={cn(
                              "text-xs",
                              batch.status === "completed" &&
                                "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"
                            )}
                          >
                            {batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {batch.batchSize}
                        </TableCell>
                        <TableCell className="text-xs">
                          {batch.completed}
                        </TableCell>
                        <TableCell className="text-xs">
                          {batch.failed > 0 ? (
                            <span className="text-destructive">
                              {batch.failed}
                            </span>
                          ) : (
                            batch.failed
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {cents(batch.totalCostCents)}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {batch.model.split("/").pop()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {batch.startedAt
                            ? relativeTime(batch.startedAt)
                            : "--"}
                        </TableCell>
                        <TableCell>
                          {batch.failed > 0 &&
                            batch.status !== "running" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  retryBatchMutation.mutate(batch.id)
                                }
                                disabled={retryBatchMutation.isPending}
                              >
                                <RotateCcw className="size-3.5" />
                                Retry failed
                              </Button>
                            )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
