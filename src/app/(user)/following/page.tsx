import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { userFollowedAuthors, authors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { AuthorSocialLinks } from "@/components/authors";

export default async function FollowingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/following");
  }

  const followedAuthors = await db
    .select({
      authorId: userFollowedAuthors.authorId,
      followedAt: userFollowedAuthors.followedAt,
      author: {
        id: authors.id,
        name: authors.name,
        orcid: authors.orcid,
        openalexId: authors.openalexId,
        twitterHandle: authors.twitterHandle,
        blueskyHandle: authors.blueskyHandle,
        githubHandle: authors.githubHandle,
        linkedinUrl: authors.linkedinUrl,
        personalWebsite: authors.personalWebsite,
      },
    })
    .from(userFollowedAuthors)
    .innerJoin(authors, eq(userFollowedAuthors.authorId, authors.id))
    .where(eq(userFollowedAuthors.userId, session.user.id!))
    .orderBy(desc(userFollowedAuthors.followedAt));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Following
          </h1>
          <p className="text-muted-foreground">
            {followedAuthors.length} author{followedAuthors.length !== 1 ? "s" : ""} followed
          </p>
        </div>
      </div>

      {/* Following list */}
      {followedAuthors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Not following anyone yet</h2>
            <p className="text-muted-foreground mb-4">
              Follow authors to stay updated on their latest research.
            </p>
            <Button asChild>
              <Link href="/">Browse Papers</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {followedAuthors.map(({ author, followedAt }) => (
            <Card key={author.id} className="group">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {/* Author name */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">{author.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        Following since{" "}
                        {followedAt
                          ? formatDistanceToNow(followedAt, { addSuffix: true })
                          : "recently"}
                      </p>
                    </div>
                    {(author.openalexId || author.orcid) && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/authors/${author.openalexId || author.orcid}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>

                  {/* Social links */}
                  <AuthorSocialLinks
                    social={{
                      twitter: author.twitterHandle || undefined,
                      bluesky: author.blueskyHandle || undefined,
                      github: author.githubHandle || undefined,
                      linkedin: author.linkedinUrl || undefined,
                      website: author.personalWebsite || undefined,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
