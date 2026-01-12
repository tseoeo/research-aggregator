"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X } from "lucide-react";

const AVAILABLE_CATEGORIES = [
  { value: "cs.AI", label: "Artificial Intelligence" },
  { value: "cs.LG", label: "Machine Learning" },
  { value: "cs.CL", label: "Computation and Language" },
  { value: "cs.CV", label: "Computer Vision" },
  { value: "cs.NE", label: "Neural and Evolutionary Computing" },
  { value: "cs.RO", label: "Robotics" },
  { value: "stat.ML", label: "Machine Learning (Statistics)" },
];

const EMAIL_DIGEST_OPTIONS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
];

interface PreferencesFormProps {
  initialPreferences: {
    categories: string[];
    emailDigest: "none" | "daily" | "weekly";
    notificationNewPapers: boolean;
    notificationSocialMentions: boolean;
  };
}

export function PreferencesForm({ initialPreferences }: PreferencesFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [categories, setCategories] = useState<string[]>(initialPreferences.categories);
  const [emailDigest, setEmailDigest] = useState(initialPreferences.emailDigest);
  const [notificationNewPapers, setNotificationNewPapers] = useState(
    initialPreferences.notificationNewPapers
  );
  const [notificationSocialMentions, setNotificationSocialMentions] = useState(
    initialPreferences.notificationSocialMentions
  );

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          emailDigest,
          notificationNewPapers,
          notificationSocialMentions,
        }),
      });

      if (response.ok) {
        setSaved(true);
        router.refresh();
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Research Categories</label>
          <p className="text-xs text-muted-foreground">
            Select the categories you want to see in your feed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_CATEGORIES.map((cat) => (
            <Badge
              key={cat.value}
              variant={categories.includes(cat.value) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleCategory(cat.value)}
            >
              {categories.includes(cat.value) && (
                <Check className="h-3 w-3 mr-1" />
              )}
              {cat.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Email digest */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Email Digest</label>
          <p className="text-xs text-muted-foreground">
            How often would you like to receive email updates?
          </p>
        </div>
        <div className="flex gap-2">
          {EMAIL_DIGEST_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={emailDigest === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEmailDigest(option.value as typeof emailDigest);
                setSaved(false);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Notification toggles */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Notifications</label>
          <p className="text-xs text-muted-foreground">
            Choose what updates you want to be notified about
          </p>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationNewPapers}
              onChange={(e) => {
                setNotificationNewPapers(e.target.checked);
                setSaved(false);
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">New papers from followed authors</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationSocialMentions}
              onChange={(e) => {
                setNotificationSocialMentions(e.target.checked);
                setSaved(false);
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">Social mentions of saved papers</span>
          </label>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="h-4 w-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
