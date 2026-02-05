/**
 * Central AI Configuration Helper
 *
 * Single source of truth for AI feature flag status.
 * Use this module to check if AI is enabled before making AI calls.
 */

export type AiStatus = "enabled" | "disabled" | "not_configured";

/**
 * Check if AI processing is enabled.
 * Returns true only if both AI_ENABLED=true AND OPENROUTER_API_KEY is present.
 */
export function isAiEnabled(): boolean {
  const aiEnabled = process.env.AI_ENABLED === "true";
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
  return aiEnabled && hasApiKey;
}

/**
 * Get the detailed AI status for UI and API responses.
 * - "enabled": AI is fully operational
 * - "disabled": AI is explicitly disabled (AI_ENABLED !== "true")
 * - "not_configured": AI is enabled but API key is missing
 */
export function getAiStatus(): AiStatus {
  const aiEnabled = process.env.AI_ENABLED === "true";
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);

  if (!aiEnabled) {
    return "disabled";
  }

  if (!hasApiKey) {
    return "not_configured";
  }

  return "enabled";
}

/**
 * Get a human-readable message for the current AI status.
 */
export function getAiStatusMessage(): string {
  const status = getAiStatus();

  switch (status) {
    case "enabled":
      return "AI processing is enabled";
    case "disabled":
      return "AI processing is disabled (AI_ENABLED=false)";
    case "not_configured":
      return "AI is enabled but OPENROUTER_API_KEY is not configured";
  }
}
