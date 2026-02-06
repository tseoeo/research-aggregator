import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { setBudget, getAnalysisV3Config } from "@/lib/ai/analysis-v3-config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { dailyCents, monthlyCents } = body;

    await setBudget(dailyCents, monthlyCents);
    const config = await getAnalysisV3Config();

    return NextResponse.json({
      message: "Budget updated",
      budget: {
        dailyCents: config.dailyBudgetCents,
        monthlyCents: config.monthlyBudgetCents,
      },
    });
  } catch (error) {
    console.error("[AnalysisV3 Budget] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update budget" },
      { status: 500 }
    );
  }
}
