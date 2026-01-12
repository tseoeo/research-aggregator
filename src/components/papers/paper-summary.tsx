"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

interface PaperSummaryProps {
  paperId: string;
  initialBullets?: string[] | null;
  initialEli5?: string | null;
}

interface SummaryData {
  bullets: string[] | null;
  eli5: string | null;
  tokensUsed?: number;
  model?: string;
  configured?: boolean;
  message?: string;
}

export function PaperSummary({ paperId, initialBullets, initialEli5 }: PaperSummaryProps) {
  const [bullets, setBullets] = useState<string[] | null>(initialBullets || null);
  const [eli5, setEli5] = useState<string | null>(initialEli5 || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/papers/${paperId}/summary`);
      const data: SummaryData = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate summary");
      }

      if (data.configured === false) {
        setNotConfigured(true);
        return;
      }

      setBullets(data.bullets);
      setEli5(data.eli5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-pulse text-primary" />
            Generating Summary...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={generateSummary}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show not configured state
  if (notConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>AI summaries are not configured.</p>
            <p className="text-sm mt-1">
              Add your OpenRouter API key to enable AI-generated summaries.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show generate button if no summary
  if (!bullets && !eli5) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Generate an AI-powered summary of this paper's key contributions.
            </p>
            <Button onClick={generateSummary}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show summary
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Key Points
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={generateSummary}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {bullets && bullets.length > 0 && (
          <ul className="space-y-3">
            {bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-muted-foreground">{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function PaperEli5({ paperId, initialEli5 }: { paperId: string; initialEli5?: string | null }) {
  const [eli5, setEli5] = useState<string | null>(initialEli5 || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateEli5 = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/papers/${paperId}/summary`);
      const data: SummaryData = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate explanation");
      }

      setEli5(data.eli5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate explanation");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generating Simple Explanation...</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-2/3 mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={generateEli5}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!eli5) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Explain Like I'm 5</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Get a simple explanation that anyone can understand.
            </p>
            <Button onClick={generateEli5}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Explanation
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Explain Like I'm 5</CardTitle>
        <Button variant="ghost" size="sm" onClick={generateEli5}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed">{eli5}</p>
      </CardContent>
    </Card>
  );
}
