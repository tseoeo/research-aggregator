"use client";

/**
 * Admin fetch utilities.
 * Provides a fetch wrapper that adds the Authorization: Bearer header
 * and a React hook for accessing the admin token from context.
 */

import { createContext, useContext } from "react";

// --- Context ---

interface AdminAuthContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
}

export const AdminAuthContext = createContext<AdminAuthContextValue>({
  token: null,
  setToken: () => {},
  isAuthenticated: false,
});

export function useAdminToken() {
  return useContext(AdminAuthContext);
}

// --- Fetch wrapper ---

/**
 * Fetch wrapper that adds the admin Authorization header.
 * Use in admin page components for all API calls.
 */
export async function adminFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}
