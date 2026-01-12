"use client";

import { ExternalLink, Newspaper } from "lucide-react";
import type { NewsMention } from "../paper-list";

interface NewsTabProps {
  news?: NewsMention[];
}

export function NewsTab({ news }: NewsTabProps) {
  if (!news || news.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No news coverage yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {news.slice(0, 3).map((article) => (
        <a
          key={article.id}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 border rounded-lg p-3 hover:bg-muted/50 transition-colors"
        >
          {article.imageUrl ? (
            <img
              src={article.imageUrl}
              alt=""
              className="w-16 h-16 object-cover rounded flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
              <Newspaper className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium line-clamp-2">{article.title}</h4>
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            </div>
            {article.sourceName && (
              <p className="text-xs text-muted-foreground mt-1">
                {article.sourceName}
              </p>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
