"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Play, Check, X, AlertCircle } from "lucide-react";
import { ModelResultCard } from "@/components/test/model-result-card";
import type { Paper } from "@/components/papers/paper-list";

// Budget-friendly models for comparison
const AVAILABLE_MODELS = [
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "DeepSeek" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "anthropic/claude-3-haiku-20240307", name: "Claude 3 Haiku", provider: "Anthropic" },
  { id: "z-ai/glm-4.7", name: "GLM-4.7", provider: "Z-AI" },
  { id: "mistralai/mistral-small-3.1-24b-instruct", name: "Mistral Small 3.1", provider: "Mistral" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta" },
  { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5", provider: "Moonshot" },
  { id: "moonshotai/kimi-k2-thinking", name: "Kimi K2 Thinking", provider: "Moonshot" },
];

interface ModelResult {
  model: string;
  summary?: {
    bullets: string[];
    eli5: string;
    tokensUsed: number;
  };
  analysis?: {
    role: string;
    roleConfidence: number;
    timeToValue: string;
    timeToValueConfidence: number;
    interestingness: unknown;
    businessPrimitives: unknown;
    keyNumbers: unknown[];
    constraints: unknown[];
    failureModes: unknown[];
    whatIsMissing: string[];
    readinessLevel: string;
    readinessJustification: string;
    readinessEvidencePointers: string[];
    useCaseMappings: unknown[];
    publicViews: unknown;
    tokensUsed: number;
  };
  summaryTokens: number;
  analysisTokens: number;
  totalTokens: number;
  summaryDuration: number;
  analysisDuration: number;
  error?: string;
  status: "pending" | "running" | "complete" | "error";
}

interface SimplePaper {
  id: string;
  title: string;
  abstract?: string | null;
  abstractLength: number;
}

export function ModelComparisonClient() {
  const [papers, setPapers] = useState<SimplePaper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [results, setResults] = useState<Map<string, ModelResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(true);

  // Fetch papers on mount
  useEffect(() => {
    async function fetchPapers() {
      try {
        const response = await fetch("/api/papers?limit=30");
        const data = await response.json();

        const simplePapers: SimplePaper[] = data.papers
          .filter((p: Paper) => p.abstract)
          .map((p: Paper) => ({
            id: p.id,
            title: p.title,
            abstract: p.abstract,
            abstractLength: p.abstract?.length || 0,
          }))
          // Sort by closeness to 1000 chars (average length)
          .sort((a: SimplePaper, b: SimplePaper) =>
            Math.abs(a.abstractLength - 1000) - Math.abs(b.abstractLength - 1000)
          );

        setPapers(simplePapers);

        // Auto-select the paper closest to average length
        if (simplePapers.length > 0) {
          setSelectedPaperId(simplePapers[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch papers:", error);
      } finally {
        setLoadingPapers(false);
      }
    }

    fetchPapers();
  }, []);

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((m) => m !== modelId)
        : [...prev, modelId]
    );
  };

  const runComparison = async () => {
    if (!selectedPaperId || selectedModels.length === 0) return;

    setIsRunning(true);
    setResults(new Map());

    // Initialize all results as pending
    const initialResults = new Map<string, ModelResult>();
    for (const model of selectedModels) {
      initialResults.set(model, {
        model,
        summaryTokens: 0,
        analysisTokens: 0,
        totalTokens: 0,
        summaryDuration: 0,
        analysisDuration: 0,
        status: "pending",
      });
    }
    setResults(initialResults);

    // Run each model sequentially
    for (const model of selectedModels) {
      setCurrentModel(model);

      // Update status to running
      setResults((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(model);
        if (existing) {
          newMap.set(model, { ...existing, status: "running" });
        }
        return newMap;
      });

      try {
        const response = await fetch("/api/test/model-comparison", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId: selectedPaperId, model }),
        });

        const result = await response.json();

        setResults((prev) => {
          const newMap = new Map(prev);
          newMap.set(model, {
            ...result,
            status: result.error ? "error" : "complete",
          });
          return newMap;
        });
      } catch (error) {
        setResults((prev) => {
          const newMap = new Map(prev);
          newMap.set(model, {
            model,
            summaryTokens: 0,
            analysisTokens: 0,
            totalTokens: 0,
            summaryDuration: 0,
            analysisDuration: 0,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return newMap;
        });
      }

      // Small delay between models to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    setCurrentModel(null);
  };

  const selectedPaper = papers.find((p) => p.id === selectedPaperId);
  const completedResults = Array.from(results.values()).filter(
    (r) => r.status === "complete" || r.status === "error"
  );
  const sortedResults = [...completedResults].sort(
    (a, b) => a.totalTokens - b.totalTokens
  );
  const minTokens = sortedResults[0]?.totalTokens || 0;
  const maxTokens = sortedResults[sortedResults.length - 1]?.totalTokens || 0;

  return (
    <div className="space-y-6">
      {/* Paper Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Paper</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPapers ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading papers...
            </div>
          ) : (
            <Select
              value={selectedPaperId || undefined}
              onValueChange={setSelectedPaperId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a paper" />
              </SelectTrigger>
              <SelectContent>
                {papers.map((paper) => (
                  <SelectItem key={paper.id} value={paper.id}>
                    <span className="truncate">
                      {paper.title.substring(0, 60)}
                      {paper.title.length > 60 ? "..." : ""}
                    </span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({paper.abstractLength} chars)
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedPaper && (
            <p className="mt-2 text-sm text-muted-foreground">
              Abstract length: {selectedPaper.abstractLength} characters
            </p>
          )}
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Models to Compare</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = selectedModels.includes(model.id);
              const result = results.get(model.id);
              const status = result?.status;

              return (
                <Badge
                  key={model.id}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer select-none transition-colors ${
                    isSelected ? "" : "hover:bg-muted"
                  } ${status === "running" ? "animate-pulse" : ""}`}
                  onClick={() => !isRunning && toggleModel(model.id)}
                >
                  {status === "running" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {status === "complete" && (
                    <Check className="mr-1 h-3 w-3 text-green-500" />
                  )}
                  {status === "error" && (
                    <X className="mr-1 h-3 w-3 text-red-500" />
                  )}
                  {model.name}
                  <span className="ml-1 text-xs opacity-60">({model.provider})</span>
                </Badge>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Button
              onClick={runComparison}
              disabled={
                isRunning || !selectedPaperId || selectedModels.length === 0
              }
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running {currentModel ? `(${AVAILABLE_MODELS.find(m => m.id === currentModel)?.name})` : ""}...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Comparison ({selectedModels.length} models)
                </>
              )}
            </Button>
            {selectedModels.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedModels([])}
                disabled={isRunning}
              >
                Clear selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Comparison Table */}
      {completedResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Cost Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Summary Tokens</TableHead>
                  <TableHead className="text-right">Analysis Tokens</TableHead>
                  <TableHead className="text-right">Total Tokens</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.map((result) => {
                  const modelInfo = AVAILABLE_MODELS.find(
                    (m) => m.id === result.model
                  );
                  const isMin = result.totalTokens === minTokens && minTokens > 0;
                  const isMax = result.totalTokens === maxTokens && maxTokens > 0;

                  return (
                    <TableRow key={result.model}>
                      <TableCell className="font-medium">
                        {modelInfo?.name || result.model}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.summaryTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.analysisTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span
                          className={
                            isMin
                              ? "text-green-600 font-bold"
                              : isMax
                              ? "text-red-600"
                              : ""
                          }
                        >
                          {result.totalTokens.toLocaleString()}
                        </span>
                        {isMin && (
                          <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                            Cheapest
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {((result.summaryDuration + result.analysisDuration) / 1000).toFixed(1)}s
                      </TableCell>
                      <TableCell>
                        {result.status === "complete" ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Check className="mr-1 h-3 w-3" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Results Feed */}
      {completedResults.length > 0 && selectedPaper && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Results Feed</h2>
          <p className="text-sm text-muted-foreground">
            Same paper processed by different models. Scroll to compare quality.
          </p>
          <div className="space-y-6">
            {sortedResults.map((result) => {
              const modelInfo = AVAILABLE_MODELS.find(
                (m) => m.id === result.model
              );
              const isMin = result.totalTokens === minTokens && minTokens > 0;

              return (
                <ModelResultCard
                  key={result.model}
                  modelName={modelInfo?.name || result.model}
                  modelId={result.model}
                  provider={modelInfo?.provider || "Unknown"}
                  tokens={result.totalTokens}
                  summaryTokens={result.summaryTokens}
                  analysisTokens={result.analysisTokens}
                  duration={result.summaryDuration + result.analysisDuration}
                  isLowest={isMin}
                  error={result.error}
                  paper={{
                    id: selectedPaper.id,
                    title: papers.find((p) => p.id === selectedPaperId)?.title || "",
                    abstract: selectedPaper.abstract,
                    externalId: "",
                    summaryBullets: result.summary?.bullets || null,
                    summaryEli5: result.summary?.eli5 || null,
                    analysis: result.analysis
                      ? {
                          role: result.analysis.role as "Primitive" | "Platform" | "Proof" | "Provocation",
                          roleConfidence: result.analysis.roleConfidence,
                          timeToValue: result.analysis.timeToValue as "Now" | "Soon" | "Later" | "Unknown",
                          timeToValueConfidence: result.analysis.timeToValueConfidence,
                          interestingness: result.analysis.interestingness as {
                            total_score: number;
                            tier: "low" | "moderate" | "high" | "very_high";
                            checks: { check_id: string; score: number; answer: string; evidence_pointers: string[]; notes?: string }[];
                          },
                          businessPrimitives: result.analysis.businessPrimitives as {
                            selected: ("cost" | "reliability" | "speed" | "quality" | "risk" | "new_capability")[];
                            justification: string;
                            evidence_pointers: string[];
                          },
                          keyNumbers: result.analysis.keyNumbers as { metric_name: string; value: string; direction: "up" | "down"; baseline?: string; conditions: string; evidence_pointer: string }[],
                          constraints: result.analysis.constraints as { constraint: string; why_it_matters: string; evidence_pointer: string }[],
                          failureModes: result.analysis.failureModes as { failure_mode: string; why_it_matters: string; evidence_pointer: string }[],
                          whatIsMissing: result.analysis.whatIsMissing,
                          readinessLevel: result.analysis.readinessLevel as "research_only" | "prototype_candidate" | "deployable_with_work",
                          readinessJustification: result.analysis.readinessJustification,
                          readinessEvidencePointers: result.analysis.readinessEvidencePointers,
                          useCaseMappings: (result.analysis.useCaseMappings as { name: string; fitConfidence: "low" | "med" | "high"; because: string; evidencePointers?: string[] }[]),
                          publicViews: result.analysis.publicViews as {
                            hook_sentence: string;
                            "30s_summary": string[];
                            "3m_summary": string;
                            "8m_operator_addendum"?: string;
                          },
                        }
                      : null,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
