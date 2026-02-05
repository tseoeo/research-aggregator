/**
 * Admin Authentication Helper
 *
 * Centralizes admin authentication logic for API routes.
 * Uses Authorization header instead of query string secrets.
 */

import { NextRequest, NextResponse } from "next/server";

export interface AdminAuthResult {
  authorized: boolean;
  error?: NextResponse;
}

/**
 * Verify admin authentication from Authorization header.
 *
 * Expects: Authorization: Bearer <ADMIN_SECRET>
 *
 * Returns an error response if:
 * - ADMIN_SECRET environment variable is not set (500)
 * - Authorization header is missing or invalid (401)
 * - Secret does not match (401)
 */
export function verifyAdminAuth(request: NextRequest): AdminAuthResult {
  // Check if ADMIN_SECRET is configured - fail closed if not
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("[AdminAuth] ADMIN_SECRET environment variable is not set");
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Server misconfiguration: ADMIN_SECRET not set" },
        { status: 500 }
      ),
    };
  }

  // Get Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      ),
    };
  }

  // Validate Bearer token format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Invalid Authorization header format. Expected: Bearer <token>" },
        { status: 401 }
      ),
    };
  }

  const providedSecret = parts[1];

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(providedSecret, adminSecret)) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
