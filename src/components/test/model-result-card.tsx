"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaperCard } from "@/components/papers/paper-card";
import type { Paper } from "@/components/papers/paper-list";
import { AlertCircle, Coins, Clock, Trophy } from "lucide-react";

interface ModelResultCardProps {
  modelName: string;
  modelId: string;
  provider: string;
  tokens: number;
  summaryTokens: number;
  analysisTokens: number;
  duration: number;
  isLowest: boolean;
  error?: string;
  paper: Paper;
}

export function ModelResultCard({
  modelName,
  modelId,
  provider,
  tokens,
  summaryTokens,
  analysisTokens,
  duration,
  isLowest,
  error,
  paper,
}: ModelResultCardProps) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {modelName}
              </Badge>
              <span className="text-sm text-muted-foreground">{provider}</span>
            </div>
            <Badge variant="destructive">
              <AlertCircle className="mr-1 h-3 w-3" />
              Error
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Model Header */}
      <Card className={`border-2 ${isLowest ? "border-green-500 bg-green-50/30" : "border-border"}`}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-sm">
                {modelName}
              </Badge>
              <span className="text-sm text-muted-foreground">{provider}</span>
              {isLowest && (
                <Badge className="bg-green-600">
                  <Trophy className="mr-1 h-3 w-3" />
                  Cheapest
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Coins className="h-4 w-4" />
                <span className="font-mono font-medium text-foreground">
                  {tokens.toLocaleString()}
                </span>
                <span>tokens</span>
                <span className="text-xs">
                  (summary: {summaryTokens.toLocaleString()}, analysis: {analysisTokens.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{(duration / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paper Card */}
      <PaperCard paper={paper} />
    </div>
  );
}
