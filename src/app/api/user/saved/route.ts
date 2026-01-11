import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userSavedPapers, papers, paperSources } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { arxivService } from "@/lib/services/arxiv";

/**
 * GET /api/user/saved
 *
 * Get all saved papers for the current user.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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
          pdfUrl: papers.pdfUrl,
          summaryBullets: papers.summaryBullets,
        },
      })
      .from(userSavedPapers)
      .innerJoin(papers, eq(userSavedPapers.paperId, papers.id))
      .where(eq(userSavedPapers.userId, session.user.id))
      .orderBy(desc(userSavedPapers.savedAt));

    return NextResponse.json({
      papers: savedPapers,
      count: savedPapers.length,
    });
  } catch (error) {
    console.error("Error fetching saved papers:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved papers" },
      { status: 500 }
    );
  }
}

/**
 * Ensure arXiv source exists in database
 */
async function ensureArxivSource(): Promise<number> {
  const existing = await db
    .select({ id: paperSources.id })
    .from(paperSources)
    .where(eq(paperSources.name, "arxiv"))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const result = await db
    .insert(paperSources)
    .values({
      name: "arxiv",
      baseUrl: "https://arxiv.org",
      isActive: true,
    })
    .returning({ id: paperSources.id });

  return result[0].id;
}

/**
 * Get or create paper from arXiv ID
 */
async function getOrCreatePaper(arxivId: string): Promise<string | null> {
  // Check if paper exists
  const existing = await db
    .select({ id: papers.id })
    .from(papers)
    .innerJoin(paperSources, eq(papers.sourceId, paperSources.id))
    .where(and(eq(paperSources.name, "arxiv"), eq(papers.externalId, arxivId)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Fetch from arXiv and create
  try {
    const paper = await arxivService.fetchPaperById(arxivId);
    if (!paper) {
      return null;
    }

    const sourceId = await ensureArxivSource();

    const result = await db
      .insert(papers)
      .values({
        sourceId,
        externalId: arxivId,
        title: paper.title,
        abstract: paper.abstract,
        publishedAt: paper.publishedAt,
        updatedAt: paper.updatedAt,
        pdfUrl: paper.pdfUrl,
        categories: paper.categories,
        primaryCategory: paper.primaryCategory,
      })
      .returning({ id: papers.id });

    return result[0].id;
  } catch (error) {
    console.error("Error creating paper:", error);
    return null;
  }
}

/**
 * POST /api/user/saved
 *
 * Save a paper for the current user.
 *
 * Body: { arxivId: string, notes?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { arxivId, notes } = body;

    if (!arxivId) {
      return NextResponse.json(
        { error: "arXiv ID is required" },
        { status: 400 }
      );
    }

    // Get or create paper
    const paperId = await getOrCreatePaper(arxivId);

    if (!paperId) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    // Check if already saved
    const existing = await db
      .select()
      .from(userSavedPapers)
      .where(
        and(
          eq(userSavedPapers.userId, session.user.id),
          eq(userSavedPapers.paperId, paperId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Paper already saved" },
        { status: 409 }
      );
    }

    // Save the paper
    await db.insert(userSavedPapers).values({
      userId: session.user.id,
      paperId,
      notes: notes || null,
    });

    return NextResponse.json({
      message: "Paper saved successfully",
      arxivId,
      paperId,
    });
  } catch (error) {
    console.error("Error saving paper:", error);
    return NextResponse.json(
      { error: "Failed to save paper" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/saved
 *
 * Remove a saved paper for the current user.
 *
 * Body: { arxivId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { arxivId } = body;

    if (!arxivId) {
      return NextResponse.json(
        { error: "arXiv ID is required" },
        { status: 400 }
      );
    }

    // Find paper by arXiv ID
    const paper = await db
      .select({ id: papers.id })
      .from(papers)
      .innerJoin(paperSources, eq(papers.sourceId, paperSources.id))
      .where(and(eq(paperSources.name, "arxiv"), eq(papers.externalId, arxivId)))
      .limit(1);

    if (paper.length === 0) {
      return NextResponse.json({
        message: "Paper not found or not saved",
        arxivId,
      });
    }

    await db
      .delete(userSavedPapers)
      .where(
        and(
          eq(userSavedPapers.userId, session.user.id),
          eq(userSavedPapers.paperId, paper[0].id)
        )
      );

    return NextResponse.json({
      message: "Paper removed from saved",
      arxivId,
    });
  } catch (error) {
    console.error("Error removing saved paper:", error);
    return NextResponse.json(
      { error: "Failed to remove paper" },
      { status: 500 }
    );
  }
}
