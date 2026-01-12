import { NextRequest, NextResponse } from "next/server";
import { authorDiscoveryService } from "@/lib/services/author-discovery";

/**
 * GET /api/authors/discover
 *
 * Discover author information from multiple sources.
 *
 * Query params:
 * - name: Author name (required)
 * - paper_title: Paper title for more accurate matching
 * - affiliation: Author's affiliation
 * - orcid: Known ORCID ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const name = searchParams.get("name");
    const paperTitle = searchParams.get("paper_title") || undefined;
    const affiliation = searchParams.get("affiliation") || undefined;
    const orcid = searchParams.get("orcid") || undefined;

    if (!name) {
      return NextResponse.json(
        { error: "Author name is required" },
        { status: 400 }
      );
    }

    const author = await authorDiscoveryService.discoverAuthor(name, {
      paperTitle,
      affiliation,
      orcid,
    });

    if (!author) {
      return NextResponse.json(
        { error: "Author not found", name },
        { status: 404 }
      );
    }

    return NextResponse.json({
      author,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error discovering author:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to discover author" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/authors/discover
 *
 * Batch discover authors for a paper.
 *
 * Body:
 * {
 *   "paper_title": "Paper title",
 *   "authors": [
 *     { "name": "Author Name", "affiliation": "University" },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { paper_title: paperTitle, authors } = body;

    if (!paperTitle || !Array.isArray(authors) || authors.length === 0) {
      return NextResponse.json(
        { error: "Paper title and authors array are required" },
        { status: 400 }
      );
    }

    // Validate authors array
    for (const author of authors) {
      if (!author.name) {
        return NextResponse.json(
          { error: "Each author must have a name" },
          { status: 400 }
        );
      }
    }

    // Limit batch size
    if (authors.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 authors per request" },
        { status: 400 }
      );
    }

    const results = await authorDiscoveryService.discoverAuthorsForPaper(
      authors.map((a: { name: string; affiliation?: string }) => ({
        name: a.name,
        affiliation: a.affiliation,
      })),
      paperTitle
    );

    // Convert Map to object for JSON response
    const authorsMap: Record<string, any> = {};
    for (const [name, author] of results.entries()) {
      authorsMap[name] = author;
    }

    const found = Array.from(results.values()).filter((a) => a !== null).length;
    const notFound = results.size - found;

    return NextResponse.json({
      paperTitle,
      authors: authorsMap,
      stats: {
        total: results.size,
        found,
        notFound,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error batch discovering authors:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to discover authors" },
      { status: 500 }
    );
  }
}
