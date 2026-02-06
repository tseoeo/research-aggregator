/**
 * Paper Analysis V3 Service
 *
 * Generates the 10-field v3 analysis for papers.
 * Replaces the DTL-P system with a simpler, more practical analysis.
 */

import { z } from "zod";
import { createHash } from "crypto";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ============================================
// CONSTANTS
// ============================================

const VALID_KINDS = [
  "New Method",
  "New Model",
  "Infrastructure / Tooling",
  "Benchmark / Evaluation",
  "Dataset",
  "Application Study",
  "Survey / Review",
  "Scaling Study",
  "Safety / Alignment",
] as const;

const VALID_TIME_TO_VALUE = ["Now", "Soon", "Later", "Unknown"] as const;

const VALID_IMPACT_TAGS = [
  "Reasoning & Planning",
  "Tool Use & Agents",
  "Cost & Efficiency",
  "Context & Memory",
  "Human-AI Interaction",
  "Code & Engineering",
  "Multimodal",
  "Safety & Trust",
  "Training & Data",
  "Domain-Specific AI",
] as const;

const VALID_READINESS = [
  "Research Only",
  "Needs Engineering",
  "Ready to Try",
] as const;

// ============================================
// ZOD VALIDATION SCHEMA
// ============================================

const keyNumberSchema = z.object({
  metric: z.string(),
  value: z.string(),
  direction: z.enum(["up", "down"]),
  baseline: z.string().nullable(),
  conditions: z.string(),
});

const practicalValueScoreSchema = z.object({
  real_problem: z.number().int().min(0).max(2),
  concrete_result: z.number().int().min(0).max(2),
  actually_usable: z.number().int().min(0).max(2),
  total: z.number().int().min(0).max(6),
});

export const v3AnalysisSchema = z.object({
  hook_sentence: z.string().min(10).max(150),
  what_kind: z.enum(VALID_KINDS),
  time_to_value: z.enum(VALID_TIME_TO_VALUE),
  impact_area_tags: z.array(z.enum(VALID_IMPACT_TAGS)).min(1).max(3),
  practical_value_score: practicalValueScoreSchema,
  key_numbers: z.array(keyNumberSchema).min(0).max(3),
  readiness_level: z.enum(VALID_READINESS),
  how_this_changes_things: z.array(z.string().min(20)).min(2).max(3),
  what_came_before: z.string().min(10),
});

export type V3AnalysisResponse = z.infer<typeof v3AnalysisSchema>;

// ============================================
// PROMPTS
// ============================================

const SYSTEM_PROMPT = `You are a research paper analyst for a product-savvy audience. Your job is to help a busy, technically literate person decide which AI papers are worth their time.

You analyze paper abstracts and produce structured JSON output. Your analysis should be:
- Practical: Focus on real-world implications, not academic significance
- Honest: If the abstract is vague, say so. Don't inflate claims.
- Concrete: Prefer specific statements over general ones
- Deterministic: Base every field on observable content in the abstract

You are NOT writing for AI researchers. You are writing for someone who:
- Uses AI products daily and wants to know what's changing
- Makes product or business decisions informed by AI research
- Needs to decide in 10 seconds whether a paper is worth reading further
- Will take interesting papers to an AI assistant for deeper discussion

Never invent claims not supported by the abstract. If information is missing, say so explicitly.`;

function buildUserPrompt(paper: {
  title: string;
  abstract: string;
  authors?: string[];
  publishedDate?: string;
  categories?: string[];
}): string {
  return `Analyze this paper abstract:

Title: ${paper.title}
Authors: ${paper.authors?.join(", ") || "Unknown"}
Published: ${paper.publishedDate || "Unknown"}
Categories: ${paper.categories?.join(", ") || "Unknown"}

Abstract:
${paper.abstract}

Produce a JSON response with exactly these fields:

1. hook_sentence: One sentence (max 120 chars) combining what they did + why it matters practically. Formula: [what they did] + [why it matters for real-world use].

2. what_kind: Exactly one of: "New Method", "New Model", "Infrastructure / Tooling", "Benchmark / Evaluation", "Dataset", "Application Study", "Survey / Review", "Scaling Study", "Safety / Alignment"

3. time_to_value: Exactly one of: "Now", "Soon", "Later", "Unknown"
   - Now = code released, runs on standard hardware, could use this week
   - Soon = approach is clear, no public implementation yet
   - Later = requires resources/infrastructure that don't exist yet
   - Unknown = can't determine from abstract

4. impact_area_tags: Array of 1-3 from: "Reasoning & Planning", "Tool Use & Agents", "Cost & Efficiency", "Context & Memory", "Human-AI Interaction", "Code & Engineering", "Multimodal", "Safety & Trust", "Training & Data", "Domain-Specific AI". Only include tags justified by explicit abstract content.

5. practical_value_score: Object with three checks:
   - real_problem: 0, 1, or 2 (0=unclear what problem, 1=indirect connection, 2=directly tackles practitioner problem)
   - concrete_result: 0, 1, or 2 (0=vague claims, 1=some numbers but narrow, 2=specific measurable result with conditions)
   - actually_usable: 0, 1, or 2 (0=unrealistic resources, 1=feasible for big teams only, 2=realistic for typical startup)
   - total: sum of above (0-6)

6. key_numbers: Array of up to 3, each with: metric (string), value (string), direction ("up" or "down"), baseline (string or null), conditions (string). Selection priority: first 3 sentences > relative improvements > has conditions > cost/efficiency numbers.

7. readiness_level: Exactly one of: "Research Only", "Needs Engineering", "Ready to Try"

8. how_this_changes_things: Array of 2-3 strings. Each follows pattern: "[Who — a person, not a technical team] could [experience what change], [outcome]." Written for people who USE AI, not people who BUILD AI infrastructure. NEVER reference technical roles (ML engineer, data scientist, researcher) or infrastructure (GPU clusters, training pipelines). If the impact is inherently technical, describe what end users of AI-powered products would experience differently instead.

9. what_came_before: One sentence of context about prior work or baselines. If abstract doesn't mention prior work, say "No prior work referenced in abstract."

Respond with valid JSON only. No markdown, no explanation, no preamble.`;
}

// ============================================
// SERVICE
// ============================================

// Models that support response_format: { type: "json_object" }
const JSON_MODE_SUPPORTED_PREFIXES = ["openai/", "google/", "anthropic/"];

function supportsJsonMode(model: string): boolean {
  return JSON_MODE_SUPPORTED_PREFIXES.some((prefix) => model.startsWith(prefix));
}

function generatePromptHash(systemPrompt: string, userPrompt: string): string {
  const combined = systemPrompt + userPrompt;
  return createHash("sha256").update(combined).digest("hex").substring(0, 64);
}

/**
 * Strip markdown code blocks from LLM response
 */
function stripMarkdownCodeBlocks(content: string): string {
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export interface V3AnalysisResult {
  analysis: V3AnalysisResponse;
  tokensUsed: number;
  model: string;
  promptHash: string;
  analysisStatus: "complete" | "partial";
  validationErrors: string[];
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PaperAnalysisV3Service {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.model = model || process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Analyze a paper abstract and return structured v3 analysis
   */
  async analyzePaper(paper: {
    title: string;
    abstract: string;
    authors?: string[];
    publishedDate?: string;
    categories?: string[];
  }): Promise<V3AnalysisResult> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key not configured");
    }

    const userPrompt = buildUserPrompt(paper);
    const promptHash = generatePromptHash(SYSTEM_PROMPT, userPrompt);

    // First attempt
    const result = await this.callOpenRouter(userPrompt);
    const parsed = this.parseResponse(result.content);
    const validation = v3AnalysisSchema.safeParse(parsed);

    if (validation.success) {
      // Verify total matches sum
      const score = validation.data.practical_value_score;
      const expectedTotal = score.real_problem + score.concrete_result + score.actually_usable;
      if (score.total !== expectedTotal) {
        // Fix the total silently
        validation.data.practical_value_score.total = expectedTotal;
      }

      return {
        analysis: validation.data,
        tokensUsed: result.tokensUsed,
        model: result.model,
        promptHash,
        analysisStatus: "complete",
        validationErrors: [],
      };
    }

    // Validation failed — retry once with error feedback
    console.warn("[AnalysisV3] First attempt validation failed, retrying with feedback");
    const errorFeedback = validation.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");

    const retryPrompt = `${userPrompt}\n\nYour previous response had validation errors: ${errorFeedback}\n\nPlease fix these issues and respond with valid JSON only.`;
    const retryResult = await this.callOpenRouter(retryPrompt);
    const retryParsed = this.parseResponse(retryResult.content);
    const retryValidation = v3AnalysisSchema.safeParse(retryParsed);

    if (retryValidation.success) {
      const score = retryValidation.data.practical_value_score;
      const expectedTotal = score.real_problem + score.concrete_result + score.actually_usable;
      if (score.total !== expectedTotal) {
        retryValidation.data.practical_value_score.total = expectedTotal;
      }

      return {
        analysis: retryValidation.data,
        tokensUsed: result.tokensUsed + retryResult.tokensUsed,
        model: retryResult.model,
        promptHash,
        analysisStatus: "complete",
        validationErrors: [],
      };
    }

    // Both attempts failed — store partial result with whatever fields passed
    console.error("[AnalysisV3] Retry also failed, storing partial result");
    const partialAnalysis = this.buildPartialAnalysis(retryParsed);
    const allErrors = [
      ...validation.error.issues.map((e) => `attempt1: ${e.path.join(".")}: ${e.message}`),
      ...retryValidation.error.issues.map((e) => `attempt2: ${e.path.join(".")}: ${e.message}`),
    ];

    return {
      analysis: partialAnalysis,
      tokensUsed: result.tokensUsed + retryResult.tokensUsed,
      model: retryResult.model,
      promptHash,
      analysisStatus: "partial",
      validationErrors: allErrors,
    };
  }

  /**
   * Call OpenRouter API
   */
  private async callOpenRouter(userPrompt: string): Promise<{
    content: string;
    tokensUsed: number;
    model: string;
  }> {
    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 4000,
    };

    if (supportsJsonMode(this.model)) {
      requestBody.response_format = { type: "json_object" };
    }

    console.log(`[AnalysisV3] [AI-CALL] Model: ${this.model}`);

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://research.dimitrov.im",
        "X-Title": "Research Aggregator V3",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data: OpenRouterResponse = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    console.log(
      `[AnalysisV3] [AI-CALL] Tokens: ${data.usage?.total_tokens || "unknown"} (prompt: ${data.usage?.prompt_tokens || "?"}, completion: ${data.usage?.completion_tokens || "?"})`
    );

    return {
      content,
      tokensUsed: data.usage?.total_tokens || 0,
      model: data.model || this.model,
    };
  }

  /**
   * Parse JSON response, stripping markdown if needed
   */
  private parseResponse(content: string): unknown {
    const cleaned = stripMarkdownCodeBlocks(content);
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse response as JSON: ${content.substring(0, 500)}`);
    }
  }

  /**
   * Build a partial analysis from whatever fields are usable
   */
  private buildPartialAnalysis(raw: unknown): V3AnalysisResponse {
    const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

    const safeString = (val: unknown, fallback: string): string =>
      typeof val === "string" && val.length > 0 ? val : fallback;

    const safeArray = (val: unknown): unknown[] =>
      Array.isArray(val) ? val : [];

    return {
      hook_sentence: safeString(data.hook_sentence, "Analysis incomplete — see abstract for details."),
      what_kind: VALID_KINDS.includes(data.what_kind as typeof VALID_KINDS[number])
        ? (data.what_kind as typeof VALID_KINDS[number])
        : "New Method",
      time_to_value: VALID_TIME_TO_VALUE.includes(data.time_to_value as typeof VALID_TIME_TO_VALUE[number])
        ? (data.time_to_value as typeof VALID_TIME_TO_VALUE[number])
        : "Unknown",
      impact_area_tags: safeArray(data.impact_area_tags).filter(
        (t): t is typeof VALID_IMPACT_TAGS[number] =>
          VALID_IMPACT_TAGS.includes(t as typeof VALID_IMPACT_TAGS[number])
      ).slice(0, 3) || ["Training & Data"],
      practical_value_score: {
        real_problem: 0,
        concrete_result: 0,
        actually_usable: 0,
        total: 0,
      },
      key_numbers: [],
      readiness_level: VALID_READINESS.includes(data.readiness_level as typeof VALID_READINESS[number])
        ? (data.readiness_level as typeof VALID_READINESS[number])
        : "Research Only",
      how_this_changes_things: safeArray(data.how_this_changes_things)
        .filter((s): s is string => typeof s === "string" && s.length >= 20)
        .slice(0, 3) || ["Impact analysis incomplete — further review needed for practical implications."],
      what_came_before: safeString(data.what_came_before, "Prior work context unavailable."),
    };
  }
}
