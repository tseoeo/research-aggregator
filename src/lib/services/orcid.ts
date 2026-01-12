/**
 * ORCID API Service
 *
 * Looks up researcher profiles using ORCID (Open Researcher and Contributor ID).
 * ORCID provides unique identifiers for researchers and often links to social profiles.
 *
 * API Docs: https://info.orcid.org/documentation/api-tutorials/
 * Public API (no auth required for reading public profiles)
 */

const ORCID_API = "https://pub.orcid.org/v3.0";

export interface OrcidProfile {
  orcid: string;
  name: string;
  otherNames: string[];
  biography?: string;
  emails: string[];
  affiliations: {
    organization: string;
    role?: string;
    startYear?: number;
    endYear?: number;
    current: boolean;
  }[];
  externalIds: {
    type: string;
    value: string;
    url?: string;
  }[];
  websites: {
    name?: string;
    url: string;
  }[];
  keywords: string[];
}

interface OrcidSearchResult {
  orcid: string;
  name: string;
  affiliations: string[];
}

export class OrcidService {
  /**
   * Search for researchers by name
   */
  async searchByName(
    name: string,
    affiliation?: string
  ): Promise<OrcidSearchResult[]> {
    try {
      // Build search query
      let query = `family-name:${name.split(" ").pop()} OR given-names:${name.split(" ")[0]}`;
      if (affiliation) {
        query += ` AND affiliation-org-name:${affiliation}`;
      }

      const params = new URLSearchParams({
        q: query,
        rows: "10",
      });

      const response = await fetch(
        `${ORCID_API}/search?${params}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("[ORCID] Search failed:", response.status);
        return [];
      }

      const data = await response.json();

      if (!data.result || !Array.isArray(data.result)) {
        return [];
      }

      return data.result.map((item: any) => ({
        orcid: item["orcid-identifier"]?.path || "",
        name: this.extractName(item),
        affiliations: this.extractAffiliations(item),
      }));
    } catch (error) {
      console.error("[ORCID] Search error:", error);
      return [];
    }
  }

  /**
   * Get full profile by ORCID ID
   */
  async getProfile(orcidId: string): Promise<OrcidProfile | null> {
    try {
      // Clean ORCID ID
      const cleanId = orcidId.replace(/https?:\/\/orcid\.org\//, "");

      const response = await fetch(
        `${ORCID_API}/${cleanId}/record`,
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
        throw new Error(`ORCID API error: ${response.status}`);
      }

      const data = await response.json();

      return this.parseProfile(cleanId, data);
    } catch (error) {
      console.error("[ORCID] Get profile error:", error);
      return null;
    }
  }

  /**
   * Extract name from search result
   */
  private extractName(item: any): string {
    const person = item["orcid-identifier"];
    if (!person) return "Unknown";

    // Try to get from the record summary if available
    return person.path || "Unknown";
  }

  /**
   * Extract affiliations from search result
   */
  private extractAffiliations(item: any): string[] {
    // Affiliations aren't included in search results
    // Need to fetch full profile for that
    return [];
  }

  /**
   * Parse full ORCID profile
   */
  private parseProfile(orcidId: string, data: any): OrcidProfile {
    const person = data.person || {};
    const activities = data["activities-summary"] || {};

    // Extract name
    const nameData = person.name || {};
    const givenNames = nameData["given-names"]?.value || "";
    const familyName = nameData["family-name"]?.value || "";
    const name = `${givenNames} ${familyName}`.trim() || "Unknown";

    // Extract other names
    const otherNames: string[] = [];
    const otherNamesData = person["other-names"]?.["other-name"] || [];
    for (const other of otherNamesData) {
      if (other.content) {
        otherNames.push(other.content);
      }
    }

    // Extract biography
    const biography = person.biography?.content;

    // Extract emails (public only)
    const emails: string[] = [];
    const emailsData = person.emails?.email || [];
    for (const email of emailsData) {
      if (email.email) {
        emails.push(email.email);
      }
    }

    // Extract affiliations
    const affiliations: OrcidProfile["affiliations"] = [];
    const employments = activities.employments?.["affiliation-group"] || [];
    for (const group of employments) {
      const summaries = group.summaries || [];
      for (const summary of summaries) {
        const emp = summary["employment-summary"];
        if (emp) {
          affiliations.push({
            organization: emp.organization?.name || "Unknown",
            role: emp["role-title"],
            startYear: emp["start-date"]?.year?.value
              ? parseInt(emp["start-date"].year.value)
              : undefined,
            endYear: emp["end-date"]?.year?.value
              ? parseInt(emp["end-date"].year.value)
              : undefined,
            current: !emp["end-date"],
          });
        }
      }
    }

    // Extract external IDs (Scopus, ResearcherID, etc.)
    const externalIds: OrcidProfile["externalIds"] = [];
    const extIdsData = person["external-identifiers"]?.["external-identifier"] || [];
    for (const extId of extIdsData) {
      externalIds.push({
        type: extId["external-id-type"] || "unknown",
        value: extId["external-id-value"] || "",
        url: extId["external-id-url"]?.value,
      });
    }

    // Extract websites/URLs (often includes social profiles)
    const websites: OrcidProfile["websites"] = [];
    const urlsData = person["researcher-urls"]?.["researcher-url"] || [];
    for (const url of urlsData) {
      websites.push({
        name: url["url-name"],
        url: url.url?.value || "",
      });
    }

    // Extract keywords
    const keywords: string[] = [];
    const keywordsData = person.keywords?.keyword || [];
    for (const kw of keywordsData) {
      if (kw.content) {
        keywords.push(kw.content);
      }
    }

    return {
      orcid: orcidId,
      name,
      otherNames,
      biography,
      emails,
      affiliations,
      externalIds,
      websites,
      keywords,
    };
  }

  /**
   * Extract social links from ORCID profile
   */
  extractSocialLinks(profile: OrcidProfile): {
    twitter?: string;
    github?: string;
    linkedin?: string;
    website?: string;
    bluesky?: string;
  } {
    const links: {
      twitter?: string;
      github?: string;
      linkedin?: string;
      website?: string;
      bluesky?: string;
    } = {};

    for (const site of profile.websites) {
      const url = site.url.toLowerCase();
      const name = (site.name || "").toLowerCase();

      if (url.includes("twitter.com") || url.includes("x.com")) {
        links.twitter = this.extractHandle(site.url, ["twitter.com", "x.com"]);
      } else if (url.includes("github.com")) {
        links.github = this.extractHandle(site.url, ["github.com"]);
      } else if (url.includes("linkedin.com")) {
        links.linkedin = site.url;
      } else if (url.includes("bsky.app") || name.includes("bluesky")) {
        links.bluesky = this.extractHandle(site.url, ["bsky.app/profile"]);
      } else if (!links.website && !url.includes("orcid.org")) {
        // First non-social URL becomes personal website
        links.website = site.url;
      }
    }

    return links;
  }

  /**
   * Extract handle from social URL
   */
  private extractHandle(url: string, domains: string[]): string {
    try {
      for (const domain of domains) {
        if (url.includes(domain)) {
          const parts = url.split(domain)[1];
          const handle = parts.replace(/^\/+/, "").split("/")[0].split("?")[0];
          return handle;
        }
      }
    } catch {
      // Ignore parsing errors
    }
    return url;
  }
}

// Export singleton instance
export const orcidService = new OrcidService();
