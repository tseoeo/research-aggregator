/**
 * Paper Analysis Service (DTL-P)
 *
 * Generates structured paper card analyses using LLM.
 * Implements the Deterministic Translation Layer for Public audiences.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { taxonomyEntries, type TaxonomyEntry } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ============================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================

const interestingnessCheckSchema = z.object({
  check_id: z.enum([
    "business_primitive_impact",
    "delta_specificity",
    "comparison_credibility",
    "real_world_plausibility",
    "evidence_strength",
    "failure_disclosure",
  ]),
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  answer: z.string().min(1),
  evidence_pointers: z.array(z.string()),
  notes: z.string().optional(),
});

const interestingnessSchema = z.object({
  total_score: z.number().int().min(0).max(12),
  tier: z.enum(["low", "moderate", "high", "very_high"]),
  checks: z.array(interestingnessCheckSchema).length(6),
});

const businessPrimitivesSchema = z.object({
  selected: z.array(
    z.enum(["cost", "reliability", "speed", "quality", "risk", "new_capability"])
  ).max(2),
  justification: z.string(),
  evidence_pointers: z.array(z.string()),
});

const keyNumberSchema = z.object({
  metric_name: z.string(),
  value: z.string(),
  direction: z.enum(["up", "down"]),
  baseline: z.string().optional(),
  conditions: z.string(),
  evidence_pointer: z.string(),
});

const constraintSchema = z.object({
  constraint: z.string(),
  why_it_matters: z.string(),
  evidence_pointer: z.string(),
});

const failureModeSchema = z.object({
  failure_mode: z.string(),
  why_it_matters: z.string(),
  evidence_pointer: z.string(),
});

const useCaseMappingSchema = z.object({
  use_case_id: z.string(),
  use_case_name: z.string(),
  fit_confidence: z.enum(["low", "med", "high"]),
  because: z.string(),
  evidence_pointers: z.array(z.string()),
});

const taxonomyProposalSchema = z.object({
  type: z.literal("use_case"),
  proposed_name: z.string(),
  definition: z.string(),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  synonyms: z.array(z.string()),
  examples: z.array(z.string()).length(3),
  rationale: z.string(),
});

const publicViewsSchema = z.object({
  hook_sentence: z.string(),
  "30s_summary": z.array(z.string()).min(3).max(5),
  "3m_summary": z.string(),
  "8m_operator_addendum": z.string().optional(),
});

export const paperCardAnalysisResponseSchema = z.object({
  role: z.enum(["Primitive", "Platform", "Proof", "Provocation"]),
  role_confidence: z.number().min(0).max(1),
  time_to_value: z.enum(["Now", "Soon", "Later", "Unknown"]),
  time_to_value_confidence: z.number().min(0).max(1),
  interestingness: interestingnessSchema,
  business_primitives: businessPrimitivesSchema,
  key_numbers: z.array(keyNumberSchema).max(3),
  constraints: z.array(constraintSchema).max(3),
  failure_modes: z.array(failureModeSchema).max(3),
  what_is_missing: z.array(z.string()),
  readiness_level: z.enum(["research_only", "prototype_candidate", "deployable_with_work"]),
  readiness_justification: z.string(),
  readiness_evidence_pointers: z.array(z.string()),
  use_case_mapping: z.array(useCaseMappingSchema).max(5),
  taxonomy_proposals: z.array(taxonomyProposalSchema).max(1),
  public_views: publicViewsSchema,
});

export type PaperCardAnalysisResponse = z.infer<typeof paperCardAnalysisResponseSchema>;

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are an analysis engine that produces a structured PaperCardAnalysis for a public business audience. You must be accurate, skeptical, and never invent results. Output strict JSON matching the schema. If evidence pointers are unknown, use "Not available". Prefer conservative scoring.

## Scoring Guidelines

### Role (forced choice)
- Primitive: Introduces a fundamental new capability or building block
- Platform: Provides infrastructure or tools that enable other applications
- Proof: Demonstrates feasibility or validates a concept
- Provocation: Challenges assumptions or proposes unconventional ideas

### Time-to-value (forced choice)
- Now: Can be applied to business problems today with existing tools
- Soon: Requires 6-18 months of engineering/productization
- Later: Requires significant research/infrastructure advances (2+ years)
- Unknown: Cannot determine from available information

### Interestingness Checks (score 0/1/2)

1. business_primitive_impact
   - 0: No clear primitive impacted
   - 1: Plausible but vague or weak evidence
   - 2: Clear primitive impact with specific evidence

2. delta_specificity
   - 0: No measurable delta
   - 1: Qualitative delta only
   - 2: Quantitative delta with conditions

3. comparison_credibility
   - 0: Unclear or strawman baseline
   - 1: Baseline exists but questionable
   - 2: Strong baselines and fair comparison

4. real_world_plausibility
   - 0: Unrealistic resources or constraints not stated
   - 1: Feasible for some, unclear broadly
   - 2: Broadly plausible or explicitly designed for practical constraints

5. evidence_strength
   - 0: Single dataset, no robustness/ablations/error analysis
   - 1: Some strengthening signals
   - 2: Multiple datasets or strong robustness, ablations, variance, error breakdown

6. failure_disclosure
   - 0: None discussed
   - 1: Vague limitations
   - 2: Concrete failures or boundary tests

### Interest Tier (derived from total_score)
- 0-3: low
- 4-6: moderate
- 7-9: high
- 10-12: very_high

### Business Primitives
Select 0-2 from: cost, reliability, speed, quality, risk, new_capability

### Readiness Level
- research_only: Only proven in academic settings
- prototype_candidate: Ready for internal POC/prototype
- deployable_with_work: Could be deployed with reasonable engineering effort

## Output Format
Output valid JSON only. No markdown, no explanations, just the JSON object.`;

// ============================================
// SERVICE CLASS
// ============================================

export class PaperAnalysisService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.model = model || process.env.OPENROUTER_MODEL || "openai/gpt-5.1";

    if (!this.apiKey) {
      console.warn("[PaperAnalysis] OpenRouter API key not configured");
    }
  }

  /**
   * Load active and provisional taxonomy entries for context
   */
  async loadTaxonomyContext(): Promise<TaxonomyEntry[]> {
    const entries = await db
      .select()
      .from(taxonomyEntries)
      .where(
        // Get active and provisional entries
        // Using raw SQL would be cleaner but this works
        eq(taxonomyEntries.type, "use_case")
      );

    // Filter to active and provisional only
    return entries.filter((e) => e.status === "active" || e.status === "provisional");
  }

  /**
   * Build the user prompt with paper data and taxonomy context
   */
  private buildUserPrompt(
    paper: { title: string; abstract: string; authors?: string[]; year?: number },
    taxonomy: TaxonomyEntry[]
  ): string {
    const taxonomyContext = taxonomy
      .map((t) => {
        return `- ${t.name} (${t.status})
  Definition: ${t.definition}
  Synonyms: ${t.synonyms?.join(", ") || "none"}`;
      })
      .join("\n");

    return `Analyze this research paper and produce a PaperCardAnalysis JSON.

## Paper Metadata
Title: ${paper.title}
${paper.authors?.length ? `Authors: ${paper.authors.join(", ")}` : ""}
${paper.year ? `Year: ${paper.year}` : ""}

## Abstract
${paper.abstract}

## Available Use-Case Taxonomy
${taxonomyContext || "No existing taxonomy entries."}

## Instructions
1. Assign role (Primitive/Platform/Proof/Provocation) with confidence 0-1
2. Assign time_to_value (Now/Soon/Later/Unknown) with confidence 0-1
3. Select 0-2 business primitives affected
4. Score all 6 interestingness checks (0/1/2) with answers and evidence pointers
5. Extract up to 3 key numbers with conditions
6. List up to 3 constraints and up to 3 failure modes
7. List what's missing in the paper
8. Determine readiness level with justification
9. Map to 0-5 existing use-cases with confidence and "because"
10. If no existing use-case fits well, propose at most 1 new provisional entry
11. Generate public views (hook, 30s summary, 3m summary, optional 8m addendum)

Output JSON only, matching the schema exactly.`;
  }

  /**
   * Analyze a paper and return structured analysis
   */
  async analyzePaper(
    paper: {
      title: string;
      abstract: string;
      authors?: string[];
      year?: number;
    }
  ): Promise<{
    analysis: PaperCardAnalysisResponse;
    tokensUsed: number;
    model: string;
  }> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key not configured");
    }

    // Load taxonomy context
    const taxonomy = await this.loadTaxonomyContext();

    // Build prompts
    const userPrompt = this.buildUserPrompt(paper, taxonomy);

    // Make API call
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://research.dimitrov.im",
        "X-Title": "Research Aggregator DTL-P",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2, // Low temperature for consistency
        max_tokens: 4000, // Analysis is detailed
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Failed to parse OpenRouter response as JSON: ${content.substring(0, 500)}`);
    }

    // Validate with Zod
    const validated = paperCardAnalysisResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[PaperAnalysis] Validation errors:", validated.error.issues);
      // Try to salvage what we can - for now, throw
      throw new Error(
        `Response validation failed: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }

    return {
      analysis: validated.data,
      tokensUsed: data.usage?.total_tokens || 0,
      model: data.model || this.model,
    };
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const paperAnalysisService = new PaperAnalysisService();
