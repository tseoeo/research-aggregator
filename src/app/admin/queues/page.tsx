"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminToken, adminFetch } from "@/lib/admin/use-admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Layers,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Pause,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Type definitions                                                    */
/* ------------------------------------------------------------------ */

interface FailedJobInfo {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  data: Record<string, unknown>;
}

interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  failedJobs?: FailedJobInfo[];
}

/* ------------------------------------------------------------------ */
/*  Page component                                                      */
/* ------------------------------------------------------------------ */

export default function AdminQueuesPage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();
  const [expandedQueues, setExpandedQueues] = useState<Set<string>>(new Set());

  // Fetch queue data with failed job details
  const queuesQuery = useQuery<QueueInfo[]>({
    queryKey: ["admin", "queues-detail"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/queues?failed=true&limit=20", token!);
      if (!res.ok) throw new Error("Failed to fetch queues");
      const data = await res.json();
      return data.queues ?? data;
    },
    enabled: !!token,
    refetchInterval: 15_000,
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async ({ queue, jobId }: { queue: string; jobId: string }) => {
      const res = await adminFetch("/api/admin/queues/retry", token!, {
        method: "POST",
        body: JSON.stringify({ queue, jobId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Retry failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "queues-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "queues"] });
    },
  });

  const queues = queuesQuery.data ?? [];

  function toggleExpanded(name: string) {
    setExpandedQueues((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const totalFailed = queues.reduce((sum, q) => sum + q.failed, 0);
  const totalWaiting = queues.reduce((sum, q) => sum + q.waiting, 0);
  const totalActive = queues.reduce((sum, q) => sum + q.active, 0);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Queues</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queuesQuery.refetch()}
          disabled={queuesQuery.isFetching}
        >
          {queuesQuery.isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="text-sm">
          <Layers className="size-3.5" />
          Waiting: {totalWaiting}
        </Badge>
        <Badge variant="secondary" className="text-sm">
          Active: {totalActive}
        </Badge>
        {totalFailed > 0 && (
          <Badge variant="destructive" className="text-sm">
            <AlertTriangle className="size-3.5" />
            Failed: {totalFailed}
          </Badge>
        )}
      </div>

      {/* Queue cards */}
      {queuesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : queuesQuery.isError ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            Failed to load queue data. Please try again.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <Card key={queue.name}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Layers className="size-4" />
                  {queue.name}
                  {queue.paused && (
                    <Badge variant="secondary" className="text-xs">
                      <Pause className="size-3" />
                      Paused
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Waiting: {queue.waiting}</Badge>
                  <Badge variant="secondary">Active: {queue.active}</Badge>
                  <Badge variant="outline">Delayed: {queue.delayed}</Badge>
                  <Badge variant="outline">
                    Done: {queue.completed.toLocaleString()}
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

                {/* Expand toggle for failed jobs */}
                {queue.failed > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full justify-start text-xs"
                    onClick={() => toggleExpanded(queue.name)}
                  >
                    {expandedQueues.has(queue.name) ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    {queue.failedJobs?.length ?? 0} failed jobs
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Failed jobs tables (expanded) */}
      {queues
        .filter((q) => expandedQueues.has(q.name) && q.failedJobs && q.failedJobs.length > 0)
        .map((queue) => (
          <Card key={`failed-${queue.name}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-destructive" />
                Failed Jobs — {queue.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.failedJobs!.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">
                        {job.id.length > 20
                          ? `${job.id.slice(0, 20)}...`
                          : job.id}
                      </TableCell>
                      <TableCell className="text-xs">{job.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-destructive">
                        {job.failedReason}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {job.attemptsMade}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            retryMutation.mutate({
                              queue: queue.name,
                              jobId: job.id,
                            })
                          }
                          disabled={
                            retryMutation.isPending &&
                            retryMutation.variables?.jobId === job.id
                          }
                        >
                          {retryMutation.isPending &&
                          retryMutation.variables?.jobId === job.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : retryMutation.isSuccess &&
                            retryMutation.variables?.jobId === job.id ? (
                            <CheckCircle2 className="size-3.5 text-green-600" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
