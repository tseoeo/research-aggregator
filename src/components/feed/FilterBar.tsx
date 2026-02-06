"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { X, SlidersHorizontal, ChevronDown, Check } from "lucide-react";

// Filter definitions
const KIND_OPTIONS = [
  "All",
  "New Method",
  "New Model",
  "Infrastructure/Tooling",
  "Benchmark/Evaluation",
  "Dataset",
  "Application Study",
  "Survey/Review",
  "Scaling Study",
  "Safety/Alignment",
] as const;

const AREA_OPTIONS = [
  "Cost & Efficiency",
  "Context & Memory",
  "Reasoning & Planning",
  "Tool Use & Agents",
  "Training & Data",
  "Safety & Trust",
  "Multimodal",
  "Code Generation",
  "Science & Math",
  "Deployment & Infrastructure",
] as const;

const VALUE_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Low (0-1)", value: "2" },
  { label: "Moderate (2-3)", value: "3" },
  { label: "High (4-5)", value: "4" },
  { label: "Very High (6)", value: "6" },
] as const;

const READINESS_OPTIONS = [
  "All",
  "Research Only",
  "Needs Engineering",
  "Ready to Try",
] as const;

const TIMELINE_OPTIONS = ["All", "Now", "Soon", "Later"] as const;

const CATEGORY_OPTIONS = [
  { value: "cs.AI", label: "AI" },
  { value: "cs.LG", label: "ML" },
  { value: "cs.CL", label: "NLP" },
  { value: "cs.CV", label: "Vision" },
  { value: "stat.ML", label: "Stats ML" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "value", label: "Highest Value" },
  { value: "discussed", label: "Most Discussed" },
] as const;

// Dropdown component for single-select filters
function FilterDropdown({
  label,
  value,
  options,
  onChange,
  isActive,
}: {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onChange: (value: string) => void;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors whitespace-nowrap",
          isActive
            ? "bg-primary/10 border-primary/30 text-primary"
            : "border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span className="text-xs font-medium text-muted-foreground">{label}:</span>
        <span className={cn("font-medium", isActive && "text-primary")}>{displayLabel}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left",
                  value === option.value && "text-primary font-medium"
                )}
              >
                {value === option.value && <Check className="h-3 w-3" />}
                {value !== option.value && <span className="w-3" />}
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Multi-select dropdown for Areas filter
function AreasDropdown({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (areas: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = selected.length > 0;
  const displayLabel = isActive ? `${selected.length} selected` : "All";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors whitespace-nowrap",
          isActive
            ? "bg-primary/10 border-primary/30 text-primary"
            : "border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span className="text-xs font-medium text-muted-foreground">Areas:</span>
        <span className={cn("font-medium", isActive && "text-primary")}>{displayLabel}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[220px] rounded-md border border-border bg-popover p-1 shadow-md">
            {AREA_OPTIONS.map((area) => {
              const isChecked = selected.includes(area);
              return (
                <button
                  key={area}
                  onClick={() => {
                    if (isChecked) {
                      onChange(selected.filter((a) => a !== area));
                    } else {
                      onChange([...selected, area]);
                    }
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left"
                >
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-sm border flex items-center justify-center",
                      isChecked ? "bg-primary border-primary" : "border-border"
                    )}
                  >
                    {isChecked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  <span className={cn(isChecked && "font-medium")}>{area}</span>
                </button>
              );
            })}
            {selected.length > 0 && (
              <>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => onChange([])}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                  Clear areas
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface FilterBarProps {
  total: number;
}

export function FilterBar({ total }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read current filter state from URL
  const kind = searchParams.get("kind") || "";
  const areas = searchParams.get("areas")
    ? searchParams.get("areas")!.split(",").filter(Boolean)
    : [];
  const minValue = searchParams.get("minValue") || "";
  const readiness = searchParams.get("readiness") || "";
  const timeline = searchParams.get("timeline") || "";
  const category = searchParams.get("category") || "cs.AI";
  const sort = searchParams.get("sort") || "newest";

  // Count active filters (non-default values)
  const activeFilterCount = [
    kind,
    areas.length > 0 ? "yes" : "",
    minValue,
    readiness,
    timeline,
    category !== "cs.AI" ? "yes" : "",
  ].filter(Boolean).length;

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change
      params.delete("page");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const updateAreas = useCallback(
    (newAreas: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newAreas.length > 0) {
        params.set("areas", newAreas.join(","));
      } else {
        params.delete("areas");
      }
      params.delete("page");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    router.replace("/", { scroll: false });
  }, [router]);

  // Mobile filter state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Build active filter descriptions for status line
  const activeFilters: string[] = [];
  if (kind) activeFilters.push(kind);
  if (areas.length > 0)
    activeFilters.push(areas.length === 1 ? areas[0] : `${areas.length} areas`);
  if (minValue) {
    const vl = VALUE_OPTIONS.find((v) => v.value === minValue);
    if (vl) activeFilters.push(vl.label);
  }
  if (readiness) activeFilters.push(readiness);
  if (timeline) activeFilters.push(timeline);
  if (category !== "cs.AI") {
    const cl = CATEGORY_OPTIONS.find((c) => c.value === category);
    if (cl) activeFilters.push(cl.label);
  }

  // Single-select options formatted for FilterDropdown
  const kindOptions = KIND_OPTIONS.map((k) => ({
    label: k,
    value: k === "All" ? "" : k,
  }));
  const readinessOptions = READINESS_OPTIONS.map((r) => ({
    label: r,
    value: r === "All" ? "" : r,
  }));
  const timelineOptions = TIMELINE_OPTIONS.map((t) => ({
    label: t,
    value: t === "All" ? "" : t,
  }));
  const categoryOptions = CATEGORY_OPTIONS.map((c) => ({
    label: c.label,
    value: c.value,
  }));
  const sortOptions = SORT_OPTIONS.map((s) => ({
    label: s.label,
    value: s.value,
  }));
  const valueOptions = VALUE_OPTIONS.map((v) => ({
    label: v.label,
    value: v.value,
  }));

  return (
    <div className="space-y-2">
      {/* Desktop filters */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Kind"
          value={kind}
          options={kindOptions}
          onChange={(v) => updateFilter("kind", v)}
          isActive={!!kind}
        />
        <AreasDropdown selected={areas} onChange={updateAreas} />
        <FilterDropdown
          label="Value"
          value={minValue}
          options={valueOptions}
          onChange={(v) => updateFilter("minValue", v)}
          isActive={!!minValue}
        />
        <FilterDropdown
          label="Ready"
          value={readiness}
          options={readinessOptions}
          onChange={(v) => updateFilter("readiness", v)}
          isActive={!!readiness}
        />
        <FilterDropdown
          label="Timeline"
          value={timeline}
          options={timelineOptions}
          onChange={(v) => updateFilter("timeline", v)}
          isActive={!!timeline}
        />
        <FilterDropdown
          label="Category"
          value={category}
          options={categoryOptions}
          onChange={(v) => updateFilter("category", v)}
          isActive={category !== "cs.AI"}
        />
        <div className="h-4 w-px bg-border/50 mx-1" />
        <FilterDropdown
          label="Sort"
          value={sort}
          options={sortOptions}
          onChange={(v) => updateFilter("sort", v)}
          isActive={sort !== "newest"}
        />
      </div>

      {/* Mobile filters */}
      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors",
            activeFilterCount > 0
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border/50 text-muted-foreground"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        <FilterDropdown
          label="Sort"
          value={sort}
          options={sortOptions}
          onChange={(v) => updateFilter("sort", v)}
          isActive={sort !== "newest"}
        />
      </div>

      {/* Mobile filter panel */}
      {mobileOpen && (
        <div className="md:hidden space-y-3 p-3 rounded-md border border-border/50 bg-muted/30">
          <div className="flex flex-wrap gap-2">
            <FilterDropdown
              label="Kind"
              value={kind}
              options={kindOptions}
              onChange={(v) => updateFilter("kind", v)}
              isActive={!!kind}
            />
            <AreasDropdown selected={areas} onChange={updateAreas} />
            <FilterDropdown
              label="Value"
              value={minValue}
              options={valueOptions}
              onChange={(v) => updateFilter("minValue", v)}
              isActive={!!minValue}
            />
            <FilterDropdown
              label="Ready"
              value={readiness}
              options={readinessOptions}
              onChange={(v) => updateFilter("readiness", v)}
              isActive={!!readiness}
            />
            <FilterDropdown
              label="Timeline"
              value={timeline}
              options={timelineOptions}
              onChange={(v) => updateFilter("timeline", v)}
              isActive={!!timeline}
            />
            <FilterDropdown
              label="Category"
              value={category}
              options={categoryOptions}
              onChange={(v) => updateFilter("category", v)}
              isActive={category !== "cs.AI"}
            />
          </div>
        </div>
      )}

      {/* Status line */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Showing {total.toLocaleString()} paper{total !== 1 ? "s" : ""}
        </span>
        {activeFilters.length > 0 && (
          <>
            <span className="text-border">·</span>
            <span>
              Filtered by: {activeFilters.join(", ")}
            </span>
            <button
              onClick={clearAll}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          </>
        )}
      </div>
    </div>
  );
}
