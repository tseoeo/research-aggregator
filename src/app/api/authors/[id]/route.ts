import { NextRequest, NextResponse } from "next/server";
import { openAlexService } from "@/lib/services/openalex";
import { orcidService } from "@/lib/services/orcid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/authors/[id]
 *
 * Fetch author information by ID.
 * Supports OpenAlex IDs (A1234567890) and ORCID IDs (0000-0002-1234-5678).
 *
 * Query params:
 * - include_works: If "true", includes recent works (default: false)
 * - works_limit: Number of works to include (default: 10)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    const includeWorks = searchParams.get("include_works") === "true";
    const worksLimit = parseInt(searchParams.get("works_limit") || "10", 10);

    // Determine ID type
    const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(id);
    const isOpenAlex = /^A\d+$/i.test(id);

    if (!isOrcid && !isOpenAlex) {
      return NextResponse.json(
        { error: "Invalid author ID format. Use ORCID (0000-0002-1234-5678) or OpenAlex ID (A1234567890)" },
        { status: 400 }
      );
    }

    let openAlexAuthor = null;
    let orcidProfile = null;

    if (isOrcid) {
      // Fetch from both ORCID and OpenAlex
      const [orcidResult, openAlexResult] = await Promise.all([
        orcidService.getProfile(id),
        openAlexService.getAuthorByOrcid(id),
      ]);
      orcidProfile = orcidResult;
      openAlexAuthor = openAlexResult;
    } else {
      // Fetch from OpenAlex by ID
      openAlexAuthor = await openAlexService.getAuthor(id);

      // If OpenAlex has ORCID, also fetch ORCID profile
      if (openAlexAuthor?.orcid) {
        orcidProfile = await orcidService.getProfile(openAlexAuthor.orcid);
      }
    }

    if (!openAlexAuthor && !orcidProfile) {
      return NextResponse.json(
        { error: "Author not found" },
        { status: 404 }
      );
    }

    // Extract social links from ORCID
    const socialLinks = orcidProfile
      ? orcidService.extractSocialLinks(orcidProfile)
      : {};

    // Combine data
    const author = {
      // Identity
      id: openAlexAuthor?.id || id,
      orcid: orcidProfile?.orcid || openAlexAuthor?.orcid,
      name: orcidProfile?.name || openAlexAuthor?.displayName || "Unknown",
      otherNames: orcidProfile?.otherNames || [],
      biography: orcidProfile?.biography,

      // Academic metrics
      worksCount: openAlexAuthor?.worksCount,
      citedByCount: openAlexAuthor?.citedByCount,
      hIndex: openAlexAuthor?.hIndex,

      // Affiliations
      affiliations: combineAffiliations(orcidProfile, openAlexAuthor),

      // Topics/Keywords
      topics: combineTopics(orcidProfile, openAlexAuthor),

      // Social links
      social: {
        twitter: socialLinks.twitter || openAlexAuthor?.ids.twitter,
        bluesky: socialLinks.bluesky,
        github: socialLinks.github,
        linkedin: socialLinks.linkedin,
        website: socialLinks.website,
        wikipedia: openAlexAuthor?.ids.wikipedia,
        scopus: openAlexAuthor?.ids.scopus,
      },

      // Websites from ORCID
      websites: orcidProfile?.websites || [],

      // Source tracking
      sources: {
        openalex: !!openAlexAuthor,
        orcid: !!orcidProfile,
      },
    };

    // Optionally include works
    let works = null;
    if (includeWorks && openAlexAuthor) {
      works = await openAlexService.getAuthorWorks(openAlexAuthor.id, worksLimit);
    }

    return NextResponse.json({
      author,
      works,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching author:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch author" },
      { status: 500 }
    );
  }
}

/**
 * Combine affiliations from ORCID and OpenAlex
 */
function combineAffiliations(
  orcidProfile: Awaited<ReturnType<typeof orcidService.getProfile>>,
  openAlexAuthor: Awaited<ReturnType<typeof openAlexService.getAuthor>>
) {
  const affiliations: {
    institution: string;
    role?: string;
    country?: string;
    current: boolean;
    years?: number[];
  }[] = [];

  const seen = new Set<string>();

  // From ORCID (has role info)
  if (orcidProfile) {
    for (const aff of orcidProfile.affiliations) {
      const key = aff.organization.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        affiliations.push({
          institution: aff.organization,
          role: aff.role,
          current: aff.current,
        });
      }
    }
  }

  // From OpenAlex (has country info)
  if (openAlexAuthor) {
    for (const aff of openAlexAuthor.affiliations) {
      const key = aff.institution.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        affiliations.push({
          institution: aff.institution,
          country: aff.country,
          current: aff.years.includes(new Date().getFullYear()),
          years: aff.years,
        });
      }
    }
  }

  return affiliations;
}

/**
 * Combine topics/keywords from ORCID and OpenAlex
 */
function combineTopics(
  orcidProfile: Awaited<ReturnType<typeof orcidService.getProfile>>,
  openAlexAuthor: Awaited<ReturnType<typeof openAlexService.getAuthor>>
) {
  const topics = new Set<string>();

  // From ORCID keywords
  if (orcidProfile) {
    for (const kw of orcidProfile.keywords) {
      topics.add(kw);
    }
  }

  // From OpenAlex topics
  if (openAlexAuthor) {
    for (const topic of openAlexAuthor.topics.slice(0, 10)) {
      topics.add(topic.name);
    }
  }

  return Array.from(topics);
}
