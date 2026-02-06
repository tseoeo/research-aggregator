"use client";

import { ArrowRight, ArrowDown } from "lucide-react";

const steps = [
  {
    title: "arXiv",
    lines: ["6 categories tracked", "cs.AI, cs.LG, cs.CL, cs.CV, cs.NE, stat.ML"],
  },
  {
    title: "Ingest",
    lines: ["Daily automatic fetch", "New papers every day"],
  },
  {
    title: "Analyze",
    lines: ["10-field AI analysis", "Practical value scoring"],
  },
  {
    title: "Feed",
    lines: ["Filter, sort, explore", "Headlines + detail drawer"],
  },
];

export function PipelineViz() {
  return (
    <div className="flex flex-col md:flex-row items-center gap-3 md:gap-0">
      {steps.map((step, i) => (
        <div key={step.title} className="flex flex-col md:flex-row items-center gap-3 md:gap-0">
          {/* Card */}
          <div className="w-full md:w-44 rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            {step.lines.map((line, j) => (
              <p key={j} className="text-xs text-muted-foreground mt-1 leading-snug">
                {line}
              </p>
            ))}
          </div>

          {/* Arrow */}
          {i < steps.length - 1 && (
            <>
              <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground mx-2 shrink-0" />
              <ArrowDown className="md:hidden h-4 w-4 text-muted-foreground" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
