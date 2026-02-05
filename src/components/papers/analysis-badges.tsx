"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Lightbulb,
  Layers,
  FlaskConical,
  Sparkles,
  Clock,
  Zap,
  Timer,
  HelpCircle,
  TrendingUp,
  Rocket,
  Beaker,
  Package,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// ============================================
// ROLE BADGE
// ============================================

const roleBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-help",
  {
    variants: {
      role: {
        Primitive: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        Platform: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        Proof: "bg-green-500/10 text-green-600 dark:text-green-400",
        Provocation: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      },
    },
    defaultVariants: {
      role: "Proof",
    },
  }
);

const roleIcons = {
  Primitive: Lightbulb,
  Platform: Layers,
  Proof: FlaskConical,
  Provocation: Sparkles,
};

const roleInfo = {
  Primitive: {
    label: "Primitive",
    description: "Introduces a fundamental new capability or building block that others can build on",
    example: "New algorithm, technique, or foundational method",
  },
  Platform: {
    label: "Platform",
    description: "Provides infrastructure, tools, or frameworks that enable other applications",
    example: "Framework, library, or toolkit for developers",
  },
  Proof: {
    label: "Proof",
    description: "Demonstrates feasibility or validates that a concept works in practice",
    example: "Shows something is possible, benchmarks a method",
  },
  Provocation: {
    label: "Provocation",
    description: "Challenges assumptions or proposes unconventional ideas worth exploring",
    example: "Questions established methods, proposes new directions",
  },
};

interface RoleBadgeProps extends VariantProps<typeof roleBadgeVariants> {
  role: "Primitive" | "Platform" | "Proof" | "Provocation";
  confidence?: number;
  showLabel?: boolean;
  showConfidenceBar?: boolean;
  className?: string;
}

export function RoleBadge({
  role,
  confidence,
  showLabel = false,
  showConfidenceBar = false,
  className,
}: RoleBadgeProps) {
  const Icon = roleIcons[role];
  const info = roleInfo[role];
  const isLowConfidence = confidence !== undefined && confidence < 0.5;

  const badge = (
    <span className={cn(
      roleBadgeVariants({ role }),
      isLowConfidence && "border border-red-300 dark:border-red-700",
      className
    )}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && <span className="text-[10px] opacity-70 mr-0.5">Type:</span>}
      {info.label}
      {confidence !== undefined && (
        <span className={cn(
          "ml-0.5",
          isLowConfidence ? "text-red-500 font-medium" : "opacity-60"
        )}>
          ({Math.round(confidence * 100)}%)
        </span>
      )}
      {isLowConfidence && <span className="text-red-500 ml-0.5">!</span>}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex flex-col items-start gap-0.5">
          {badge}
          {showConfidenceBar && confidence !== undefined && (
            <ConfidenceIndicator confidence={confidence} size="sm" showWarning={false} />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">Research Type: {info.label}</p>
        <p className="text-xs opacity-90">{info.description}</p>
        <p className="text-xs opacity-70 mt-1 italic">e.g., {info.example}</p>
        {isLowConfidence && (
          <p className="text-xs text-red-500 mt-1 font-medium">
            Low confidence - treat with caution
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// TIME-TO-VALUE BADGE
// ============================================

const ttvBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-help",
  {
    variants: {
      ttv: {
        Now: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        Soon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        Later: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
        Unknown: "bg-gray-500/10 text-gray-500 dark:text-gray-400",
      },
    },
    defaultVariants: {
      ttv: "Unknown",
    },
  }
);

const ttvIcons = {
  Now: Zap,
  Soon: Timer,
  Later: Clock,
  Unknown: HelpCircle,
};

const ttvInfo = {
  Now: {
    label: "Now",
    description: "Can be applied to real business problems today with existing tools and infrastructure",
    timeline: "Ready to use",
  },
  Soon: {
    label: "Soon",
    description: "Requires 6-18 months of engineering work, productization, or integration before practical use",
    timeline: "6-18 months",
  },
  Later: {
    label: "Later",
    description: "Requires 2+ years of additional research or significant infrastructure advances",
    timeline: "2+ years",
  },
  Unknown: {
    label: "Unknown",
    description: "Cannot determine practical timeline from the available information",
    timeline: "Unclear",
  },
};

interface TimeToValueBadgeProps extends VariantProps<typeof ttvBadgeVariants> {
  ttv: "Now" | "Soon" | "Later" | "Unknown";
  confidence?: number;
  showLabel?: boolean;
  showConfidenceBar?: boolean;
  className?: string;
}

export function TimeToValueBadge({
  ttv,
  confidence,
  showLabel = false,
  showConfidenceBar = false,
  className,
}: TimeToValueBadgeProps) {
  const Icon = ttvIcons[ttv];
  const info = ttvInfo[ttv];
  const isLowConfidence = confidence !== undefined && confidence < 0.5;

  const badge = (
    <span className={cn(
      ttvBadgeVariants({ ttv }),
      isLowConfidence && "border border-red-300 dark:border-red-700",
      className
    )}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && <span className="text-[10px] opacity-70 mr-0.5">Value:</span>}
      {info.label}
      {confidence !== undefined && (
        <span className={cn(
          "ml-0.5",
          isLowConfidence ? "text-red-500 font-medium" : "opacity-60"
        )}>
          ({Math.round(confidence * 100)}%)
        </span>
      )}
      {isLowConfidence && <span className="text-red-500 ml-0.5">!</span>}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex flex-col items-start gap-0.5">
          {badge}
          {showConfidenceBar && confidence !== undefined && (
            <ConfidenceIndicator confidence={confidence} size="sm" showWarning={false} />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">Time to Business Value: {info.label}</p>
        <p className="text-xs opacity-90">{info.description}</p>
        <p className="text-xs opacity-70 mt-1">Timeline: {info.timeline}</p>
        {isLowConfidence && (
          <p className="text-xs text-red-500 mt-1 font-medium">
            Low confidence - treat with caution
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// INTEREST TIER BADGE
// ============================================

const interestBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-help",
  {
    variants: {
      tier: {
        low: "bg-gray-500/10 text-gray-500 dark:text-gray-400",
        moderate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        very_high: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      },
    },
    defaultVariants: {
      tier: "low",
    },
  }
);

const tierInfo = {
  low: {
    label: "Low",
    description: "Limited business impact or weak evidence. May be too early-stage or narrowly applicable.",
    range: "0-3 points",
  },
  moderate: {
    label: "Moderate",
    description: "Some business relevance with decent evidence. Worth monitoring but not immediately actionable.",
    range: "4-6 points",
  },
  high: {
    label: "High",
    description: "Clear business impact with strong evidence. Consider for near-term evaluation or pilots.",
    range: "7-9 points",
  },
  very_high: {
    label: "Very High",
    description: "Exceptional business potential with robust evidence. Prioritize for immediate attention.",
    range: "10-12 points",
  },
};

interface InterestBadgeProps extends VariantProps<typeof interestBadgeVariants> {
  tier: "low" | "moderate" | "high" | "very_high";
  score: number;
  showLabel?: boolean;
  className?: string;
}

export function InterestBadge({
  tier,
  score,
  showLabel = false,
  className,
}: InterestBadgeProps) {
  const info = tierInfo[tier];

  const badge = (
    <span className={cn(interestBadgeVariants({ tier }), className)}>
      <TrendingUp className="h-3.5 w-3.5" />
      {showLabel && <span className="text-[10px] opacity-70 mr-0.5">Interest:</span>}
      {info.label}
      <span className="ml-0.5 opacity-60">({score}/12)</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">Business Interest Score: {score}/12</p>
        <p className="text-xs opacity-90">{info.description}</p>
        <p className="text-xs opacity-70 mt-1">
          Scored on: business impact, evidence quality, real-world feasibility, and failure disclosure
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// READINESS BADGE
// ============================================

const readinessBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-help",
  {
    variants: {
      level: {
        research_only: "bg-gray-500/10 text-gray-500 dark:text-gray-400",
        prototype_candidate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        deployable_with_work: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
    },
    defaultVariants: {
      level: "research_only",
    },
  }
);

const readinessIcons = {
  research_only: Beaker,
  prototype_candidate: Package,
  deployable_with_work: Rocket,
};

const readinessInfo = {
  research_only: {
    label: "Research",
    description: "Only proven in academic/lab settings. Not ready for business use without significant further work.",
    action: "Monitor for future developments",
  },
  prototype_candidate: {
    label: "Prototype",
    description: "Ready for internal proof-of-concept or prototype. Can be tested in controlled environments.",
    action: "Consider for internal pilots",
  },
  deployable_with_work: {
    label: "Deployable",
    description: "Could be deployed to production with reasonable engineering effort. Relatively mature approach.",
    action: "Evaluate for production use",
  },
};

interface ReadinessBadgeProps extends VariantProps<typeof readinessBadgeVariants> {
  level: "research_only" | "prototype_candidate" | "deployable_with_work";
  showLabel?: boolean;
  className?: string;
}

export function ReadinessBadge({
  level,
  showLabel = false,
  className,
}: ReadinessBadgeProps) {
  const Icon = readinessIcons[level];
  const info = readinessInfo[level];

  const badge = (
    <span className={cn(readinessBadgeVariants({ level }), className)}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && <span className="text-[10px] opacity-70 mr-0.5">Stage:</span>}
      {info.label}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">Deployment Readiness: {info.label}</p>
        <p className="text-xs opacity-90">{info.description}</p>
        <p className="text-xs opacity-70 mt-1 italic">{info.action}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// CONFIDENCE INDICATOR
// ============================================

interface ConfidenceIndicatorProps {
  confidence: number;
  size?: "sm" | "md";
  showWarning?: boolean;
  className?: string;
}

export function ConfidenceIndicator({
  confidence,
  size = "sm",
  showWarning = true,
  className,
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100);
  const barWidth = size === "sm" ? "w-12" : "w-16";
  const barHeight = size === "sm" ? "h-1" : "h-1.5";
  const isLowConfidence = confidence < 0.5;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1.5", className)}>
          <div className={cn("rounded-full bg-muted overflow-hidden", barWidth, barHeight)}>
            <div
              className={cn(
                "h-full rounded-full transition-all",
                confidence >= 0.7
                  ? "bg-emerald-500"
                  : confidence >= 0.5
                  ? "bg-amber-500"
                  : "bg-red-400"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className={cn(
            "text-xs",
            isLowConfidence && showWarning ? "text-red-500 font-medium" : "text-muted-foreground"
          )}>
            {percentage}%
          </span>
          {isLowConfidence && showWarning && (
            <span className="text-red-500" title="Low confidence">!</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {confidence >= 0.7 && "High confidence"}
          {confidence >= 0.5 && confidence < 0.7 && "Moderate confidence"}
          {confidence < 0.5 && "Low confidence - treat with caution"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// LOW CONFIDENCE WARNING BADGE
// ============================================

interface LowConfidenceWarningProps {
  className?: string;
}

export function LowConfidenceWarning({ className }: LowConfidenceWarningProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800",
          className
        )}>
          <HelpCircle className="h-3 w-3" />
          Low Confidence
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">Low Confidence Analysis</p>
        <p className="text-xs opacity-90">
          One or more confidence scores are below 50%. This analysis should be treated with caution
          and may benefit from manual review.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// ANALYSIS STATUS BADGE
// ============================================

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        complete: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        partial: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        low_confidence: "bg-red-500/10 text-red-600 dark:text-red-400",
      },
    },
    defaultVariants: {
      status: "complete",
    },
  }
);

interface AnalysisStatusBadgeProps {
  status: "complete" | "partial" | "low_confidence";
  className?: string;
}

export function AnalysisStatusBadge({ status, className }: AnalysisStatusBadgeProps) {
  const labels = {
    complete: "Complete",
    partial: "Partial",
    low_confidence: "Low Confidence",
  };

  const descriptions = {
    complete: "All fields validated successfully",
    partial: "Some fields missing or failed validation",
    low_confidence: "One or more confidence scores below threshold",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(statusBadgeVariants({ status }), className)}>
          {status === "complete" && <CheckCircle className="h-3 w-3" />}
          {status === "partial" && <AlertCircle className="h-3 w-3" />}
          {status === "low_confidence" && <HelpCircle className="h-3 w-3" />}
          {labels[status]}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{descriptions[status]}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================
// BUSINESS PRIMITIVE BADGE
// ============================================

const primitiveBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      primitive: {
        cost: "bg-green-500/10 text-green-600 dark:text-green-400",
        reliability: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        speed: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        quality: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        risk: "bg-red-500/10 text-red-600 dark:text-red-400",
        new_capability: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      },
    },
    defaultVariants: {
      primitive: "cost",
    },
  }
);

const primitiveLabels = {
  cost: "Cost",
  reliability: "Reliability",
  speed: "Speed",
  quality: "Quality",
  risk: "Risk",
  new_capability: "New Capability",
};

interface BusinessPrimitiveBadgeProps {
  primitive: "cost" | "reliability" | "speed" | "quality" | "risk" | "new_capability";
  className?: string;
}

export function BusinessPrimitiveBadge({
  primitive,
  className,
}: BusinessPrimitiveBadgeProps) {
  return (
    <span className={cn(primitiveBadgeVariants({ primitive }), className)}>
      {primitiveLabels[primitive]}
    </span>
  );
}

// ============================================
// FIT CONFIDENCE BADGE (for use-case mappings)
// ============================================

const fitBadgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
  {
    variants: {
      fit: {
        low: "bg-gray-500/10 text-gray-500",
        med: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
    },
    defaultVariants: {
      fit: "low",
    },
  }
);

interface FitConfidenceBadgeProps {
  fit: "low" | "med" | "high";
  className?: string;
}

export function FitConfidenceBadge({
  fit,
  className,
}: FitConfidenceBadgeProps) {
  return (
    <span className={cn(fitBadgeVariants({ fit }), className)}>
      {fit}
    </span>
  );
}

// ============================================
// COMPACT ANALYSIS BADGES ROW (for cards)
// ============================================

interface AnalysisBadgesRowProps {
  role: "Primitive" | "Platform" | "Proof" | "Provocation";
  roleConfidence?: number;
  timeToValue: "Now" | "Soon" | "Later" | "Unknown";
  timeToValueConfidence?: number;
  interestTier: "low" | "moderate" | "high" | "very_high";
  interestScore: number;
  readinessLevel: "research_only" | "prototype_candidate" | "deployable_with_work";
  analysisStatus?: "complete" | "partial" | "low_confidence";
  className?: string;
}

export function AnalysisBadgesRow({
  role,
  roleConfidence,
  timeToValue,
  timeToValueConfidence,
  interestTier,
  interestScore,
  readinessLevel,
  analysisStatus,
  className,
}: AnalysisBadgesRowProps) {
  const hasLowConfidence = (roleConfidence !== undefined && roleConfidence < 0.5) ||
    (timeToValueConfidence !== undefined && timeToValueConfidence < 0.5);

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {analysisStatus && analysisStatus !== "complete" && (
        <AnalysisStatusBadge status={analysisStatus} />
      )}
      {hasLowConfidence && !analysisStatus && (
        <LowConfidenceWarning />
      )}
      <RoleBadge role={role} confidence={roleConfidence} />
      <TimeToValueBadge ttv={timeToValue} confidence={timeToValueConfidence} />
      <InterestBadge tier={interestTier} score={interestScore} />
      <ReadinessBadge level={readinessLevel} />
    </div>
  );
}
