"use client";

interface AbstractTabProps {
  abstract?: string | null;
}

export function AbstractTab({ abstract }: AbstractTabProps) {
  if (!abstract) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No abstract available.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground leading-relaxed">
      {abstract}
    </p>
  );
}
