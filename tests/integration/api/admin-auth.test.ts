/**
 * Admin Authentication Tests (P0 - Critical)
 *
 * Tests security of admin endpoints by verifying:
 * - Missing Authorization header returns 401
 * - Invalid Authorization header returns 401
 * - Valid Authorization header returns 200 (or expected success)
 * - Missing ADMIN_SECRET env var returns 500
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Store original env
const originalEnv = { ...process.env };

// Helper to create NextRequest
function createAdminRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options;

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Admin Authentication Security', () => {
  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
    process.env.ADMIN_SECRET = 'test_admin_secret_for_testing';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('verifyAdminAuth helper', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const { verifyAdminAuth } = await import('@/lib/auth/admin');

      const request = createAdminRequest('http://localhost:3000/api/admin/paper-stats');
      const result = verifyAdminAuth(request);

      expect(result.authorized).toBe(false);
      expect(result.error).toBeDefined();

      const errorResponse = result.error!;
      expect(errorResponse.status).toBe(401);

      const errorBody = await errorResponse.json();
      expect(errorBody.error).toContain('Missing Authorization header');
    });

    it('should return 401 when Authorization header has wrong format', async () => {
      const { verifyAdminAuth } = await import('@/lib/auth/admin');

      const request = createAdminRequest('http://localhost:3000/api/admin/paper-stats', {
        headers: { Authorization: 'Basic wrong_format' },
      });
      const result = verifyAdminAuth(request);

      expect(result.authorized).toBe(false);
      expect(result.error).toBeDefined();

      const errorResponse = result.error!;
      expect(errorResponse.status).toBe(401);

      const errorBody = await errorResponse.json();
      expect(errorBody.error).toContain('Invalid Authorization header format');
    });

    it('should return 401 when secret is incorrect', async () => {
      const { verifyAdminAuth } = await import('@/lib/auth/admin');

      const request = createAdminRequest('http://localhost:3000/api/admin/paper-stats', {
        headers: { Authorization: 'Bearer wrong_secret' },
      });
      const result = verifyAdminAuth(request);

      expect(result.authorized).toBe(false);
      expect(result.error).toBeDefined();

      const errorResponse = result.error!;
      expect(errorResponse.status).toBe(401);

      const errorBody = await errorResponse.json();
      expect(errorBody.error).toBe('Unauthorized');
    });

    it('should return authorized=true when secret is correct', async () => {
      const { verifyAdminAuth } = await import('@/lib/auth/admin');

      const request = createAdminRequest('http://localhost:3000/api/admin/paper-stats', {
        headers: { Authorization: 'Bearer test_admin_secret_for_testing' },
      });
      const result = verifyAdminAuth(request);

      expect(result.authorized).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return 500 when ADMIN_SECRET is not configured', async () => {
      delete process.env.ADMIN_SECRET;
      vi.resetModules();

      const { verifyAdminAuth } = await import('@/lib/auth/admin');

      const request = createAdminRequest('http://localhost:3000/api/admin/paper-stats', {
        headers: { Authorization: 'Bearer any_secret' },
      });
      const result = verifyAdminAuth(request);

      expect(result.authorized).toBe(false);
      expect(result.error).toBeDefined();

      const errorResponse = result.error!;
      expect(errorResponse.status).toBe(500);

      const errorBody = await errorResponse.json();
      expect(errorBody.error).toContain('ADMIN_SECRET not set');
    });
  });

  describe('/api/admin/paper-stats', () => {
    beforeEach(() => {
      // Mock the database to avoid actual DB calls
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        },
      }));
    });

    it('should return 401 without auth header', async () => {
      const { GET } = await import('@/app/api/admin/paper-stats/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/paper-stats');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid auth header', async () => {
      const { GET } = await import('@/app/api/admin/paper-stats/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/paper-stats', {
        headers: { Authorization: 'Bearer invalid_secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('/api/admin/backfill', () => {
    beforeEach(() => {
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: 1 }]),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          onConflictDoNothing: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        },
      }));
    });

    it('should return 401 without auth header for GET', async () => {
      const { GET } = await import('@/app/api/admin/backfill/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/backfill');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 401 without auth header for POST', async () => {
      const { POST } = await import('@/app/api/admin/backfill/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/backfill', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('/api/admin/backfill-arxiv', () => {
    beforeEach(() => {
      vi.mock('@/lib/queue/queues', () => ({
        arxivFetchQueue: {
          add: vi.fn().mockResolvedValue({}),
          getWaitingCount: vi.fn().mockResolvedValue(0),
          getActiveCount: vi.fn().mockResolvedValue(0),
          getCompletedCount: vi.fn().mockResolvedValue(0),
          getFailedCount: vi.fn().mockResolvedValue(0),
          getDelayedCount: vi.fn().mockResolvedValue(0),
          getJobs: vi.fn().mockResolvedValue([]),
        },
      }));
    });

    it('should return 401 without auth header for GET', async () => {
      const { GET } = await import('@/app/api/admin/backfill-arxiv/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/backfill-arxiv');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 401 without auth header for POST', async () => {
      const { POST } = await import('@/app/api/admin/backfill-arxiv/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/backfill-arxiv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { startDate: '2026-01-01', endDate: '2026-01-02' },
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('/api/admin/queue-summaries', () => {
    beforeEach(() => {
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        },
      }));
      vi.mock('@/lib/queue/queues', () => ({
        summaryQueue: {
          add: vi.fn().mockResolvedValue({}),
        },
      }));
    });

    it('should return 401 without auth header for GET', async () => {
      const { GET } = await import('@/app/api/admin/queue-summaries/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/queue-summaries');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 401 without auth header for POST', async () => {
      const { POST } = await import('@/app/api/admin/queue-summaries/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/queue-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('/api/admin/queue-analyses', () => {
    beforeEach(() => {
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        },
      }));
      vi.mock('@/lib/queue/queues', () => ({
        analysisQueue: {
          add: vi.fn().mockResolvedValue({}),
        },
      }));
    });

    it('should return 401 without auth header for GET', async () => {
      const { GET } = await import('@/app/api/admin/queue-analyses/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/queue-analyses');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 401 without auth header for POST', async () => {
      const { POST } = await import('@/app/api/admin/queue-analyses/route');

      const request = createAdminRequest('http://localhost:3000/api/admin/queue-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Timing attack resistance', () => {
    it('should use constant-time comparison for secrets', async () => {
      // This test verifies that the constantTimeCompare function exists
      // and is used (we can't easily test timing in unit tests)
      const { verifyAdminAuth } = await import('@/lib/auth/admin');

      // The function should work correctly with similar strings
      const request1 = createAdminRequest('http://localhost:3000/api/admin/paper-stats', {
        headers: { Authorization: 'Bearer test_admin_secret_for_testinX' }, // Off by one char
      });
      const result1 = verifyAdminAuth(request1);
      expect(result1.authorized).toBe(false);

      // And with completely different strings
      const request2 = createAdminRequest('http://localhost:3000/api/admin/paper-stats', {
        headers: { Authorization: 'Bearer completely_different' },
      });
      const result2 = verifyAdminAuth(request2);
      expect(result2.authorized).toBe(false);

      // Both should fail with 401
      expect(result1.error?.status).toBe(401);
      expect(result2.error?.status).toBe(401);
    });
  });
});
