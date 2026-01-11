import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/user/preferences
 *
 * Get the current user's preferences.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1);

    if (prefs.length === 0) {
      // Return defaults
      return NextResponse.json({
        categories: ["cs.AI"],
        emailDigest: "daily",
        notificationNewPapers: true,
        notificationSocialMentions: true,
      });
    }

    return NextResponse.json({
      categories: prefs[0].categories || ["cs.AI"],
      emailDigest: prefs[0].emailDigest || "daily",
      notificationNewPapers: prefs[0].notificationNewPapers ?? true,
      notificationSocialMentions: prefs[0].notificationSocialMentions ?? true,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/preferences
 *
 * Update the current user's preferences.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      categories,
      emailDigest,
      notificationNewPapers,
      notificationSocialMentions,
    } = body;

    // Validate emailDigest
    if (emailDigest && !["none", "daily", "weekly"].includes(emailDigest)) {
      return NextResponse.json(
        { error: "Invalid email digest value" },
        { status: 400 }
      );
    }

    // Check if preferences exist
    const existing = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1);

    if (existing.length === 0) {
      // Create new preferences
      await db.insert(userPreferences).values({
        userId: session.user.id,
        categories: categories || ["cs.AI"],
        emailDigest: emailDigest || "daily",
        notificationNewPapers: notificationNewPapers ?? true,
        notificationSocialMentions: notificationSocialMentions ?? true,
      });
    } else {
      // Update existing preferences
      await db
        .update(userPreferences)
        .set({
          categories: categories !== undefined ? categories : existing[0].categories,
          emailDigest: emailDigest !== undefined ? emailDigest : existing[0].emailDigest,
          notificationNewPapers:
            notificationNewPapers !== undefined
              ? notificationNewPapers
              : existing[0].notificationNewPapers,
          notificationSocialMentions:
            notificationSocialMentions !== undefined
              ? notificationSocialMentions
              : existing[0].notificationSocialMentions,
        })
        .where(eq(userPreferences.userId, session.user.id));
    }

    return NextResponse.json({
      message: "Preferences updated successfully",
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
