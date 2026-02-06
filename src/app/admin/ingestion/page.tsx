"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAdminToken, adminFetch } from "@/lib/admin/use-admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  FileText,
  TrendingUp,
  CalendarPlus,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Type definitions                                                    */
/* ------------------------------------------------------------------ */

interface DateCount {
  date: string;
  count: number;
}

interface PaperStatsResponse {
  health: "healthy" | "warning" | "critical";
  totalPapers: number;
  todayIngested: number;
  avgPapersPerDay: number;
  expectedRange: [number, number];
  missingDates: string[];
  byFetchDate: DateCount[];
  byPublishDate: DateCount[];
}

interface BackfillResponse {
  message: string;
  queuedDates: string[];
  estimatedMinutes: number;
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

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isWeekend(dateString: string): boolean {
  const date = new Date(dateString + "T00:00:00");
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                      */
/* ------------------------------------------------------------------ */

export default function AdminIngestionPage() {
  const { token } = useAdminToken();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  /* ---- Queries ---- */

  const statsQuery = useQuery<PaperStatsResponse>({
    queryKey: ["admin", "paper-stats", "ingestion"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/paper-stats?days=30", token!);
      if (!res.ok) throw new Error("Failed to fetch paper stats");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 60_000,
  });

  /* ---- Mutations ---- */

  const backfillMutation = useMutation<BackfillResponse, Error, { startDate: string; endDate: string }>({
    mutationFn: async (params) => {
      const res = await adminFetch("/api/admin/backfill-arxiv", token!, {
        method: "POST",
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Backfill request failed");
      }
      return res.json();
    },
  });

  const gapBackfillMutation = useMutation<BackfillResponse, Error, { startDate: string; endDate: string }>({
    mutationFn: async (params) => {
      const res = await adminFetch("/api/admin/backfill-arxiv", token!, {
        method: "POST",
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Gap backfill request failed");
      }
      return res.json();
    },
  });

  /* ---- Derived data ---- */

  const stats = statsQuery.data;
  const missingDates = stats?.missingDates ?? [];
  const publishData = stats?.byPublishDate ?? [];
  const sortedPublishData = [...publishData].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  /* ---- Handlers ---- */

  function handleBackfillGaps() {
    if (missingDates.length === 0) return;

    const sorted = [...missingDates].sort();
    const firstDate = sorted[0];
    const lastDate = sorted[sorted.length - 1];

    gapBackfillMutation.mutate({ startDate: firstDate, endDate: lastDate });
  }

  function handleManualBackfill(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!startDate || !endDate) {
      setFormError("Both start and end dates are required.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setFormError("Start date must be before end date.");
      return;
    }

    const dayCount = getDaysBetween(startDate, endDate);
    if (dayCount > 60) {
      setFormError("Date range cannot exceed 60 days.");
      return;
    }

    backfillMutation.mutate({ startDate, endDate });
  }

  /* ---- Status badge for table rows ---- */

  function renderDayStatus(date: string, count: number) {
    if (isWeekend(date)) {
      return (
        <Badge variant="secondary" className="text-xs">
          Weekend
        </Badge>
      );
    }
    if (count >= 50) {
      return (
        <Badge className="bg-green-600 text-white hover:bg-green-600/90 text-xs">
          OK
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-xs">
        Gap
      </Badge>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-8">
      {/* Page header */}
      <h1 className="text-2xl font-bold tracking-tight">Ingestion Monitor</h1>

      {/* ---- Health Overview Card ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : statsQuery.isError ? (
            <p className="text-sm text-destructive">
              Failed to load stats. Please try again.
            </p>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Activity className="size-3.5" />
                  Status
                </p>
                <Badge variant={healthVariant(stats.health)} className="text-sm">
                  {stats.health}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FileText className="size-3.5" />
                  Total Papers
                </p>
                <p className="text-2xl font-bold">
                  {stats.totalPapers.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendingUp className="size-3.5" />
                  Avg / Day
                </p>
                <p className="text-2xl font-bold">
                  {stats.avgPapersPerDay.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarPlus className="size-3.5" />
                  Today
                </p>
                <p className="text-2xl font-bold">
                  {stats.todayIngested.toLocaleString()}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ---- Papers By Day Table ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Papers By Day (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : statsQuery.isError ? (
            <p className="text-sm text-destructive">
              Failed to load daily data.
            </p>
          ) : sortedPublishData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Papers Published</TableHead>
                  <TableHead className="text-right">Papers Fetched</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPublishData.map((entry) => {
                  const fetchEntry = stats?.byFetchDate?.find(
                    (f) => f.date === entry.date
                  );
                  return (
                    <TableRow key={entry.date}>
                      <TableCell className="font-medium">
                        {formatDate(entry.date)}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {fetchEntry ? fetchEntry.count.toLocaleString() : "--"}
                      </TableCell>
                      <TableCell>
                        {renderDayStatus(entry.date, entry.count)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No daily data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---- Gap Detection Card ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Gap Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          ) : missingDates.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="size-5" />
              <p className="text-sm font-medium">No gaps detected</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {missingDates.length} missing{" "}
                {missingDates.length === 1 ? "date" : "dates"} detected:
              </p>
              <div className="flex flex-wrap gap-2">
                {missingDates.map((date) => (
                  <Badge key={date} variant="destructive" className="text-xs">
                    {formatDate(date)}
                  </Badge>
                ))}
              </div>

              <Separator />

              <Button
                onClick={handleBackfillGaps}
                disabled={gapBackfillMutation.isPending}
              >
                {gapBackfillMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Backfill All Gaps
              </Button>

              {gapBackfillMutation.isSuccess && gapBackfillMutation.data && (
                <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">
                  <p className="font-medium">
                    {gapBackfillMutation.data.message}
                  </p>
                  <p className="text-muted-foreground">
                    Queued dates:{" "}
                    {gapBackfillMutation.data.queuedDates
                      .map(formatDate)
                      .join(", ")}
                  </p>
                  <p className="text-muted-foreground">
                    Estimated completion:{" "}
                    {gapBackfillMutation.data.estimatedMinutes} minutes
                  </p>
                </div>
              )}

              {gapBackfillMutation.isError && (
                <p className="text-sm text-destructive">
                  {gapBackfillMutation.error.message}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Manual Backfill Card ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Manual Backfill
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualBackfill} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="backfill-start"
                  className="text-sm font-medium"
                >
                  Start Date
                </label>
                <Input
                  id="backfill-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setFormError(null);
                  }}
                  aria-describedby={formError ? "backfill-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="backfill-end"
                  className="text-sm font-medium"
                >
                  End Date
                </label>
                <Input
                  id="backfill-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setFormError(null);
                  }}
                  aria-describedby={formError ? "backfill-error" : undefined}
                />
              </div>
            </div>

            {formError && (
              <p id="backfill-error" className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}

            <Button
              type="submit"
              disabled={backfillMutation.isPending}
            >
              {backfillMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Start Backfill
            </Button>

            {backfillMutation.isSuccess && backfillMutation.data && (
              <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">
                <p className="font-medium">
                  {backfillMutation.data.message}
                </p>
                <p className="text-muted-foreground">
                  Queued dates:{" "}
                  {backfillMutation.data.queuedDates
                    .map(formatDate)
                    .join(", ")}
                </p>
                <p className="text-muted-foreground">
                  Estimated completion:{" "}
                  {backfillMutation.data.estimatedMinutes} minutes
                </p>
              </div>
            )}

            {backfillMutation.isError && (
              <p className="text-sm text-destructive" role="alert">
                {backfillMutation.error.message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
