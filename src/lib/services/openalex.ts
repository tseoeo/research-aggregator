/**
 * OpenAlex API Service
 *
 * OpenAlex is a free, open catalog of the global research system.
 * It provides author information, works, affiliations, and some social links.
 *
 * API Docs: https://docs.openalex.org/
 * Free, no authentication required (but email for polite pool recommended)
 */

const OPENALEX_API = "https://api.openalex.org";

// Email for the "polite pool" - faster rate limits
const POLITE_EMAIL = process.env.OPENALEX_EMAIL || "research-aggregator@example.com";

export interface OpenAlexAuthor {
  id: string; // OpenAlex ID (e.g., "A1234567890")
  orcid?: string;
  displayName: string;
  worksCount: number;
  citedByCount: number;
  hIndex?: number;
  affiliations: {
    institution: string;
    country?: string;
    type?: string;
    years: number[];
  }[];
  topics: {
    name: string;
    count: number;
  }[];
  // External IDs
  ids: {
    openalex: string;
    orcid?: string;
    twitter?: string;
    wikipedia?: string;
    scopus?: string;
  };
}

export interface OpenAlexWork {
  id: string;
  title: string;
  publicationYear: number;
  citedByCount: number;
  doi?: string;
  openAccessUrl?: string;
}

export class OpenAlexService {
  /**
   * Search for authors by name
   */
  async searchAuthors(
    name: string,
    options: { limit?: number; institution?: string } = {}
  ): Promise<OpenAlexAuthor[]> {
    try {
      const { limit = 10, institution } = options;

      let filter = `display_name.search:${encodeURIComponent(name)}`;
      if (institution) {
        filter += `,last_known_institution.display_name.search:${encodeURIComponent(institution)}`;
      }

      const params = new URLSearchParams({
        filter,
        per_page: limit.toString(),
        mailto: POLITE_EMAIL,
      });

      const response = await fetch(
        `${OPENALEX_API}/authors?${params}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("[OpenAlex] Search failed:", response.status);
        return [];
      }

      const data = await response.json();

      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((author: any) => this.parseAuthor(author));
    } catch (error) {
      console.error("[OpenAlex] Search error:", error);
      return [];
    }
  }

  /**
   * Get author by OpenAlex ID
   */
  async getAuthor(openalexId: string): Promise<OpenAlexAuthor | null> {
    try {
      // Clean ID - accept either full URL or just ID
      const id = openalexId.replace("https://openalex.org/", "");

      const response = await fetch(
        `${OPENALEX_API}/authors/${id}?mailto=${POLITE_EMAIL}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseAuthor(data);
    } catch (error) {
      console.error("[OpenAlex] Get author error:", error);
      return null;
    }
  }

  /**
   * Get author by ORCID
   */
  async getAuthorByOrcid(orcid: string): Promise<OpenAlexAuthor | null> {
    try {
      // Clean ORCID
      const cleanOrcid = orcid.replace(/https?:\/\/orcid\.org\//, "");

      const response = await fetch(
        `${OPENALEX_API}/authors/orcid:${cleanOrcid}?mailto=${POLITE_EMAIL}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseAuthor(data);
    } catch (error) {
      console.error("[OpenAlex] Get author by ORCID error:", error);
      return null;
    }
  }

  /**
   * Get recent works by an author
   */
  async getAuthorWorks(
    openalexId: string,
    limit: number = 10
  ): Promise<OpenAlexWork[]> {
    try {
      const id = openalexId.replace("https://openalex.org/", "");

      const params = new URLSearchParams({
        filter: `author.id:${id}`,
        sort: "publication_year:desc",
        per_page: limit.toString(),
        mailto: POLITE_EMAIL,
      });

      const response = await fetch(
        `${OPENALEX_API}/works?${params}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((work: any) => ({
        id: work.id?.replace("https://openalex.org/", "") || "",
        title: work.title || "Untitled",
        publicationYear: work.publication_year || 0,
        citedByCount: work.cited_by_count || 0,
        doi: work.doi,
        openAccessUrl: work.open_access?.oa_url,
      }));
    } catch (error) {
      console.error("[OpenAlex] Get works error:", error);
      return [];
    }
  }

  /**
   * Find author by matching paper title and author name
   */
  async findAuthorByPaper(
    authorName: string,
    paperTitle: string
  ): Promise<OpenAlexAuthor | null> {
    try {
      // First, search for the work
      const workParams = new URLSearchParams({
        filter: `title.search:${encodeURIComponent(paperTitle.slice(0, 100))}`,
        per_page: "5",
        mailto: POLITE_EMAIL,
      });

      const workResponse = await fetch(
        `${OPENALEX_API}/works?${workParams}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!workResponse.ok) {
        return null;
      }

      const workData = await workResponse.json();

      if (!workData.results || workData.results.length === 0) {
        return null;
      }

      // Look for the author in the work's authorships
      for (const work of workData.results) {
        const authorships = work.authorships || [];
        for (const authorship of authorships) {
          const authorDisplayName = authorship.author?.display_name || "";
          // Simple name matching (could be improved)
          if (
            authorDisplayName.toLowerCase().includes(authorName.toLowerCase()) ||
            authorName.toLowerCase().includes(authorDisplayName.toLowerCase())
          ) {
            const authorId = authorship.author?.id;
            if (authorId) {
              return this.getAuthor(authorId);
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error("[OpenAlex] Find author by paper error:", error);
      return null;
    }
  }

  /**
   * Parse OpenAlex author response
   */
  private parseAuthor(data: any): OpenAlexAuthor {
    const id = data.id?.replace("https://openalex.org/", "") || "";

    // Extract ORCID if available
    const orcid = data.orcid?.replace("https://orcid.org/", "");

    // Extract affiliations from last known institution and affiliations history
    const affiliations: OpenAlexAuthor["affiliations"] = [];

    // Current affiliation
    if (data.last_known_institution) {
      const inst = data.last_known_institution;
      affiliations.push({
        institution: inst.display_name || "Unknown",
        country: inst.country_code,
        type: inst.type,
        years: [new Date().getFullYear()],
      });
    }

    // Historical affiliations
    const affsByYear = data.affiliations || [];
    for (const aff of affsByYear) {
      if (aff.institution) {
        const existing = affiliations.find(
          (a) => a.institution === aff.institution.display_name
        );
        if (existing) {
          if (aff.years) {
            existing.years.push(...aff.years);
          }
        } else {
          affiliations.push({
            institution: aff.institution.display_name || "Unknown",
            country: aff.institution.country_code,
            type: aff.institution.type,
            years: aff.years || [],
          });
        }
      }
    }

    // Extract topics
    const topics: OpenAlexAuthor["topics"] = [];
    const topicsData = data.topics || data.x_concepts || [];
    for (const topic of topicsData.slice(0, 10)) {
      topics.push({
        name: topic.display_name || topic.name || "Unknown",
        count: topic.count || topic.score || 0,
      });
    }

    // Extract IDs
    const ids: OpenAlexAuthor["ids"] = {
      openalex: id,
      orcid,
      twitter: data.ids?.twitter,
      wikipedia: data.ids?.wikipedia,
      scopus: data.ids?.scopus,
    };

    return {
      id,
      orcid,
      displayName: data.display_name || "Unknown",
      worksCount: data.works_count || 0,
      citedByCount: data.cited_by_count || 0,
      hIndex: data.summary_stats?.h_index,
      affiliations,
      topics,
      ids,
    };
  }
}

// Export singleton instance
export const openAlexService = new OpenAlexService();
