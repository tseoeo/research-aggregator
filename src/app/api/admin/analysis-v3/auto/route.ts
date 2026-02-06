import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { setAutoAnalysis, getAnalysisV3Config } from "@/lib/ai/analysis-v3-config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    }

    await setAutoAnalysis(enabled);
    const config = await getAnalysisV3Config();

    return NextResponse.json({
      message: `Auto-analysis ${enabled ? "enabled" : "disabled"}`,
      autoAnalysis: {
        enabled: config.autoEnabled,
        paused: config.paused,
        pauseReason: config.pauseReason,
      },
    });
  } catch (error) {
    console.error("[AnalysisV3 Auto] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to toggle auto-analysis" },
      { status: 500 }
    );
  }
}
