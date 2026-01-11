/**
 * Author Discovery Service
 *
 * Discovers author information by combining data from multiple sources:
 * - ORCID (primary identifier, often has social links)
 * - OpenAlex (publication data, affiliations, h-index)
 * - Bluesky (direct search for author)
 */

import { orcidService, OrcidProfile } from "./orcid";
import { openAlexService, OpenAlexAuthor } from "./openalex";
import { blueskyService } from "./bluesky";

export interface DiscoveredAuthor {
  // Basic info
  name: string;
  normalizedName: string;

  // External IDs
  orcid?: string;
  openalexId?: string;

  // Social handles
  twitterHandle?: string;
  blueskyHandle?: string;
  githubHandle?: string;
  linkedinUrl?: string;
  personalWebsite?: string;

  // Academic info
  affiliations: {
    institution: string;
    country?: string;
    current: boolean;
  }[];
  topics: string[];
  worksCount?: number;
  citedByCount?: number;
  hIndex?: number;

  // Source tracking
  sources: ("orcid" | "openalex" | "bluesky")[];
  discoveredAt: Date;
}

/**
 * Normalize author name for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z\s]/g, "") // Remove non-letters
    .replace(/\s+/g, " ")
    .trim();
}

export class AuthorDiscoveryService {
  /**
   * Discover author information from all available sources
   */
  async discoverAuthor(
    name: string,
    options: {
      paperTitle?: string;
      affiliation?: string;
      orcid?: string;
    } = {}
  ): Promise<DiscoveredAuthor | null> {
    const { paperTitle, affiliation, orcid } = options;
    const sources: DiscoveredAuthor["sources"] = [];

    let orcidProfile: OrcidProfile | null = null;
    let openAlexAuthor: OpenAlexAuthor | null = null;

    // If we have an ORCID, use it directly
    if (orcid) {
      orcidProfile = await orcidService.getProfile(orcid);
      if (orcidProfile) {
        sources.push("orcid");
      }
    }

    // Try to find in OpenAlex
    if (paperTitle) {
      // Use paper title to find specific author
      openAlexAuthor = await openAlexService.findAuthorByPaper(name, paperTitle);
    }

    if (!openAlexAuthor) {
      // Search by name
      const openAlexResults = await openAlexService.searchAuthors(name, {
        limit: 5,
        institution: affiliation,
      });

      if (openAlexResults.length > 0) {
        // Pick the best match (highest citation count as proxy for relevance)
        openAlexAuthor = openAlexResults.sort(
          (a, b) => b.citedByCount - a.citedByCount
        )[0];
      }
    }

    if (openAlexAuthor) {
      sources.push("openalex");

      // If OpenAlex has ORCID and we don't have profile yet, fetch it
      if (openAlexAuthor.orcid && !orcidProfile) {
        orcidProfile = await orcidService.getProfile(openAlexAuthor.orcid);
        if (orcidProfile) {
          sources.push("orcid");
        }
      }
    }

    // If we still don't have an ORCID profile, search ORCID by name
    if (!orcidProfile) {
      const orcidResults = await orcidService.searchByName(name, affiliation);
      if (orcidResults.length > 0) {
        orcidProfile = await orcidService.getProfile(orcidResults[0].orcid);
        if (orcidProfile) {
          sources.push("orcid");
        }
      }
    }

    // If we found nothing, return null
    if (!orcidProfile && !openAlexAuthor) {
      return null;
    }

    // Combine data from all sources
    const author = this.combineAuthorData(name, orcidProfile, openAlexAuthor);
    author.sources = sources;

    // Try to find Bluesky handle if not already found
    if (!author.blueskyHandle) {
      const blueskyHandle = await this.searchBlueskyForAuthor(name, affiliation);
      if (blueskyHandle) {
        author.blueskyHandle = blueskyHandle;
        if (!author.sources.includes("bluesky")) {
          author.sources.push("bluesky");
        }
      }
    }

    return author;
  }

  /**
   * Combine author data from ORCID and OpenAlex
   */
  private combineAuthorData(
    searchName: string,
    orcidProfile: OrcidProfile | null,
    openAlexAuthor: OpenAlexAuthor | null
  ): DiscoveredAuthor {
    // Prefer ORCID name, fallback to OpenAlex, then search name
    const name =
      orcidProfile?.name || openAlexAuthor?.displayName || searchName;

    // Extract social links from ORCID
    const socialLinks = orcidProfile
      ? orcidService.extractSocialLinks(orcidProfile)
      : {};

    // Combine affiliations
    const affiliationsMap = new Map<
      string,
      { institution: string; country?: string; current: boolean }
    >();

    // From ORCID
    if (orcidProfile) {
      for (const aff of orcidProfile.affiliations) {
        affiliationsMap.set(aff.organization, {
          institution: aff.organization,
          current: aff.current,
        });
      }
    }

    // From OpenAlex
    if (openAlexAuthor) {
      for (const aff of openAlexAuthor.affiliations) {
        if (!affiliationsMap.has(aff.institution)) {
          affiliationsMap.set(aff.institution, {
            institution: aff.institution,
            country: aff.country,
            current: aff.years.includes(new Date().getFullYear()),
          });
        }
      }
    }

    // Combine topics
    const topics = new Set<string>();
    if (orcidProfile) {
      for (const kw of orcidProfile.keywords) {
        topics.add(kw);
      }
    }
    if (openAlexAuthor) {
      for (const topic of openAlexAuthor.topics.slice(0, 5)) {
        topics.add(topic.name);
      }
    }

    return {
      name,
      normalizedName: normalizeName(name),
      orcid: orcidProfile?.orcid || openAlexAuthor?.orcid,
      openalexId: openAlexAuthor?.id,
      twitterHandle: socialLinks.twitter || openAlexAuthor?.ids.twitter,
      blueskyHandle: socialLinks.bluesky,
      githubHandle: socialLinks.github,
      linkedinUrl: socialLinks.linkedin,
      personalWebsite: socialLinks.website,
      affiliations: Array.from(affiliationsMap.values()),
      topics: Array.from(topics),
      worksCount: openAlexAuthor?.worksCount,
      citedByCount: openAlexAuthor?.citedByCount,
      hIndex: openAlexAuthor?.hIndex,
      sources: [],
      discoveredAt: new Date(),
    };
  }

  /**
   * Search Bluesky for an author's account
   */
  private async searchBlueskyForAuthor(
    name: string,
    affiliation?: string
  ): Promise<string | null> {
    try {
      // Search for posts by the author about their research
      const query = affiliation
        ? `from:* "${name}" ${affiliation}`
        : `"${name}" researcher OR professor OR scientist`;

      const posts = await blueskyService.searchPosts(query, 5);

      // Look for accounts that might be the researcher
      // (very basic heuristic - could be improved with AI)
      for (const post of posts) {
        const handleLower = post.authorHandle.toLowerCase();
        const nameParts = name.toLowerCase().split(" ");

        // Check if handle contains parts of the name
        const matchScore = nameParts.reduce((score, part) => {
          if (part.length > 2 && handleLower.includes(part)) {
            return score + 1;
          }
          return score;
        }, 0);

        if (matchScore >= 2 || handleLower.includes(nameParts.join(""))) {
          return post.authorHandle;
        }
      }

      return null;
    } catch (error) {
      console.error("[AuthorDiscovery] Bluesky search error:", error);
      return null;
    }
  }

  /**
   * Batch discover authors for a paper
   */
  async discoverAuthorsForPaper(
    authors: { name: string; affiliation?: string }[],
    paperTitle: string
  ): Promise<Map<string, DiscoveredAuthor | null>> {
    const results = new Map<string, DiscoveredAuthor | null>();

    // Process in parallel with concurrency limit
    const batchSize = 3;
    for (let i = 0; i < authors.length; i += batchSize) {
      const batch = authors.slice(i, i + batchSize);
      const promises = batch.map(async (author) => {
        const discovered = await this.discoverAuthor(author.name, {
          paperTitle,
          affiliation: author.affiliation,
        });
        return { name: author.name, discovered };
      });

      const batchResults = await Promise.allSettled(promises);
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.set(result.value.name, result.value.discovered);
        }
      }

      // Small delay between batches to be nice to APIs
      if (i + batchSize < authors.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }
}

// Export singleton instance
export const authorDiscoveryService = new AuthorDiscoveryService();
