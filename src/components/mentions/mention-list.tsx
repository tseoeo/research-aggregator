"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MentionCard } from "./mention-card";
import { RefreshCw, MessageSquare, AlertCircle } from "lucide-react";

type Platform = "bluesky" | "reddit" | "twitter";

interface Mention {
  id: string;
  platform: Platform;
  authorHandle: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  url: string;
  postedAt: string;
  likes: number;
  reposts: number;
  replies: number;
  subreddit?: string;
  postTitle?: string;
}

interface MentionsData {
  mentions: Record<Platform, Mention[]>;
  stats: {
    bluesky: number;
    reddit: number;
    twitter: number;
    total: number;
  };
}

interface MentionListProps {
  paperId: string;
}

export function MentionList({ paperId }: MentionListProps) {
  const [data, setData] = useState<MentionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchMentions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/papers/${paperId}/mentions?grouped=true`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch mentions");
      }

      setData(result);
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch mentions");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 animate-pulse" />
            Searching for mentions...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
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
          <Button variant="outline" size="sm" onClick={fetchMentions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Initial state - show fetch button
  if (!hasFetched || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Mentions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Search for discussions about this paper on social media.
            </p>
            <Button onClick={fetchMentions}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Find Mentions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No mentions found
  if (data.stats.total === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Social Mentions</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchMentions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No social mentions found yet.</p>
            <p className="text-sm mt-1">
              Check back later as discussions develop.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show mentions with tabs
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Social Mentions</CardTitle>
          <Badge variant="secondary">{data.stats.total}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchMentions}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              All ({data.stats.total})
            </TabsTrigger>
            {data.stats.bluesky > 0 && (
              <TabsTrigger value="bluesky">
                Bluesky ({data.stats.bluesky})
              </TabsTrigger>
            )}
            {data.stats.reddit > 0 && (
              <TabsTrigger value="reddit">
                Reddit ({data.stats.reddit})
              </TabsTrigger>
            )}
            {data.stats.twitter > 0 && (
              <TabsTrigger value="twitter">
                X ({data.stats.twitter})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="space-y-3">
            {[...data.mentions.bluesky, ...data.mentions.reddit, ...data.mentions.twitter]
              .sort((a, b) => (b.likes + b.reposts) - (a.likes + a.reposts))
              .slice(0, 20)
              .map((mention) => (
                <MentionCard key={mention.id} mention={mention} />
              ))}
          </TabsContent>

          <TabsContent value="bluesky" className="space-y-3">
            {data.mentions.bluesky.map((mention) => (
              <MentionCard key={mention.id} mention={mention} />
            ))}
          </TabsContent>

          <TabsContent value="reddit" className="space-y-3">
            {data.mentions.reddit.map((mention) => (
              <MentionCard key={mention.id} mention={mention} />
            ))}
          </TabsContent>

          <TabsContent value="twitter" className="space-y-3">
            {data.mentions.twitter.map((mention) => (
              <MentionCard key={mention.id} mention={mention} />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
