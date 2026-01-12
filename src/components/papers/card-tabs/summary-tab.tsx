"use client";

interface SummaryTabProps {
  bullets?: string[] | null;
}

export function SummaryTab({ bullets }: SummaryTabProps) {
  if (!bullets || bullets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Summary generating...
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {bullets.map((bullet, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm">
          <span className="text-primary mt-1.5 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  );
}
