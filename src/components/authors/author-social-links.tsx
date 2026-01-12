"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink, Globe } from "lucide-react";

// Social platform icons (simple SVG components)
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 14.5c-1.5 1-3 1.5-4.5 1.5s-3-.5-4.5-1.5c-.5-.333-.5-1 0-1.333 1.5-1 3-1.5 4.5-1.5s3 .5 4.5 1.5c.5.333.5 1 0 1.333zM8 11c-.828 0-1.5-.672-1.5-1.5S7.172 8 8 8s1.5.672 1.5 1.5S8.828 11 8 11zm8 0c-.828 0-1.5-.672-1.5-1.5S15.172 8 16 8s1.5.672 1.5 1.5S16.828 11 16 11z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WikipediaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801-.3-.852l-.36-.043c-.15 0-.226-.043-.226-.129v-.427l.061-.045h3.964l.052.045v.434c0 .119-.061.176-.182.176-.89.048-1.185.394-1.716 1.324l-2.421 4.622.361.761 3.422 7.085.136.046 4.695-10.201c.259-.601.38-.97.38-1.098 0-.21-.169-.332-.507-.373l-.672-.08c-.15 0-.226-.044-.226-.15v-.435l.052-.045h4.383l.052.045v.455c0 .105-.076.15-.226.15-.961.048-1.411.494-2.092 1.924l-5.697 12.384c-.675 1.439-1.218 1.439-1.893 0-1.009-2.064-2.641-5.329-3.481-7.148z" />
    </svg>
  );
}

interface AuthorSocialLinksProps {
  social: {
    twitter?: string;
    bluesky?: string;
    github?: string;
    linkedin?: string;
    website?: string;
    wikipedia?: string;
  };
  websites?: { name?: string; url: string }[];
}

export function AuthorSocialLinks({ social, websites = [] }: AuthorSocialLinksProps) {
  const hasSocial =
    social.twitter ||
    social.bluesky ||
    social.github ||
    social.linkedin ||
    social.website ||
    social.wikipedia ||
    websites.length > 0;

  if (!hasSocial) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {social.twitter && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://twitter.com/${social.twitter}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`@${social.twitter} on Twitter/X`}
          >
            <TwitterIcon className="h-4 w-4 mr-2" />
            @{social.twitter}
          </a>
        </Button>
      )}

      {social.bluesky && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://bsky.app/profile/${social.bluesky}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`@${social.bluesky} on Bluesky`}
          >
            <BlueskyIcon className="h-4 w-4 mr-2" />
            @{social.bluesky}
          </a>
        </Button>
      )}

      {social.github && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://github.com/${social.github}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`${social.github} on GitHub`}
          >
            <GitHubIcon className="h-4 w-4 mr-2" />
            {social.github}
          </a>
        </Button>
      )}

      {social.linkedin && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={social.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn Profile"
          >
            <LinkedInIcon className="h-4 w-4 mr-2" />
            LinkedIn
          </a>
        </Button>
      )}

      {social.wikipedia && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={social.wikipedia}
            target="_blank"
            rel="noopener noreferrer"
            title="Wikipedia Article"
          >
            <WikipediaIcon className="h-4 w-4 mr-2" />
            Wikipedia
          </a>
        </Button>
      )}

      {social.website && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={social.website}
            target="_blank"
            rel="noopener noreferrer"
            title="Personal Website"
          >
            <Globe className="h-4 w-4 mr-2" />
            Website
          </a>
        </Button>
      )}

      {/* Additional websites from ORCID */}
      {websites
        .filter(
          (w) =>
            w.url !== social.website &&
            !w.url.includes("twitter.com") &&
            !w.url.includes("x.com") &&
            !w.url.includes("github.com") &&
            !w.url.includes("linkedin.com") &&
            !w.url.includes("bsky.app")
        )
        .slice(0, 3)
        .map((website, idx) => (
          <Button key={idx} variant="outline" size="sm" asChild>
            <a
              href={website.url}
              target="_blank"
              rel="noopener noreferrer"
              title={website.name || website.url}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {website.name || "Link"}
            </a>
          </Button>
        ))}
    </div>
  );
}
