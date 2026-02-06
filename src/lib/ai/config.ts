/**
 * Central AI Configuration Helper
 *
 * Single source of truth for AI feature flag status.
 * Use this module to check if AI is enabled before making AI calls.
 *
 * Two modes:
 *   - Sync: isAiEnabled() — reads env var only (legacy, for backward compat)
 *   - Async: isAiEnabledAsync() — checks Redis runtime toggle first, then env var
 */

import { getAiEnabledRuntime, getAiToggleInfo } from "./runtime-toggle";

export type AiStatus = "enabled" | "disabled" | "disabled_runtime" | "not_configured";

/**
 * Check if AI processing is enabled (synchronous, env-var only).
 * Returns true only if both AI_ENABLED=true AND OPENROUTER_API_KEY is present.
 * @deprecated Use isAiEnabledAsync() for runtime toggle support.
 */
export function isAiEnabled(): boolean {
  const aiEnabled = process.env.AI_ENABLED === "true";
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
  return aiEnabled && hasApiKey;
}

/**
 * Check if AI processing is enabled (async, reads Redis runtime toggle).
 * Resolution: Redis toggle → env var fallback. Also requires OPENROUTER_API_KEY.
 */
export async function isAiEnabledAsync(skipCache = false): Promise<boolean> {
  const runtimeEnabled = await getAiEnabledRuntime(skipCache);
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
  return runtimeEnabled && hasApiKey;
}

/**
 * Get detailed AI status (async, reads Redis runtime toggle).
 */
export async function getAiStatusAsync(): Promise<AiStatus> {
  const info = await getAiToggleInfo();
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);

  if (!info.enabled) {
    return info.source === "redis" ? "disabled_runtime" : "disabled";
  }

  if (!hasApiKey) {
    return "not_configured";
  }

  return "enabled";
}

/**
 * Get the detailed AI status for UI and API responses (synchronous, env-only).
 * @deprecated Use getAiStatusAsync() for runtime toggle support.
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
 * Get a human-readable message for a given AI status.
 */
export function getAiStatusMessage(status?: AiStatus): string {
  const s = status ?? getAiStatus();

  switch (s) {
    case "enabled":
      return "AI processing is enabled";
    case "disabled":
      return "AI processing is disabled (AI_ENABLED=false)";
    case "disabled_runtime":
      return "AI processing is disabled via admin panel";
    case "not_configured":
      return "AI is enabled but OPENROUTER_API_KEY is not configured";
  }
}
