"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

interface SaveButtonProps {
  arxivId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showText?: boolean;
}

export function SaveButton({
  arxivId,
  variant = "outline",
  size = "icon",
  showText = false,
}: SaveButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if paper is saved on mount
  useEffect(() => {
    async function checkSaved() {
      if (status === "loading") return;

      if (!session?.user) {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`/api/user/saved/${arxivId}`);
        if (response.ok) {
          const data = await response.json();
          setSaved(data.saved);
        }
      } catch (error) {
        console.error("Error checking saved status:", error);
      } finally {
        setChecking(false);
      }
    }

    checkSaved();
  }, [arxivId, session, status]);

  const handleClick = async () => {
    if (status === "loading") return;

    // Redirect to login if not authenticated
    if (!session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setLoading(true);

    try {
      if (saved) {
        // Unsave
        const response = await fetch("/api/user/saved", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arxivId }),
        });

        if (response.ok) {
          setSaved(false);
        }
      } else {
        // Save
        const response = await fetch("/api/user/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arxivId }),
        });

        if (response.ok) {
          setSaved(true);
        }
      }
    } catch (error) {
      console.error("Error toggling save:", error);
    } finally {
      setLoading(false);
    }
  };

  if (checking && session?.user) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showText && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      title={saved ? "Remove from saved" : "Save paper"}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="h-4 w-4 text-primary" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {showText && (
        <span className="ml-2">{saved ? "Saved" : "Save"}</span>
      )}
    </Button>
  );
}
