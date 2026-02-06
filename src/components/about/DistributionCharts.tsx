"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// --- Narrative generators ---

interface DistItem {
  label: string;
  count: number;
}

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function generatePracticalValueNarrative(
  data: Array<{ score: number; count: number }>
): string {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return "No papers analyzed yet.";

  // Median range
  let cum = 0;
  let medianScore = 3;
  for (const d of data) {
    cum += d.count;
    if (cum >= total / 2) {
      medianScore = d.score;
      break;
    }
  }
  const medianRange =
    medianScore <= 1 ? "0\u20131" : medianScore <= 3 ? "2\u20133" : "4\u20135";

  const highCount = data.filter((d) => d.score >= 5).reduce((s, d) => s + d.count, 0);
  const lowCount = data.filter((d) => d.score <= 1).reduce((s, d) => s + d.count, 0);
  const highPct = pct(highCount, total);
  const lowPct = pct(lowCount, total);

  let text = `Most papers score ${medianRange} out of 6.`;
  if (highPct > 0) {
    text += ` ${highPct}% score 5 or above \u2014 these solve real problems with concrete, usable results.`;
  }
  if (lowPct > 0) {
    text += ` ${lowPct}% score below 2, meaning they\u2019re early research without immediate practical value.`;
  }

  return prefixSmallSample(text, total);
}

function generateRankedNarrative(
  items: DistItem[],
  entityName: string
): string {
  const total = items.reduce((s, d) => s + d.count, 0);
  if (total === 0) return "No data available yet.";

  const sorted = [...items].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  const topPct = pct(top.count, total);

  let text = `${top.label} is the most common ${entityName} at ${topPct}%`;

  if (sorted.length > 1) {
    const second = sorted[1];
    const secondPct = pct(second.count, total);
    text += `, followed by ${second.label} (${secondPct}%)`;
  }

  if (sorted.length > 2) {
    const least = sorted[sorted.length - 1];
    const leastPct = pct(least.count, total);
    if (leastPct > 0) {
      text += `. ${least.label} papers are the rarest at ${leastPct}%`;
    }
  }

  text += ".";
  return prefixSmallSample(text, total);
}

function generateTimeNarrative(
  items: Array<{ value: string; count: number }>
): string {
  const total = items.reduce((s, d) => s + d.count, 0);
  if (total === 0) return "No data available yet.";

  const get = (v: string) => items.find((i) => i.value === v)?.count ?? 0;
  const nowPct = pct(get("Now"), total);
  const soonPct = pct(get("Soon"), total);
  const laterPct = pct(get("Later"), total);

  const parts: string[] = [];
  if (nowPct > 0) parts.push(`${nowPct}% of papers describe something usable today`);
  if (soonPct > 0)
    parts.push(`${soonPct}% are close \u2014 usable with some engineering`);
  if (laterPct > 0) parts.push(`${laterPct}% are longer-term research bets`);

  const text = parts.join(". ") + ".";
  return prefixSmallSample(text, total);
}

function generateReadinessNarrative(
  items: Array<{ level: string; count: number }>
): string {
  const total = items.reduce((s, d) => s + d.count, 0);
  if (total === 0) return "No data available yet.";

  const get = (l: string) => items.find((i) => i.level === l)?.count ?? 0;
  const readyPct = pct(get("Ready to Try"), total);
  const engPct = pct(get("Needs Engineering"), total);
  const resPct = pct(get("Research Only"), total);

  const parts: string[] = [];
  if (readyPct > 0) parts.push(`${readyPct}% of papers are ready to try today`);
  if (engPct > 0) parts.push(`${engPct}% need engineering work`);
  if (resPct > 0) parts.push(`${resPct}% are still research-only`);

  const text = parts.join(". ") + ".";
  return prefixSmallSample(text, total);
}

function generateImpactNarrative(
  items: DistItem[],
  analyzedCount: number
): string {
  if (items.length === 0) return "No data available yet.";

  const sorted = [...items].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  const topPct = pct(top.count, analyzedCount);

  let text = `${top.label} appears in ${topPct}% of papers, making it the most active area`;

  if (sorted.length > 1) {
    const second = sorted[1];
    const secondPct = pct(second.count, analyzedCount);
    text += `. ${second.label} follows at ${secondPct}%`;
  }

  const totalTags = items.reduce((s, d) => s + d.count, 0);
  const avgTags = analyzedCount > 0 ? (totalTags / analyzedCount).toFixed(1) : "0";
  text += `. Papers average ${avgTags} impact area tags each.`;

  return prefixSmallSample(text, analyzedCount);
}

function prefixSmallSample(text: string, total: number): string {
  if (total < 50) {
    return `Based on ${total} papers analyzed so far \u2014 ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }
  return text;
}

// --- Chart wrapper ---

const CHART_COLOR = "hsl(var(--primary))";
const AMBER = "#f59e0b";

function ChartSection({
  title,
  narrative,
  children,
}: {
  title: string;
  narrative: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="h-52">{children}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>
    </div>
  );
}

// --- Exported component ---

interface Distributions {
  practicalValue: Array<{ score: number; count: number }>;
  whatKind: Array<{ kind: string; count: number }>;
  timeToValue: Array<{ value: string; count: number }>;
  impactAreas: Array<{ area: string; count: number }>;
  readinessLevel: Array<{ level: string; count: number }>;
}

export function DistributionCharts({
  distributions,
  analyzedCount,
}: {
  distributions: Distributions;
  analyzedCount: number;
}) {
  const pvData = distributions.practicalValue.map((d) => ({
    name: String(d.score),
    count: d.count,
  }));

  const wkData = distributions.whatKind.map((d) => ({
    name: d.kind.length > 18 ? d.kind.substring(0, 16) + "\u2026" : d.kind,
    fullName: d.kind,
    count: d.count,
  }));

  const tvData = distributions.timeToValue
    .filter((d) => d.value !== "Unknown" || d.count > 0)
    .map((d) => ({
      name: d.value,
      count: d.count,
    }));

  const iaData = distributions.impactAreas.map((d) => ({
    name: d.area.length > 18 ? d.area.substring(0, 16) + "\u2026" : d.area,
    fullName: d.area,
    count: d.count,
  }));

  const rlData = distributions.readinessLevel.map((d) => ({
    name: d.level,
    count: d.count,
  }));

  const tvColors: Record<string, string> = {
    Now: "#22c55e",
    Soon: "#f59e0b",
    Later: "#6b7280",
    Unknown: "#4b5563",
  };

  const rlColors: Record<string, string> = {
    "Ready to Try": "#22c55e",
    "Needs Engineering": "#f59e0b",
    "Research Only": "#6b7280",
  };

  return (
    <div className="space-y-10">
      {/* Practical Value */}
      <ChartSection
        title="Practical Value Scores"
        narrative={generatePracticalValueNarrative(distributions.practicalValue)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pvData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill={AMBER} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* What Kind */}
      <ChartSection
        title="What Kind of Papers"
        narrative={generateRankedNarrative(
          distributions.whatKind.map((d) => ({ label: d.kind, count: d.count })),
          "type"
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={wkData}
            layout="vertical"
            margin={{ top: 5, right: 5, bottom: 5, left: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              width={95}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill={AMBER} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Time-to-Value */}
      <ChartSection
        title="Time-to-Value"
        narrative={generateTimeNarrative(distributions.timeToValue)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tvData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {tvData.map((entry) => (
                <Cell key={entry.name} fill={tvColors[entry.name] || "#6b7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Impact Areas */}
      <ChartSection
        title="Impact Areas"
        narrative={generateImpactNarrative(
          distributions.impactAreas.map((d) => ({ label: d.area, count: d.count })),
          analyzedCount
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={iaData}
            layout="vertical"
            margin={{ top: 5, right: 5, bottom: 5, left: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              width={95}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill={AMBER} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Readiness Level */}
      <ChartSection
        title="Readiness Level"
        narrative={generateReadinessNarrative(distributions.readinessLevel)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rlData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {rlData.map((entry) => (
                <Cell key={entry.name} fill={rlColors[entry.name] || "#6b7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>
    </div>
  );
}
