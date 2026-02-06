/**
 * OpenRouter API Service
 *
 * Generates AI summaries using OpenRouter API with GPT models.
 * API Docs: https://openrouter.ai/docs
 */

import { z } from "zod";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Response schema for summary generation
const summaryResponseSchema = z.object({
  bullets: z.array(z.string()).length(3),
  eli5: z.string(),
});

export type SummaryResponse = z.infer<typeof summaryResponseSchema>;

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

// Models that support response_format: { type: "json_object" }
const JSON_MODE_SUPPORTED_PREFIXES = ["openai/", "google/", "anthropic/"];

function supportsJsonMode(model: string): boolean {
  return JSON_MODE_SUPPORTED_PREFIXES.some((prefix) => model.startsWith(prefix));
}

export class OpenRouterService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.model = model || process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";

    if (!this.apiKey) {
      console.warn("OpenRouter API key not configured");
    }
  }

  /**
   * Generate a summary for a research paper
   */
  async generateSummary(
    title: string,
    abstract: string
  ): Promise<{
    bullets: string[];
    eli5: string;
    tokensUsed: number;
    model: string;
  }> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key not configured");
    }

    const systemPrompt = `You are an expert research paper summarizer. Your task is to analyze academic papers and provide clear, accurate summaries.

You must respond with valid JSON in this exact format:
{
  "bullets": ["point 1", "point 2", "point 3"],
  "eli5": "simple explanation"
}

Guidelines:
- bullets: Exactly 3 key points about the paper's main contributions, findings, or innovations. Each bullet should be 1-2 sentences, clear and informative.
- eli5: A simple explanation (2-3 sentences) that a non-expert could understand. Avoid jargon, use analogies where helpful.`;

    const userPrompt = `Summarize this research paper:

Title: ${title}

Abstract: ${abstract}

Provide exactly 3 bullet points highlighting the main contributions and an ELI5 explanation.`;

    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 2000,
    };

    // Only add response_format for models that support it
    if (supportsJsonMode(this.model)) {
      requestBody.response_format = { type: "json_object" };
    }

    console.log(`[OpenRouter] [AI-CALL] Requesting summary generation`);
    console.log(`[OpenRouter] [AI-CALL]   Model: ${this.model}`);
    console.log(`[OpenRouter] [AI-CALL]   Title: ${title.substring(0, 60)}...`);

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://research.dimitrov.im",
        "X-Title": "Research Aggregator",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data: OpenRouterResponse = await response.json();
    const content = data.choices[0]?.message?.content;

    console.log(`[OpenRouter] [AI-CALL] Response received`);
    console.log(`[OpenRouter] [AI-CALL]   Tokens: ${data.usage?.total_tokens || "unknown"} (prompt: ${data.usage?.prompt_tokens || "?"}, completion: ${data.usage?.completion_tokens || "?"})`);

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    // Strip markdown code blocks if present (for models without JSON mode)
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (e) {
      throw new Error(`Failed to parse OpenRouter response as JSON: ${content}`);
    }

    // Validate the response structure
    const validated = summaryResponseSchema.safeParse(parsed);
    if (!validated.success) {
      // Try to extract what we can
      const bullets = Array.isArray(parsed.bullets)
        ? parsed.bullets.slice(0, 3).map(String)
        : ["Summary not available", "Summary not available", "Summary not available"];
      const eli5 = typeof parsed.eli5 === "string"
        ? parsed.eli5
        : "Simple explanation not available.";

      return {
        bullets: bullets.length === 3 ? bullets : [...bullets, ...Array(3 - bullets.length).fill("Summary not available")].slice(0, 3),
        eli5,
        tokensUsed: data.usage?.total_tokens || 0,
        model: data.model || this.model,
      };
    }

    return {
      bullets: validated.data.bullets,
      eli5: validated.data.eli5,
      tokensUsed: data.usage?.total_tokens || 0,
      model: data.model || this.model,
    };
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get the current model being used
   */
  getModel(): string {
    return this.model;
  }
}

// Export singleton instance
export const openRouterService = new OpenRouterService();
