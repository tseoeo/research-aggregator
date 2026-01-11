"use client";

import { AuthorLink } from "./author-link";

interface Author {
  name: string;
  affiliation?: string;
}

interface AuthorsListProps {
  authors: Author[];
  paperTitle?: string;
}

export function AuthorsList({ authors, paperTitle }: AuthorsListProps) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {authors.map((author, idx) => (
        <span key={idx}>
          <AuthorLink
            name={author.name}
            affiliation={author.affiliation}
            paperTitle={paperTitle}
          />
          {author.affiliation && (
            <span className="text-muted-foreground/70 text-sm">
              {" "}
              ({author.affiliation})
            </span>
          )}
          {idx < authors.length - 1 && ","}
        </span>
      ))}
    </div>
  );
}
