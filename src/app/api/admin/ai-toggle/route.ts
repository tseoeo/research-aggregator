/**
 * AI Toggle API
 *
 * GET  - Returns current runtime AI status
 * POST - Sets the runtime AI toggle (enables/disables AI processing)
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { getAiStatusAsync, getAiStatusMessage } from "@/lib/ai/config";
import {
  getAiToggleInfo,
  setAiEnabledRuntime,
} from "@/lib/ai/runtime-toggle";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  const info = await getAiToggleInfo();
  const status = await getAiStatusAsync();

  return NextResponse.json({
    enabled: info.enabled && Boolean(process.env.OPENROUTER_API_KEY),
    runtimeEnabled: info.enabled,
    source: info.source,
    updatedAt: info.updatedAt,
    status,
    message: getAiStatusMessage(status),
    model: process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5",
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY),
  });
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Request body must include { enabled: boolean }" },
        { status: 400 }
      );
    }

    await setAiEnabledRuntime(enabled);

    const info = await getAiToggleInfo();
    const status = await getAiStatusAsync();

    return NextResponse.json({
      enabled: info.enabled && Boolean(process.env.OPENROUTER_API_KEY),
      runtimeEnabled: info.enabled,
      source: info.source,
      updatedAt: info.updatedAt,
      status,
      message: getAiStatusMessage(status),
    });
  } catch (error) {
    console.error("[AdminAiToggle] Error setting toggle:", error);
    return NextResponse.json(
      { error: "Failed to update AI toggle" },
      { status: 500 }
    );
  }
}
