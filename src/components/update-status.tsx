"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw, Database } from "lucide-react";

interface StatusData {
  lastFetch: string | null;
  nextFetch: string | null;
  totalPapers: number;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs < 0) return "soon";

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) return `in ${diffMins}m`;
  return `in ${diffHours}h`;
}

export function UpdateStatus() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    // Refresh status every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
        <div className="flex items-center gap-1.5 animate-pulse">
          <Clock className="h-3 w-3" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!status || !status.lastFetch) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
        <Clock className="h-3 w-3" />
        <span>Updates every 6 hours</span>
      </div>
    );
  }

  const lastFetchDate = new Date(status.lastFetch);
  const nextFetchDate = status.nextFetch ? new Date(status.nextFetch) : null;

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
      <div className="flex items-center gap-1.5" title="Last updated">
        <Clock className="h-3 w-3" />
        <span>{formatTimeAgo(lastFetchDate)}</span>
      </div>
      {nextFetchDate && (
        <div className="flex items-center gap-1.5" title="Next update">
          <RefreshCw className="h-3 w-3" />
          <span>{formatTimeUntil(nextFetchDate)}</span>
        </div>
      )}
      <div
        className="hidden sm:flex items-center gap-1.5"
        title="Total papers in database"
      >
        <Database className="h-3 w-3" />
        <span>{status.totalPapers.toLocaleString()}</span>
      </div>
    </div>
  );
}
