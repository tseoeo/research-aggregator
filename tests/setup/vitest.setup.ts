/**
 * Vitest Setup File
 *
 * This file runs before all tests.
 * It sets up the test environment, mocks, and global configuration.
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(__dirname, '../../.env.test') });

// Set required environment variables for tests
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || 'test_admin_secret_for_testing';
process.env.AI_ENABLED = process.env.AI_ENABLED || 'false';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test_key_for_mocking';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/research_aggregator_test';

// Mock external services by default
beforeAll(() => {
  // Suppress console logs during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();
});

// Global fetch mock helper
export function mockFetch(response: unknown, options: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = options;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(typeof response === 'string' ? response : JSON.stringify(response)),
  });
}

// Helper to create mock NextRequest
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Request {
  const { method = 'GET', headers = {}, body } = options;

  const request = new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  return request;
}
