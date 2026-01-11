"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, AlertCircle } from "lucide-react";
import { NewsCard } from "./news-card";

interface NewsArticle {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date?: string;
  imageUrl?: string;
  urlHash: string;
}

interface NewsListProps {
  paperId: string;
}

export function NewsList({ paperId }: NewsListProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/papers/${paperId}/news`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch news");
        }

        setNews(data.news || []);
        setEnabled(data.enabled !== false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [paperId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="w-24 h-24 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              News search is not configured. Contact the administrator to enable this feature.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          News Coverage
          {news.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({news.length} article{news.length !== 1 ? "s" : ""})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {news.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No news coverage found for this paper yet.
          </p>
        ) : (
          <div className="space-y-4">
            {news.map((article) => (
              <NewsCard
                key={article.urlHash}
                title={article.title}
                snippet={article.snippet}
                url={article.url}
                source={article.source}
                date={article.date}
                imageUrl={article.imageUrl}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
