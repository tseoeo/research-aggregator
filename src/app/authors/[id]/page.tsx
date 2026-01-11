import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileText,
  Quote,
  Users,
} from "lucide-react";
import { openAlexService } from "@/lib/services/openalex";
import { orcidService } from "@/lib/services/orcid";
import { AuthorSocialLinks } from "@/components/authors/author-social-links";
import { AuthorWorksList } from "@/components/authors/author-works-list";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAuthor(id: string) {
  try {
    // Determine ID type
    const isOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(id);

    let openAlexAuthor = null;
    let orcidProfile = null;

    if (isOrcid) {
      const [orcidResult, openAlexResult] = await Promise.all([
        orcidService.getProfile(id),
        openAlexService.getAuthorByOrcid(id),
      ]);
      orcidProfile = orcidResult;
      openAlexAuthor = openAlexResult;
    } else {
      openAlexAuthor = await openAlexService.getAuthor(id);
      if (openAlexAuthor?.orcid) {
        orcidProfile = await orcidService.getProfile(openAlexAuthor.orcid);
      }
    }

    if (!openAlexAuthor && !orcidProfile) {
      return null;
    }

    // Extract social links from ORCID
    const socialLinks = orcidProfile
      ? orcidService.extractSocialLinks(orcidProfile)
      : {};

    return {
      id: openAlexAuthor?.id || id,
      orcid: orcidProfile?.orcid || openAlexAuthor?.orcid,
      name: orcidProfile?.name || openAlexAuthor?.displayName || "Unknown",
      otherNames: orcidProfile?.otherNames || [],
      biography: orcidProfile?.biography,
      worksCount: openAlexAuthor?.worksCount,
      citedByCount: openAlexAuthor?.citedByCount,
      hIndex: openAlexAuthor?.hIndex,
      affiliations: combineAffiliations(orcidProfile, openAlexAuthor),
      topics: combineTopics(orcidProfile, openAlexAuthor),
      social: {
        twitter: socialLinks.twitter || openAlexAuthor?.ids.twitter,
        bluesky: socialLinks.bluesky,
        github: socialLinks.github,
        linkedin: socialLinks.linkedin,
        website: socialLinks.website,
        wikipedia: openAlexAuthor?.ids.wikipedia,
      },
      websites: orcidProfile?.websites || [],
    };
  } catch (error) {
    console.error("Error fetching author:", error);
    return null;
  }
}

function combineAffiliations(
  orcidProfile: Awaited<ReturnType<typeof orcidService.getProfile>>,
  openAlexAuthor: Awaited<ReturnType<typeof openAlexService.getAuthor>>
) {
  const affiliations: {
    institution: string;
    role?: string;
    country?: string;
    current: boolean;
  }[] = [];

  const seen = new Set<string>();

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

  if (openAlexAuthor) {
    for (const aff of openAlexAuthor.affiliations) {
      const key = aff.institution.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        affiliations.push({
          institution: aff.institution,
          country: aff.country,
          current: aff.years.includes(new Date().getFullYear()),
        });
      }
    }
  }

  return affiliations;
}

function combineTopics(
  orcidProfile: Awaited<ReturnType<typeof orcidService.getProfile>>,
  openAlexAuthor: Awaited<ReturnType<typeof openAlexService.getAuthor>>
) {
  const topics = new Set<string>();

  if (orcidProfile) {
    for (const kw of orcidProfile.keywords) {
      topics.add(kw);
    }
  }

  if (openAlexAuthor) {
    for (const topic of openAlexAuthor.topics.slice(0, 10)) {
      topics.add(topic.name);
    }
  }

  return Array.from(topics);
}

export default async function AuthorProfilePage({ params }: PageProps) {
  const { id } = await params;
  const author = await getAuthor(id);

  if (!author) {
    notFound();
  }

  const currentAffiliation = author.affiliations.find((a) => a.current);
  const pastAffiliations = author.affiliations.filter((a) => !a.current);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to papers
        </Link>
      </Button>

      {/* Author header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{author.name}</h1>

            {currentAffiliation && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{currentAffiliation.institution}</span>
                {currentAffiliation.role && (
                  <span className="text-muted-foreground/70">
                    ({currentAffiliation.role})
                  </span>
                )}
              </div>
            )}

            {author.otherNames.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Also known as: {author.otherNames.join(", ")}
              </div>
            )}
          </div>

          {/* ORCID badge */}
          {author.orcid && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://orcid.org/${author.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://orcid.org/sites/default/files/images/orcid_16x16.png"
                  alt="ORCID"
                  className="h-4 w-4 mr-2"
                />
                {author.orcid}
              </a>
            </Button>
          )}
        </div>

        {/* Metrics */}
        {(author.worksCount || author.citedByCount || author.hIndex) && (
          <div className="flex gap-6">
            {author.worksCount !== undefined && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{author.worksCount.toLocaleString()}</span>
                <span className="text-muted-foreground text-sm">works</span>
              </div>
            )}
            {author.citedByCount !== undefined && (
              <div className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{author.citedByCount.toLocaleString()}</span>
                <span className="text-muted-foreground text-sm">citations</span>
              </div>
            )}
            {author.hIndex !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">h-index:</span>
                <span className="font-semibold">{author.hIndex}</span>
              </div>
            )}
          </div>
        )}

        {/* Social links */}
        <AuthorSocialLinks social={author.social} websites={author.websites} />
      </div>

      <Separator />

      {/* Biography */}
      {author.biography && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Biography</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {author.biography}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Topics/Keywords */}
      {author.topics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Research Topics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {author.topics.map((topic) => (
                <Badge key={topic} variant="secondary">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Affiliations */}
      {pastAffiliations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Past Affiliations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pastAffiliations.map((aff, idx) => (
                <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                  <span>{aff.institution}</span>
                  {aff.role && (
                    <span className="text-muted-foreground/70">({aff.role})</span>
                  )}
                  {aff.country && (
                    <Badge variant="outline" className="text-xs">
                      {aff.country}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recent Works */}
      {author.id && author.id.startsWith("A") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuthorWorksList authorId={author.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
