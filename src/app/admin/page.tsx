"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminToken, adminFetch } from "@/lib/admin/use-admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  FileText,
  CalendarPlus,
  HeartPulse,
  BrainCircuit,
  Power,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Type definitions for API responses                                 */
/* ------------------------------------------------------------------ */

interface StatusResponse {
  totalPapers: number;
  lastFetch: string;
  nextFetch: string;
  categoryCounts: Record<string, number>;
}

interface PaperStatsResponse {
  health: "healthy" | "warning" | "critical";
  totalPapers: number;
  todayIngested: number;
  avgPapersPerDay: number;
}

interface AiToggleResponse {
  enabled: boolean;
  runtimeEnabled: boolean;
  source: string;
  updatedAt: string | null;
  status: string;
  message: string;
  model: string;
  hasApiKey: boolean;
}

interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface V3StatusResponse {
  coverage: { analyzed: number; total: number; percentage: number };
  budget: {
    dailyCents: number;
    monthlyCents: number;
    todaySpentCents: number;
    monthSpentCents: number;
  };
  autoAnalysis: { enabled: boolean; paused: boolean; pauseReason: string | null };
  currentBatch: {
    id: string;
    batchSize: number;
    completed: number;
    failed: number;
    status: string;
  } | null;
  model: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function healthVariant(health: string) {
  switch (health) {
    case "healthy":
      return "default" as const;
    case "warning":
      return "secondary" as const;
    case "critical":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function cents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/*  Dashboard page                                                     */
/* ------------------------------------------------------------------ */

export default function AdminDashboardPage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const refetchInterval = 30_000;

  // Fetch public status (no auth required)
  const statusQuery = useQuery<StatusResponse>({
    queryKey: ["admin", "status"],
    queryFn: async () => {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    refetchInterval,
  });

  // Fetch paper stats
  const paperStatsQuery = useQuery<PaperStatsResponse>({
    queryKey: ["admin", "paper-stats"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/paper-stats", token!);
      if (!res.ok) throw new Error("Failed to fetch paper stats");
      return res.json();
    },
    enabled: !!token,
    refetchInterval,
  });

  // Fetch AI toggle state
  const aiToggleQuery = useQuery<AiToggleResponse>({
    queryKey: ["admin", "ai-toggle"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/ai-toggle", token!);
      if (!res.ok) throw new Error("Failed to fetch AI toggle");
      return res.json();
    },
    enabled: !!token,
    refetchInterval,
  });

  // Fetch v3 analysis status
  const v3StatusQuery = useQuery<V3StatusResponse>({
    queryKey: ["admin", "analysis-v3", "status"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/analysis-v3/status", token!);
      if (!res.ok) throw new Error("Failed to fetch v3 status");
      return res.json();
    },
    enabled: !!token,
    refetchInterval,
  });

  // Fetch queue data
  const queuesQuery = useQuery<QueueInfo[]>({
    queryKey: ["admin", "queues"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/queues", token!);
      if (!res.ok) throw new Error("Failed to fetch queues");
      const data = await res.json();
      return data.queues ?? data;
    },
    enabled: !!token,
    refetchInterval,
  });

  // AI toggle mutation with optimistic update
  const aiToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await adminFetch("/api/admin/ai-toggle", token!, {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle AI");
      return res.json();
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "ai-toggle"] });
      const previous = queryClient.getQueryData<AiToggleResponse>([
        "admin",
        "ai-toggle",
      ]);
      queryClient.setQueryData<AiToggleResponse>(
        ["admin", "ai-toggle"],
        (old) =>
          old
            ? { ...old, enabled, runtimeEnabled: enabled, status: enabled ? "enabled" : "disabled" }
            : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin", "ai-toggle"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-toggle"] });
    },
  });

  const v3 = v3StatusQuery.data;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total papers */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="size-4" />
              Total Papers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusQuery.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">
                {statusQuery.data?.totalPapers?.toLocaleString() ?? "--"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Today ingested */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarPlus className="size-4" />
              Today Ingested
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paperStatsQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">
                {paperStatsQuery.data?.todayIngested?.toLocaleString() ?? "--"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Health status */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <HeartPulse className="size-4" />
              Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paperStatsQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : paperStatsQuery.data ? (
              <Badge
                variant={healthVariant(paperStatsQuery.data.health)}
                className="mt-1 text-sm"
              >
                {paperStatsQuery.data.health}
              </Badge>
            ) : (
              <p className="text-2xl font-bold">--</p>
            )}
          </CardContent>
        </Card>

        {/* v3 Coverage */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="size-4" />
              v3 Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {v3StatusQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : v3 ? (
              <>
                <p className="text-2xl font-bold">{v3.coverage.percentage}%</p>
                <p className="text-xs text-muted-foreground">
                  {v3.coverage.analyzed.toLocaleString()} /{" "}
                  {v3.coverage.total.toLocaleString()}
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold">--</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* v3 Analysis Status + AI Toggle row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* v3 Analysis Status card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="size-5" />
              Analysis v3
            </CardTitle>
          </CardHeader>
          <CardContent>
            {v3StatusQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-32" />
              </div>
            ) : v3 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Auto-analysis</span>
                  <Badge
                    variant={v3.autoAnalysis.enabled ? "default" : "secondary"}
                    className={cn(
                      v3.autoAnalysis.enabled &&
                        "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"
                    )}
                  >
                    {v3.autoAnalysis.enabled ? "On" : "Off"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Today spent</span>
                  <span className="font-medium">
                    {cents(v3.budget.todaySpentCents)} / {cents(v3.budget.dailyCents)}
                  </span>
                </div>
                {v3.currentBatch && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active batch</span>
                    <Badge variant="secondary">
                      {v3.currentBatch.completed + v3.currentBatch.failed} / {v3.currentBatch.batchSize}
                    </Badge>
                  </div>
                )}
                <Link
                  href="/admin/analysis-v3"
                  className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
                >
                  Manage Analysis v3
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load v3 status.
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Processing Toggle card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="size-5" />
              AI Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiToggleQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-32" />
              </div>
            ) : aiToggleQuery.data ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      Status:{" "}
                      <Badge
                        variant={
                          aiToggleQuery.data.runtimeEnabled
                            ? "default"
                            : "secondary"
                        }
                      >
                        {aiToggleQuery.data.runtimeEnabled ? "Active" : "Stopped"}
                      </Badge>
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Model: {aiToggleQuery.data.model}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label
                    htmlFor="ai-toggle"
                    className="text-sm font-medium select-none"
                  >
                    {aiToggleQuery.data.runtimeEnabled ? "Enabled" : "Disabled"}
                  </label>
                  <Switch
                    id="ai-toggle"
                    checked={aiToggleQuery.data.runtimeEnabled}
                    onCheckedChange={(checked) =>
                      aiToggleMutation.mutate(checked)
                    }
                    disabled={aiToggleMutation.isPending}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load AI status.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Queue summary */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Queues</h2>
        {queuesQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-1">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : queuesQuery.data && queuesQuery.data.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {queuesQuery.data.map((queue) => (
              <Card key={queue.name}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-medium">
                    {queue.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      Waiting: {queue.waiting}
                    </Badge>
                    <Badge variant="secondary">
                      Active: {queue.active}
                    </Badge>
                    <Badge
                      variant={queue.failed > 0 ? "destructive" : "outline"}
                    >
                      {queue.failed > 0 && (
                        <AlertTriangle className="size-3" />
                      )}
                      Failed: {queue.failed}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No queues found.</p>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/analysis-v3"
            className={buttonVariants({ variant: "outline" })}
          >
            Analysis v3
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/admin/queues"
            className={buttonVariants({ variant: "outline" })}
          >
            View Queues
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/admin/ingestion"
            className={buttonVariants({ variant: "outline" })}
          >
            Ingestion
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
