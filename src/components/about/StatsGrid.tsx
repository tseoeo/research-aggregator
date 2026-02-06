"use client";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

interface Stats {
  totalPapers: number;
  analyzedPapers: number;
  totalTokens: number;
  avgPapersPerDay: number;
  categoriesTracked: number;
}

const statConfig = [
  { key: "totalPapers" as const, label: "Papers tracked" },
  { key: "analyzedPapers" as const, label: "Papers analyzed" },
  { key: "totalTokens" as const, label: "Tokens processed" },
  { key: "categoriesTracked" as const, label: "arXiv categories" },
  { key: "avgPapersPerDay" as const, label: "Avg papers / day" },
  { key: null, label: "Fields per analysis", value: 10 },
];

export function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {statConfig.map((s) => {
        const value = s.key ? stats[s.key] : s.value!;
        return (
          <div
            key={s.label}
            className="rounded-lg border border-border/60 bg-muted/20 p-5 text-center"
          >
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {formatNumber(value)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}
