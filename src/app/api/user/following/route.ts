import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userFollowedAuthors, authors } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/user/following
 *
 * Get all followed authors for the current user.
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
        },
      })
      .from(userFollowedAuthors)
      .innerJoin(authors, eq(userFollowedAuthors.authorId, authors.id))
      .where(eq(userFollowedAuthors.userId, session.user.id))
      .orderBy(desc(userFollowedAuthors.followedAt));

    return NextResponse.json({
      authors: followedAuthors,
      count: followedAuthors.length,
    });
  } catch (error) {
    console.error("Error fetching followed authors:", error);
    return NextResponse.json(
      { error: "Failed to fetch followed authors" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/following
 *
 * Follow an author.
 *
 * Body: { authorId: string } - Database author ID or will create from provided data
 * OR
 * Body: { openalexId?: string, orcid?: string, name: string } - Create author if needed
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
    const { authorId, openalexId, orcid, name } = body;

    let dbAuthorId = authorId;

    // If no authorId provided, try to find or create author
    if (!dbAuthorId) {
      if (!name) {
        return NextResponse.json(
          { error: "Author ID or name is required" },
          { status: 400 }
        );
      }

      // Try to find by OpenAlex ID or ORCID
      let existingAuthor = null;

      if (openalexId) {
        const result = await db
          .select({ id: authors.id })
          .from(authors)
          .where(eq(authors.openalexId, openalexId))
          .limit(1);
        if (result.length > 0) {
          existingAuthor = result[0];
        }
      }

      if (!existingAuthor && orcid) {
        const result = await db
          .select({ id: authors.id })
          .from(authors)
          .where(eq(authors.orcid, orcid))
          .limit(1);
        if (result.length > 0) {
          existingAuthor = result[0];
        }
      }

      if (existingAuthor) {
        dbAuthorId = existingAuthor.id;
      } else {
        // Create new author
        const normalizedName = name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();

        const result = await db
          .insert(authors)
          .values({
            name,
            normalizedName,
            openalexId: openalexId || null,
            orcid: orcid || null,
          })
          .returning({ id: authors.id });

        dbAuthorId = result[0].id;
      }
    }

    // Check if already following
    const existing = await db
      .select()
      .from(userFollowedAuthors)
      .where(
        and(
          eq(userFollowedAuthors.userId, session.user.id),
          eq(userFollowedAuthors.authorId, dbAuthorId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Already following this author" },
        { status: 409 }
      );
    }

    // Follow the author
    await db.insert(userFollowedAuthors).values({
      userId: session.user.id,
      authorId: dbAuthorId,
    });

    return NextResponse.json({
      message: "Author followed successfully",
      authorId: dbAuthorId,
    });
  } catch (error) {
    console.error("Error following author:", error);
    return NextResponse.json(
      { error: "Failed to follow author" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/following
 *
 * Unfollow an author.
 *
 * Body: { authorId: string }
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
    const { authorId } = body;

    if (!authorId) {
      return NextResponse.json(
        { error: "Author ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(userFollowedAuthors)
      .where(
        and(
          eq(userFollowedAuthors.userId, session.user.id),
          eq(userFollowedAuthors.authorId, authorId)
        )
      );

    return NextResponse.json({
      message: "Author unfollowed",
      authorId,
    });
  } catch (error) {
    console.error("Error unfollowing author:", error);
    return NextResponse.json(
      { error: "Failed to unfollow author" },
      { status: 500 }
    );
  }
}
