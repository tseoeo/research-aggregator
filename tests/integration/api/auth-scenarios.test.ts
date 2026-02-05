/**
 * API Auth Scenarios Tests (P0 - Critical)
 *
 * Tests authentication scenarios across API routes:
 * - Protected user routes without auth returns 401
 * - Protected user routes with valid session returns 200
 * - Public routes without auth returns 200
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createUserFixture, createSessionFixture } from '../../fixtures/users';

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

describe('API Authentication Scenarios', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Public Routes - No Auth Required', () => {
    it('GET /api/papers should return 200 without auth', async () => {
      // Mock database with full chain
      vi.doMock('@/lib/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([]),
                })),
              })),
            })),
          })),
        },
      }));

      const { GET } = await import('@/app/api/papers/route');

      const request = createRequest('http://localhost:3000/api/papers');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('papers');
      expect(body).toHaveProperty('pagination');
    });

    // Health endpoint test skipped - requires database connection mocking
    // The health endpoint verifies database connectivity directly
  });

  describe('Protected User Routes - Auth Required', () => {
    describe('GET /api/user/saved', () => {
      it('should return 401 without authentication', async () => {
        // Mock auth to return null (unauthenticated)
        vi.doMock('@/auth', () => ({
          auth: vi.fn().mockResolvedValue(null),
        }));

        vi.doMock('@/lib/db', () => ({
          db: {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                innerJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn().mockResolvedValue([]),
                  })),
                })),
              })),
            })),
          },
        }));

        const { GET } = await import('@/app/api/user/saved/route');

        const response = await GET();
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe('Unauthorized');
      });

      it('should return 200 with valid authentication', async () => {
        const user = createUserFixture();
        const session = createSessionFixture(user);

        vi.doMock('@/auth', () => ({
          auth: vi.fn().mockResolvedValue(session),
        }));

        vi.doMock('@/lib/db', () => ({
          db: {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                innerJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn().mockResolvedValue([]),
                  })),
                })),
              })),
            })),
          },
        }));

        const { GET } = await import('@/app/api/user/saved/route');

        const response = await GET();
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('papers');
        expect(body).toHaveProperty('count');
      });
    });

    describe('POST /api/user/saved', () => {
      it('should return 401 without authentication', async () => {
        vi.doMock('@/auth', () => ({
          auth: vi.fn().mockResolvedValue(null),
        }));

        vi.doMock('@/lib/db', () => ({
          db: {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                innerJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    and: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue([{ id: 'paper-123' }]),
                    })),
                    limit: vi.fn().mockResolvedValue([{ id: 'paper-123' }]),
                  })),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              values: vi.fn().mockResolvedValue(undefined),
            })),
          },
        }));

        vi.doMock('@/lib/services/arxiv', () => ({
          arxivService: {
            fetchPaperById: vi.fn().mockResolvedValue(null),
          },
        }));

        const { POST } = await import('@/app/api/user/saved/route');

        const request = createRequest('http://localhost:3000/api/user/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { arxivId: '2601.12345' },
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
      });

      it('should return 400 when arxivId is missing with valid auth', async () => {
        const user = createUserFixture();
        const session = createSessionFixture(user);

        vi.doMock('@/auth', () => ({
          auth: vi.fn().mockResolvedValue(session),
        }));

        vi.doMock('@/lib/db', () => ({
          db: {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                innerJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue([]),
                  })),
                })),
              })),
            })),
          },
        }));

        vi.doMock('@/lib/services/arxiv', () => ({
          arxivService: {
            fetchPaperById: vi.fn().mockResolvedValue(null),
          },
        }));

        const { POST } = await import('@/app/api/user/saved/route');

        const request = createRequest('http://localhost:3000/api/user/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {},
        });

        const response = await POST(request);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toContain('arXiv ID');
      });
    });

    describe('DELETE /api/user/saved', () => {
      it('should return 401 without authentication', async () => {
        vi.doMock('@/auth', () => ({
          auth: vi.fn().mockResolvedValue(null),
        }));

        vi.doMock('@/lib/db', () => ({
          db: {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                innerJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue([{ id: 'paper-123' }]),
                  })),
                })),
              })),
            })),
            delete: vi.fn(() => ({
              where: vi.fn().mockResolvedValue(undefined),
            })),
          },
        }));

        const { DELETE } = await import('@/app/api/user/saved/route');

        const request = createRequest('http://localhost:3000/api/user/saved', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: { arxivId: '2601.12345' },
        });

        const response = await DELETE(request);
        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/user/preferences', () => {
      it('should return 401 without authentication', async () => {
        vi.doMock('@/auth', () => ({
          auth: vi.fn().mockResolvedValue(null),
        }));

        vi.doMock('@/lib/db', () => ({
          db: {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([]),
              })),
            })),
          },
        }));

        const { GET } = await import('@/app/api/user/preferences/route');

        const response = await GET();
        expect(response.status).toBe(401);
      });

      // Note: The positive auth test for preferences requires the userPreferences table
      // which has a more complex query structure. The 401 test validates auth works.
    });

    describe('GET /api/user/following', () => {
      it('should return 401 without authentication', async () => {
        vi.doMock('@/auth', () => ({
          auth: vi.fn().mockResolvedValue(null),
        }));

        vi.doMock('@/lib/db', () => ({
          db: {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                innerJoin: vi.fn(() => ({
                  where: vi.fn().mockResolvedValue([]),
                })),
              })),
            })),
          },
        }));

        const { GET } = await import('@/app/api/user/following/route');

        const response = await GET();
        expect(response.status).toBe(401);
      });

      // Note: The positive auth test for following requires a more complex query structure.
      // The 401 test validates auth works correctly.
    });
  });

  describe('Session Validation', () => {
    it('should reject session without user ID', async () => {
      // Session with user but no ID
      vi.doMock('@/auth', () => ({
        auth: vi.fn().mockResolvedValue({
          user: { name: 'Test', email: 'test@example.com' }, // Missing id
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      }));

      vi.doMock('@/lib/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn().mockResolvedValue([]),
                })),
              })),
            })),
          })),
        },
      }));

      const { GET } = await import('@/app/api/user/saved/route');

      const response = await GET();
      expect(response.status).toBe(401);
    });

    it('should accept session with valid user ID', async () => {
      const user = createUserFixture({ id: 'valid-user-id' });
      const session = createSessionFixture(user);

      vi.doMock('@/auth', () => ({
        auth: vi.fn().mockResolvedValue(session),
      }));

      vi.doMock('@/lib/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn().mockResolvedValue([]),
                })),
              })),
            })),
          })),
        },
      }));

      const { GET } = await import('@/app/api/user/saved/route');

      const response = await GET();
      expect(response.status).toBe(200);
    });
  });

  describe('Auth Error Messages', () => {
    it('should return consistent error format for unauthorized requests', async () => {
      vi.doMock('@/auth', () => ({
        auth: vi.fn().mockResolvedValue(null),
      }));

      vi.doMock('@/lib/db', () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn().mockResolvedValue([]),
                })),
              })),
            })),
          })),
        },
      }));

      const { GET } = await import('@/app/api/user/saved/route');

      const response = await GET();
      const body = await response.json();

      // Error response should have consistent structure
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  });
});
