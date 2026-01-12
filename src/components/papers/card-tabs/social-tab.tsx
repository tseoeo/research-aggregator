"use client";

import { Heart, MessageCircle, Repeat2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SocialMention } from "../paper-list";

interface SocialTabProps {
  mentions?: SocialMention[];
}

const platformColors: Record<string, string> = {
  bluesky: "bg-blue-500",
  reddit: "bg-orange-500",
  twitter: "bg-sky-500",
};

export function SocialTab({ mentions }: SocialTabProps) {
  if (!mentions || mentions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No social mentions yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {mentions.slice(0, 5).map((mention) => (
        <div
          key={mention.id}
          className="border rounded-lg p-3 text-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={`${platformColors[mention.platformName] || "bg-gray-500"} text-white text-xs`}
              >
                {mention.platformName}
              </Badge>
              {mention.authorHandle && (
                <span className="text-muted-foreground">
                  @{mention.authorHandle}
                </span>
              )}
            </div>
            <a
              href={mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {mention.content && (
            <p className="text-muted-foreground line-clamp-2">
              {mention.content}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {mention.likes || 0}
            </span>
            <span className="flex items-center gap-1">
              <Repeat2 className="h-3 w-3" />
              {mention.reposts || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {mention.replies || 0}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
