import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="container py-8 md:py-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <span className="heading-display text-sm text-primary">R</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Research Aggregator
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/about"
              className="text-muted-foreground hover:text-foreground transition-colors link-underline"
            >
              About
            </Link>
            <Link
              href="/api"
              className="text-muted-foreground hover:text-foreground transition-colors link-underline"
            >
              API
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors link-underline"
            >
              GitHub
            </a>
          </nav>

          {/* Attribution */}
          <p className="text-xs text-muted-foreground/70">
            Data from{" "}
            <a
              href="https://arxiv.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              arXiv.org
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
