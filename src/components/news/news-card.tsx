"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Newspaper } from "lucide-react";

interface NewsCardProps {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date?: string;
  imageUrl?: string;
}

export function NewsCard({
  title,
  snippet,
  url,
  source,
  date,
  imageUrl,
}: NewsCardProps) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image */}
          {imageUrl && (
            <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden bg-muted">
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Source and date */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Newspaper className="h-3 w-3" />
              <span className="font-medium">{source}</span>
              {date && (
                <>
                  <span>•</span>
                  <span>{date}</span>
                </>
              )}
            </div>

            {/* Title */}
            <h3 className="font-medium leading-tight">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-start gap-1"
              >
                <span className="line-clamp-2">{title}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </h3>

            {/* Snippet */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {snippet}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
