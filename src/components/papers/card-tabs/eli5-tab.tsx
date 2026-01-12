"use client";

import { Lightbulb } from "lucide-react";

interface Eli5TabProps {
  eli5?: string | null;
}

export function Eli5Tab({ eli5 }: Eli5TabProps) {
  if (!eli5) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Simple explanation generating...
      </p>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <Lightbulb className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm leading-relaxed">{eli5}</p>
    </div>
  );
}
