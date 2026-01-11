import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, ArrowLeft, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { userSavedPapers, papers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SaveButton } from "@/components/papers/save-button";

export default async function SavedPapersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/saved");
  }

  const savedPapers = await db
    .select({
      paperId: userSavedPapers.paperId,
      savedAt: userSavedPapers.savedAt,
      notes: userSavedPapers.notes,
      paper: {
        id: papers.id,
        externalId: papers.externalId,
        title: papers.title,
        abstract: papers.abstract,
        primaryCategory: papers.primaryCategory,
        publishedAt: papers.publishedAt,
        summaryBullets: papers.summaryBullets,
        pdfUrl: papers.pdfUrl,
      },
    })
    .from(userSavedPapers)
    .innerJoin(papers, eq(userSavedPapers.paperId, papers.id))
    .where(eq(userSavedPapers.userId, session.user.id!))
    .orderBy(desc(userSavedPapers.savedAt));

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
            <Bookmark className="h-6 w-6" />
            Saved Papers
          </h1>
          <p className="text-muted-foreground">
            {savedPapers.length} paper{savedPapers.length !== 1 ? "s" : ""} saved
          </p>
        </div>
      </div>

      {/* Saved papers list */}
      {savedPapers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No saved papers yet</h2>
            <p className="text-muted-foreground mb-4">
              Start saving papers to build your reading list.
            </p>
            <Button asChild>
              <Link href="/">Browse Papers</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {savedPapers.map(({ paper, savedAt, notes }) => (
            <Card key={paper.id} className="group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Category and saved time */}
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="font-mono">
                        {paper.primaryCategory}
                      </Badge>
                      <span className="text-muted-foreground">
                        Saved {savedAt ? formatDistanceToNow(savedAt, { addSuffix: true }) : "recently"}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="font-semibold text-lg">
                      <Link
                        href={`/papers/${paper.externalId}`}
                        className="hover:underline"
                      >
                        {paper.title}
                      </Link>
                    </h2>

                    {/* Summary bullets if available */}
                    {paper.summaryBullets && paper.summaryBullets.length > 0 && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {paper.summaryBullets.slice(0, 2).map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span className="line-clamp-1">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Notes if any */}
                    {notes && (
                      <p className="text-sm italic text-muted-foreground border-l-2 pl-3">
                        {notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {paper.pdfUrl && (
                      <Button variant="outline" size="icon" asChild>
                        <a
                          href={paper.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <SaveButton arxivId={paper.externalId} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
