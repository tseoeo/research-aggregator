"use client";

import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, MessageCircle, Repeat2, ExternalLink } from "lucide-react";

type Platform = "bluesky" | "reddit" | "twitter";

interface MentionCardProps {
  mention: {
    id: string;
    platform: Platform;
    authorHandle: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    url: string;
    postedAt: Date | string;
    likes: number;
    reposts: number;
    replies: number;
    subreddit?: string;
    postTitle?: string;
  };
}

const platformColors: Record<Platform, string> = {
  bluesky: "bg-blue-500",
  reddit: "bg-orange-500",
  twitter: "bg-sky-400",
};

const platformNames: Record<Platform, string> = {
  bluesky: "Bluesky",
  reddit: "Reddit",
  twitter: "X/Twitter",
};

export function MentionCard({ mention }: MentionCardProps) {
  const postedAt =
    mention.postedAt instanceof Date
      ? mention.postedAt
      : new Date(mention.postedAt);

  const timeAgo = formatDistanceToNow(postedAt, { addSuffix: true });

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="pt-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={mention.authorAvatar} alt={mention.authorName} />
            <AvatarFallback>
              {mention.authorName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{mention.authorName}</span>
              <span className="text-muted-foreground text-sm">
                @{mention.authorHandle}
              </span>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-muted-foreground text-sm">{timeAgo}</span>
              <Badge
                variant="secondary"
                className={`${platformColors[mention.platform]} text-white text-xs`}
              >
                {platformNames[mention.platform]}
              </Badge>
            </div>

            {/* Reddit subreddit */}
            {mention.subreddit && (
              <div className="text-sm text-muted-foreground mt-1">
                r/{mention.subreddit}
                {mention.postTitle && (
                  <span className="font-medium ml-1">· {mention.postTitle}</span>
                )}
              </div>
            )}

            {/* Content */}
            <p className="mt-2 text-sm whitespace-pre-wrap break-words">
              {mention.content.length > 500
                ? `${mention.content.slice(0, 500)}...`
                : mention.content}
            </p>

            {/* Footer - Engagement */}
            <div className="flex items-center gap-4 mt-3 text-muted-foreground">
              <div className="flex items-center gap-1 text-sm">
                <Heart className="h-4 w-4" />
                <span>{mention.likes}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Repeat2 className="h-4 w-4" />
                <span>{mention.reposts}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <MessageCircle className="h-4 w-4" />
                <span>{mention.replies}</span>
              </div>
              <a
                href={mention.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm hover:text-foreground transition-colors ml-auto"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View</span>
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
