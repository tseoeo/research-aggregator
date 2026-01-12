import { NextRequest, NextResponse } from "next/server";
import { openAlexService } from "@/lib/services/openalex";
import { orcidService } from "@/lib/services/orcid";

/**
 * GET /api/authors/search
 *
 * Search for authors by name.
 *
 * Query params:
 * - q: Search query (required)
 * - limit: Maximum results (default: 10, max: 25)
 * - institution: Filter by institution name
 * - source: Data source to search ("openalex" | "orcid" | "both", default: "openalex")
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get("q");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 25);
    const institution = searchParams.get("institution") || undefined;
    const source = searchParams.get("source") || "openalex";

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const results: {
      id: string;
      name: string;
      orcid?: string;
      affiliations: string[];
      worksCount?: number;
      citedByCount?: number;
      source: "openalex" | "orcid";
    }[] = [];

    // Search OpenAlex
    if (source === "openalex" || source === "both") {
      const openAlexAuthors = await openAlexService.searchAuthors(query, {
        limit,
        institution,
      });

      for (const author of openAlexAuthors) {
        results.push({
          id: author.id,
          name: author.displayName,
          orcid: author.orcid,
          affiliations: author.affiliations.map((a) => a.institution),
          worksCount: author.worksCount,
          citedByCount: author.citedByCount,
          source: "openalex",
        });
      }
    }

    // Search ORCID
    if (source === "orcid" || source === "both") {
      const orcidResults = await orcidService.searchByName(query, institution);

      for (const result of orcidResults.slice(0, limit)) {
        // Avoid duplicates when using both sources
        const exists = results.some(
          (r) => r.orcid === result.orcid || r.name.toLowerCase() === result.name.toLowerCase()
        );

        if (!exists) {
          results.push({
            id: result.orcid,
            name: result.name,
            orcid: result.orcid,
            affiliations: result.affiliations,
            source: "orcid",
          });
        }
      }
    }

    // Sort by citation count (if available) for relevance
    results.sort((a, b) => (b.citedByCount || 0) - (a.citedByCount || 0));

    return NextResponse.json({
      query,
      results: results.slice(0, limit),
      total: results.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error searching authors:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search authors" },
      { status: 500 }
    );
  }
}
