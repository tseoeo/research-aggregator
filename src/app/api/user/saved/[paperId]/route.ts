import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userSavedPapers, papers, paperSources } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ paperId: string }>;
}

/**
 * GET /api/user/saved/[paperId]
 *
 * Check if a paper is saved by the current user.
 * paperId can be either a database UUID or an arXiv ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { paperId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({
        saved: false,
        authenticated: false,
      });
    }

    // Check if paperId looks like a UUID or arXiv ID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paperId);

    let dbPaperId: string | null = null;

    if (isUuid) {
      dbPaperId = paperId;
    } else {
      // Look up by arXiv ID
      const paper = await db
        .select({ id: papers.id })
        .from(papers)
        .innerJoin(paperSources, eq(papers.sourceId, paperSources.id))
        .where(and(eq(paperSources.name, "arxiv"), eq(papers.externalId, paperId)))
        .limit(1);

      if (paper.length > 0) {
        dbPaperId = paper[0].id;
      }
    }

    if (!dbPaperId) {
      return NextResponse.json({
        saved: false,
        authenticated: true,
      });
    }

    const saved = await db
      .select()
      .from(userSavedPapers)
      .where(
        and(
          eq(userSavedPapers.userId, session.user.id),
          eq(userSavedPapers.paperId, dbPaperId)
        )
      )
      .limit(1);

    return NextResponse.json({
      saved: saved.length > 0,
      authenticated: true,
      notes: saved[0]?.notes || null,
      savedAt: saved[0]?.savedAt || null,
    });
  } catch (error) {
    console.error("Error checking saved status:", error);
    return NextResponse.json(
      { error: "Failed to check saved status" },
      { status: 500 }
    );
  }
}
