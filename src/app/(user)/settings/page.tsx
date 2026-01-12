import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Settings, User, Bell, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PreferencesForm } from "@/components/settings/preferences-form";

async function getUserPreferences(userId: string) {
  const prefs = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (prefs.length === 0) {
    // Return defaults
    return {
      categories: ["cs.AI"],
      emailDigest: "daily" as const,
      notificationNewPapers: true,
      notificationSocialMentions: true,
    };
  }

  return {
    categories: prefs[0].categories || ["cs.AI"],
    emailDigest: (prefs[0].emailDigest || "daily") as "none" | "daily" | "weekly",
    notificationNewPapers: prefs[0].notificationNewPapers ?? true,
    notificationSocialMentions: prefs[0].notificationSocialMentions ?? true,
  };
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/settings");
  }

  const preferences = await getUserPreferences(session.user.id!);

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session.user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Your account information from your sign-in provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{session.user.name}</p>
              <p className="text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferences
          </CardTitle>
          <CardDescription>
            Customize your feed and notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm initialPreferences={preferences} />
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive" size="sm" disabled>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
