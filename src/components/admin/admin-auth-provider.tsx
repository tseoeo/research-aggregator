"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AdminAuthContext } from "@/lib/admin/use-admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, AlertCircle, Loader2 } from "lucide-react";

const STORAGE_KEY = "admin_token";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setTokenState(stored);
    setMounted(true);
  }, []);

  const setToken = useCallback((newToken: string | null) => {
    if (newToken) {
      sessionStorage.setItem(STORAGE_KEY, newToken);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setTokenState(newToken);
  }, []);

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return <AdminLoginGate onAuthenticated={setToken} />;
  }

  return (
    <AdminAuthContext.Provider value={{ token, setToken, isAuthenticated: true }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

function AdminLoginGate({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/ai-toggle", {
        headers: { Authorization: `Bearer ${secret.trim()}` },
      });

      if (res.ok) {
        onAuthenticated(secret.trim());
      } else if (res.status === 401) {
        setError("Invalid admin secret");
      } else {
        setError(`Server error (${res.status})`);
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted mb-3">
            <Lock className="size-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Admin Access</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the admin secret to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoFocus
              disabled={loading}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || !secret.trim()}>
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Authenticate"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
