import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Share2,
  Users,
} from "lucide-react";
import { SaveButton } from "@/components/papers/save-button";
import { arxivService } from "@/lib/services/arxiv";
import { PaperSummary, PaperEli5 } from "@/components/papers/paper-summary";
import { MentionList } from "@/components/mentions/mention-list";
import { AuthorsList } from "@/components/authors";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getPaper(id: string) {
  try {
    const paper = await arxivService.fetchPaperById(id);
    return paper;
  } catch (error) {
    console.error("Error fetching paper:", error);
    return null;
  }
}

export default async function PaperDetailPage({ params }: PageProps) {
  const { id } = await params;
  const paper = await getPaper(id);

  if (!paper) {
    notFound();
  }

  const publishedDate = format(paper.publishedAt, "MMMM d, yyyy");
  const relativeDate = formatDistanceToNow(paper.publishedAt, {
    addSuffix: true,
  });

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to papers
        </Link>
      </Button>

      {/* Paper header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="font-mono">
            {paper.primaryCategory}
          </Badge>
          <span>{publishedDate}</span>
          <span className="text-muted-foreground/50">({relativeDate})</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">{paper.title}</h1>

        {/* Authors */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4 flex-shrink-0" />
          <AuthorsList authors={paper.authors} paperTitle={paper.title} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button asChild>
            <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4 mr-2" />
              View PDF
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://arxiv.org/abs/${paper.arxivId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              arXiv
            </a>
          </Button>
          <SaveButton arxivId={paper.arxivId} />
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Content tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="abstract">Abstract</TabsTrigger>
          <TabsTrigger value="eli5">ELI5</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <PaperSummary paperId={paper.arxivId} />
        </TabsContent>

        <TabsContent value="abstract" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Abstract</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {paper.abstract}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eli5" className="space-y-4">
          <PaperEli5 paperId={paper.arxivId} />
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <MentionList paperId={paper.arxivId} />
        </TabsContent>
      </Tabs>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {paper.categories.map((cat) => (
              <Badge key={cat} variant="outline" className="font-mono">
                {cat}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
