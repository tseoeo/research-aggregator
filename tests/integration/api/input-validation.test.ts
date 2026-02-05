/**
 * Input Validation Security Tests (P0 - Critical)
 *
 * Tests input validation for security vulnerabilities:
 * - SQL injection attempts in search queries
 * - XSS in paper titles (if applicable)
 * - Invalid date formats
 * - Oversized payloads
 * - Invalid JSON bodies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Store original env
const originalEnv = { ...process.env };

// Helper to create NextRequest
function createRequest(
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

describe('Input Validation Security', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ADMIN_SECRET = 'test_admin_secret_for_testing';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('SQL Injection Prevention', () => {
    beforeEach(() => {
      // Mock database to capture queries
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn().mockReturnThis(),
        },
      }));
    });

    it('should safely handle SQL injection in search parameter', async () => {
      const { GET } = await import('@/app/api/papers/route');

      // Attempt SQL injection via search parameter
      const maliciousSearches = [
        "'; DROP TABLE papers; --",
        "1' OR '1'='1",
        "1; SELECT * FROM users; --",
        "UNION SELECT * FROM users--",
        "' OR 1=1--",
        "admin'--",
        "1' AND '1'='1",
      ];

      for (const search of maliciousSearches) {
        const request = createRequest(
          `http://localhost:3000/api/papers?search=${encodeURIComponent(search)}`
        );

        // The request should complete without error
        // The actual protection is in the ORM (parameterized queries)
        const response = await GET(request);

        // Should not return server error from SQL injection
        expect(response.status).not.toBe(500);

        // Should return valid response (empty or with data)
        const body = await response.json();
        expect(body).toHaveProperty('papers');
      }
    });

    it('should safely handle SQL injection in category parameter', async () => {
      const { GET } = await import('@/app/api/papers/route');

      const maliciousCategories = [
        "cs.AI'; DROP TABLE papers; --",
        "cs.AI' OR '1'='1",
      ];

      for (const category of maliciousCategories) {
        const request = createRequest(
          `http://localhost:3000/api/papers?category=${encodeURIComponent(category)}`
        );

        const response = await GET(request);

        // Should not cause server error
        expect(response.status).not.toBe(500);
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should handle XSS attempts in search queries', async () => {
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn().mockReturnThis(),
        },
      }));

      const { GET } = await import('@/app/api/papers/route');

      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
        '"><script>alert(1)</script>',
      ];

      for (const xss of xssAttempts) {
        const request = createRequest(
          `http://localhost:3000/api/papers?search=${encodeURIComponent(xss)}`
        );

        const response = await GET(request);

        // API should handle without error
        expect(response.status).not.toBe(500);

        // Response should not contain unescaped script tags
        const body = await response.json();
        const bodyStr = JSON.stringify(body);

        // The API returns JSON, which is inherently escaped
        // But verify the search term isn't executed
        expect(bodyStr).not.toContain('<script>alert');
      }
    });
  });

  describe('Invalid Date Format Handling', () => {
    beforeEach(() => {
      vi.mock('@/lib/queue/queues', () => ({
        arxivFetchQueue: {
          add: vi.fn().mockResolvedValue({}),
        },
      }));
    });

    it('should reject invalid date formats in backfill-arxiv', async () => {
      const { POST } = await import('@/app/api/admin/backfill-arxiv/route');

      const invalidDates = [
        { startDate: 'not-a-date', endDate: '2026-01-02' },
        { startDate: '2026-01-01', endDate: 'invalid' },
        { startDate: '01-01-2026', endDate: '02-01-2026' }, // Wrong format
        { startDate: '2026/01/01', endDate: '2026/01/02' }, // Wrong separator
        { startDate: '2026-13-01', endDate: '2026-01-02' }, // Invalid month
        { startDate: '2026-01-32', endDate: '2026-01-02' }, // Invalid day
      ];

      for (const dates of invalidDates) {
        const request = createRequest('http://localhost:3000/api/admin/backfill-arxiv', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test_admin_secret_for_testing',
            'Content-Type': 'application/json',
          },
          body: dates,
        });

        const response = await POST(request);

        // Should return 400 for invalid dates
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toBeDefined();
      }
    });

    it('should reject date range where start is after end', async () => {
      const { POST } = await import('@/app/api/admin/backfill-arxiv/route');

      const request = createRequest('http://localhost:3000/api/admin/backfill-arxiv', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test_admin_secret_for_testing',
          'Content-Type': 'application/json',
        },
        body: {
          startDate: '2026-02-01',
          endDate: '2026-01-01', // End before start
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('startDate must be before');
    });

    it('should reject date ranges exceeding maximum limit', async () => {
      const { POST } = await import('@/app/api/admin/backfill-arxiv/route');

      const request = createRequest('http://localhost:3000/api/admin/backfill-arxiv', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test_admin_secret_for_testing',
          'Content-Type': 'application/json',
        },
        body: {
          startDate: '2025-01-01',
          endDate: '2026-12-31', // More than 60 days
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Too many dates');
    });
  });

  describe('Invalid JSON Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const { POST } = await import('@/app/api/admin/backfill-arxiv/route');

      // Create a request with invalid JSON manually
      const request = new NextRequest(
        new URL('http://localhost:3000/api/admin/backfill-arxiv'),
        {
          method: 'POST',
          headers: new Headers({
            Authorization: 'Bearer test_admin_secret_for_testing',
            'Content-Type': 'application/json',
          }),
          body: '{ invalid json }',
        }
      );

      const response = await POST(request);

      // Should return 500 or 400, not crash
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Parameter Bounds', () => {
    beforeEach(() => {
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn().mockReturnThis(),
        },
      }));
    });

    it('should enforce maximum limit on papers endpoint', async () => {
      const { GET } = await import('@/app/api/papers/route');

      // Request with very large limit
      const request = createRequest('http://localhost:3000/api/papers?limit=10000');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();

      // Limit should be capped at 100 (as per implementation)
      expect(body.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should handle negative limit gracefully', async () => {
      const { GET } = await import('@/app/api/papers/route');

      const request = createRequest('http://localhost:3000/api/papers?limit=-1');
      const response = await GET(request);

      // Should not crash, may use default or treat as invalid
      expect([200, 400]).toContain(response.status);
    });

    it('should handle non-numeric limit gracefully', async () => {
      const { GET } = await import('@/app/api/papers/route');

      const request = createRequest('http://localhost:3000/api/papers?limit=abc');
      const response = await GET(request);

      // Should not crash, will likely use default (NaN becomes 0 or default)
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Invalid Category Handling', () => {
    beforeEach(() => {
      vi.mock('@/lib/queue/queues', () => ({
        arxivFetchQueue: {
          add: vi.fn().mockResolvedValue({}),
        },
      }));
    });

    it('should reject invalid categories in backfill-arxiv', async () => {
      const { POST } = await import('@/app/api/admin/backfill-arxiv/route');

      const request = createRequest('http://localhost:3000/api/admin/backfill-arxiv', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test_admin_secret_for_testing',
          'Content-Type': 'application/json',
        },
        body: {
          startDate: '2026-01-01',
          endDate: '2026-01-02',
          categories: ['invalid.category', 'also.invalid'],
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Invalid categories');
    });
  });

  describe('Missing Required Fields', () => {
    beforeEach(() => {
      vi.mock('@/lib/queue/queues', () => ({
        arxivFetchQueue: {
          add: vi.fn().mockResolvedValue({}),
        },
      }));
    });

    it('should require startDate and endDate in backfill-arxiv', async () => {
      const { POST } = await import('@/app/api/admin/backfill-arxiv/route');

      // Missing both
      const request1 = createRequest('http://localhost:3000/api/admin/backfill-arxiv', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test_admin_secret_for_testing',
          'Content-Type': 'application/json',
        },
        body: {},
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(400);

      // Missing endDate
      const request2 = createRequest('http://localhost:3000/api/admin/backfill-arxiv', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test_admin_secret_for_testing',
          'Content-Type': 'application/json',
        },
        body: { startDate: '2026-01-01' },
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(400);
    });
  });
});
