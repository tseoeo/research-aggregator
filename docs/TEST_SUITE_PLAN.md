# Research Aggregator - Comprehensive Test Suite Plan

**Version:** 1.0
**Date:** 2026-02-05
**Author:** Test Planning Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Testing Strategy Overview](#testing-strategy-overview)
3. [Test Infrastructure Setup](#test-infrastructure-setup)
4. [Unit Tests](#1-unit-tests)
5. [Integration Tests](#2-integration-tests)
6. [API Route Tests](#3-api-route-tests)
7. [Database Tests](#4-database-tests)
8. [Worker Tests](#5-worker-tests)
9. [E2E Tests](#6-e2e-tests)
10. [Load/Performance Tests](#7-loadperformance-tests)
11. [Security Tests](#8-security-tests)
12. [Priority Matrix](#9-priority-matrix)
13. [CI/CD Pipeline Configuration](#10-cicd-pipeline-configuration)
14. [Appendix: Test Data Factories](#appendix-test-data-factories)

---

## Executive Summary

This document outlines a comprehensive test suite for the Research Aggregator application. The application consists of:

- **Next.js 16 frontend** with React 19
- **API routes** for papers, users, authors, and admin functionality
- **Background workers** (BullMQ) for arXiv fetching, AI processing, social monitoring
- **External integrations**: arXiv API, OpenRouter (AI), Serper (news), social platforms
- **Database**: PostgreSQL with Drizzle ORM
- **Queue system**: Redis with BullMQ

### Critical Testing Areas (Highest Risk)

1. **Admin endpoints security** - Prevent unauthorized access to cost-burning operations
2. **AI processing pipeline** - Validate summary/analysis generation and storage
3. **Paper ingestion** - Ensure reliable arXiv data fetching and deduplication
4. **Authentication flows** - NextAuth integration with GitHub OAuth
5. **Data integrity** - Race conditions in paper insertion and user operations

---

## Testing Strategy Overview

### Testing Pyramid

```
                    /\
                   /  \  E2E Tests (5%)
                  /    \  Critical user flows
                 /______\
                /        \  Integration Tests (25%)
               /          \  API routes, DB, workers
              /____________\
             /              \  Unit Tests (70%)
            /                \  Services, utilities, components
           /__________________\
```

### Recommended Tools

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Tests | Vitest | Fast, ESM-native, TypeScript support |
| Component Tests | @testing-library/react | React component testing |
| API Tests | Vitest + node-mocks-http | Next.js API route testing |
| Integration Tests | Vitest + Testcontainers | DB/Redis integration |
| E2E Tests | Playwright | Browser-based user flows |
| Load Tests | k6 | Performance and load testing |
| Security Tests | OWASP ZAP | Automated security scanning |

---

## Test Infrastructure Setup

### Directory Structure

```
research-aggregator/
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   ├── lib/
│   │   └── components/
│   ├── integration/
│   │   ├── api/
│   │   ├── db/
│   │   └── workers/
│   ├── e2e/
│   │   ├── flows/
│   │   └── fixtures/
│   ├── load/
│   │   └── scripts/
│   ├── security/
│   ├── fixtures/
│   │   ├── papers.ts
│   │   ├── users.ts
│   │   └── analyses.ts
│   ├── mocks/
│   │   ├── openrouter.ts
│   │   ├── arxiv.ts
│   │   └── serper.ts
│   └── setup/
│       ├── vitest.setup.ts
│       ├── playwright.config.ts
│       └── testcontainers.ts
├── vitest.config.ts
├── playwright.config.ts
└── .env.test
```

### Environment Configuration (`.env.test`)

```env
# Database - Use separate test database
DATABASE_URL=postgresql://test:test@localhost:5433/research_aggregator_test

# Redis - Separate test instance
REDIS_URL=redis://localhost:6380

# Auth - Test credentials
GITHUB_CLIENT_ID=test_client_id
GITHUB_CLIENT_SECRET=test_client_secret
NEXTAUTH_SECRET=test_secret_32_characters_long!!
NEXTAUTH_URL=http://localhost:3000

# Admin - Test secret
ADMIN_SECRET=test_admin_secret_for_testing

# AI - Mock or skip
AI_ENABLED=false
OPENROUTER_API_KEY=test_key_for_mocking

# External APIs - Mock
SERPER_API_KEY=test_serper_key
```

### Vitest Configuration (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'tests/load/**'],
    setupFiles: ['tests/setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/components/ui/**'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 75,
        statements: 80,
      },
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Dependencies to Install

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test msw testcontainers
npm install -D node-mocks-http
```

---

## 1. Unit Tests

### 1.1 ArXiv Service (`src/lib/services/arxiv.ts`)

**File:** `tests/unit/services/arxiv.test.ts`

| Test Case | Description | Edge Cases |
|-----------|-------------|------------|
| `parseArxivXml` | Parse valid arXiv XML response | Empty response, malformed XML |
| `parseArxivXml` | Extract all paper fields correctly | Missing optional fields (DOI, affiliation) |
| `parseArxivXml` | Handle multiple entries | Single entry, zero entries |
| `buildQueryUrl` | Generate correct query URL | Multiple categories, date ranges |
| `buildQueryUrl` | Encode special characters | Spaces, unicode in search terms |
| `fetchWithTimeout` | Abort on timeout | Network error, slow response |
| `enforceRateLimit` | Respect 3-second rate limit | Rapid sequential calls |
| `fetchRecentPapers` | Return parsed papers | API error responses |
| `fetchPaperById` | Handle version suffixes | "2401.12345v1" vs "2401.12345" |
| `fetchByDateRange` | Format dates correctly | Single day, date range |
| `fetchAllPapersForDate` | Paginate until complete | Partial results, API failures |

**Example Test:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArxivService } from '@/lib/services/arxiv';

describe('ArxivService', () => {
  describe('parseArxivXml', () => {
    it('should extract paper fields from valid XML', () => {
      const xml = `<?xml version="1.0"?>
        <feed>
          <entry>
            <id>http://arxiv.org/abs/2401.12345v1</id>
            <title>Test Paper Title</title>
            <summary>Test abstract content</summary>
            <author><name>John Doe</name></author>
            <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
            <arxiv:primary_category term="cs.AI"/>
            <published>2024-01-15T00:00:00Z</published>
            <updated>2024-01-16T00:00:00Z</updated>
          </entry>
        </feed>`;

      const papers = parseArxivXml(xml);

      expect(papers).toHaveLength(1);
      expect(papers[0].arxivId).toBe('2401.12345v1');
      expect(papers[0].title).toBe('Test Paper Title');
      expect(papers[0].authors).toHaveLength(1);
      expect(papers[0].primaryCategory).toBe('cs.AI');
    });

    it('should handle empty feed gracefully', () => {
      const xml = `<?xml version="1.0"?><feed></feed>`;
      const papers = parseArxivXml(xml);
      expect(papers).toHaveLength(0);
    });

    it('should skip entries with missing required fields', () => {
      const xml = `<?xml version="1.0"?>
        <feed>
          <entry><title>No ID paper</title></entry>
        </feed>`;
      const papers = parseArxivXml(xml);
      expect(papers).toHaveLength(0);
    });
  });
});
```

### 1.2 OpenRouter Service (`src/lib/services/openrouter.ts`)

**File:** `tests/unit/services/openrouter.test.ts`

| Test Case | Description | Edge Cases |
|-----------|-------------|------------|
| `constructor` | Initialize with API key | Missing key, custom model |
| `generateSummary` | Return structured response | API error, invalid JSON response |
| `generateSummary` | Parse markdown-wrapped JSON | `json` blocks, plain JSON |
| `generateSummary` | Validate response schema | Missing bullets, invalid ELI5 |
| `generateSummary` | Fallback on partial response | 2 bullets instead of 3 |
| `supportsJsonMode` | Check model JSON support | OpenAI vs non-OpenAI models |
| `isConfigured` | Check API key presence | Empty string, undefined |

**Mock Strategy:**

```typescript
// tests/mocks/openrouter.ts
import { vi } from 'vitest';

export const mockOpenRouterResponse = {
  success: {
    id: 'gen-123',
    model: 'z-ai/glm-4.7',
    choices: [{
      message: {
        role: 'assistant',
        content: JSON.stringify({
          bullets: ['Point 1', 'Point 2', 'Point 3'],
          eli5: 'Simple explanation',
        }),
      },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  },
  error: {
    error: { message: 'API error', code: 'rate_limit_exceeded' },
  },
};

export function createOpenRouterMock() {
  return vi.fn().mockImplementation(() => ({
    json: () => Promise.resolve(mockOpenRouterResponse.success),
    ok: true,
  }));
}
```

### 1.3 Paper Analysis Service (`src/lib/services/paper-analysis.ts`)

**File:** `tests/unit/services/paper-analysis.test.ts`

| Test Case | Description | Edge Cases |
|-----------|-------------|------------|
| `normalizeAnalysisResponse` | Convert null to empty arrays | All fields null |
| `normalizeAnalysisResponse` | Coerce string to array | Single string evidence_pointers |
| `normalizeAnalysisResponse` | Clamp confidence values | Values > 1, negative values |
| `normalizeAnalysisResponse` | Normalize direction enum | "higher" -> "up", invalid values |
| `normalizeAnalysisResponse` | Handle nested null objects | Null interestingness, business_primitives |
| `paperCardAnalysisResponseSchema` | Validate complete response | All required fields |
| `paperCardAnalysisResponseSchema` | Reject invalid role | Role not in enum |
| `analyzePaper` | Build correct user prompt | With/without authors, year |
| `loadTaxonomyContext` | Load active taxonomy entries | Empty taxonomy |

### 1.4 Serper Service (`src/lib/services/serper.ts`)

**File:** `tests/unit/services/serper.test.ts`

| Test Case | Description | Edge Cases |
|-----------|-------------|------------|
| `generateUrlHash` | Generate consistent hash | Same URL = same hash |
| `searchNews` | Return mapped articles | Empty results |
| `searchNews` | Handle rate limiting | 429 response |
| `searchNews` | Handle auth errors | 401 response |
| `searchForPaper` | Deduplicate across queries | Same article from ID and title search |
| `extractSource` | Parse domain from URL | Invalid URL, www prefix |

### 1.5 Social Aggregator Service (`src/lib/services/social-aggregator.ts`)

**File:** `tests/unit/services/social-aggregator.test.ts`

| Test Case | Description | Edge Cases |
|-----------|-------------|------------|
| `blueskyToMention` | Convert Bluesky post format | Missing optional fields |
| `redditToMention` | Convert Reddit post format | Self-text vs link post |
| `tweetToMention` | Convert Tweet format | Thread vs standalone |
| `fetchMentionsForPaper` | Aggregate from all platforms | Platform fetch failures |
| `fetchMentionsForPaper` | Deduplicate across platforms | Same content, different platforms |
| `getMentionStats` | Calculate engagement totals | Zero mentions |

### 1.6 AI Config Helper (`src/lib/ai/config.ts`)

**File:** `tests/unit/lib/ai-config.test.ts`

| Test Case | Description | Edge Cases |
|-----------|-------------|------------|
| `isAiEnabled` | Return true when fully configured | AI_ENABLED=true + key present |
| `isAiEnabled` | Return false when disabled | AI_ENABLED=false |
| `isAiEnabled` | Return false when key missing | AI_ENABLED=true, no key |
| `getAiStatus` | Return correct status enum | All three states |
| `getAiStatusMessage` | Return human-readable message | Each status |

### 1.7 Admin Auth Helper (`src/lib/auth/admin.ts`)

**File:** `tests/unit/lib/admin-auth.test.ts`

| Test Case | Description | Edge Cases |
|-----------|-------------|------------|
| `verifyAdminAuth` | Accept valid Bearer token | Correct secret |
| `verifyAdminAuth` | Reject missing header | No Authorization header |
| `verifyAdminAuth` | Reject malformed header | "Basic" instead of "Bearer" |
| `verifyAdminAuth` | Reject wrong secret | Incorrect token value |
| `verifyAdminAuth` | Error on missing ADMIN_SECRET | Env var not set |
| `constantTimeCompare` | Prevent timing attacks | Similar strings |

### 1.8 React Components

**File:** `tests/unit/components/` directory

| Component | Test Cases |
|-----------|------------|
| `PaperCard` | Render with all fields, render without analysis, tab switching |
| `SaveButton` | Show saved/unsaved state, handle auth requirement |
| `AnalysisBadgesRow` | Render all badge types, handle missing data |
| `SummaryTab` | Render bullets, handle empty/loading state |
| `Eli5Tab` | Render explanation, handle not configured state |
| `SocialTab` | Render mentions by platform, handle empty state |
| `NewsTab` | Render news articles, handle no news |
| `PreferencesForm` | Submit preferences, validate categories |

---

## 2. Integration Tests

### 2.1 Database Integration

**Setup: Testcontainers for PostgreSQL**

```typescript
// tests/setup/testcontainers.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof drizzle>;

export async function setupTestDb() {
  container = await new PostgreSqlContainer()
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionString = container.getConnectionUri();
  const client = postgres(connectionString);
  db = drizzle(client, { schema });

  // Run migrations
  await runMigrations(db);

  return { db, connectionString };
}

export async function teardownTestDb() {
  await container?.stop();
}
```

**File:** `tests/integration/db/schema.test.ts`

| Test Case | Description |
|-----------|-------------|
| Papers table | Insert, unique constraint on sourceId+externalId |
| Papers table | ON CONFLICT DO NOTHING behavior |
| Paper authors | Many-to-many relationship integrity |
| Social mentions | Platform foreign key constraint |
| User saved papers | Composite primary key |
| Paper card analyses | One-to-one with paper |
| Taxonomy entries | Unique name constraint |
| Cascade deletes | Paper deletion cascades to mentions, analysis |

**Example Test:**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { setupTestDb, teardownTestDb } from '../../setup/testcontainers';
import { papers, paperSources, paperCardAnalyses } from '@/lib/db/schema';

describe('Database Schema Integration', () => {
  let db: TestDb;

  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    // Clean tables
    await db.delete(papers);
    await db.delete(paperSources);
  });

  it('should enforce unique constraint on sourceId+externalId', async () => {
    const sourceId = await insertArxivSource(db);

    await db.insert(papers).values({
      sourceId,
      externalId: '2401.12345',
      title: 'First paper',
    });

    // Second insert with same IDs should fail
    await expect(
      db.insert(papers).values({
        sourceId,
        externalId: '2401.12345',
        title: 'Duplicate paper',
      })
    ).rejects.toThrow();
  });

  it('should handle ON CONFLICT DO NOTHING correctly', async () => {
    const sourceId = await insertArxivSource(db);

    // First insert
    await db.insert(papers).values({
      sourceId,
      externalId: '2401.12345',
      title: 'Original paper',
    });

    // Second insert with onConflictDoNothing
    const result = await db
      .insert(papers)
      .values({
        sourceId,
        externalId: '2401.12345',
        title: 'Should not insert',
      })
      .onConflictDoNothing()
      .returning({ id: papers.id });

    expect(result).toHaveLength(0);

    // Verify original unchanged
    const [paper] = await db.select().from(papers).where(eq(papers.externalId, '2401.12345'));
    expect(paper.title).toBe('Original paper');
  });

  it('should cascade delete paper analysis when paper deleted', async () => {
    const sourceId = await insertArxivSource(db);

    const [paper] = await db.insert(papers).values({
      sourceId,
      externalId: '2401.12345',
      title: 'Paper with analysis',
    }).returning();

    await db.insert(paperCardAnalyses).values({
      paperId: paper.id,
      role: 'Primitive',
      roleConfidence: 0.8,
      timeToValue: 'Soon',
      timeToValueConfidence: 0.7,
      interestingness: { total_score: 8, tier: 'high', checks: [] },
    });

    // Delete paper
    await db.delete(papers).where(eq(papers.id, paper.id));

    // Analysis should be gone
    const analyses = await db.select().from(paperCardAnalyses).where(eq(paperCardAnalyses.paperId, paper.id));
    expect(analyses).toHaveLength(0);
  });
});
```

### 2.2 Redis Integration

**File:** `tests/integration/redis/queues.test.ts`

| Test Case | Description |
|-----------|-------------|
| Queue creation | All queues initialize correctly |
| Job addition | Jobs added with correct options |
| Job retry | Exponential backoff on failure |
| Rate limiting | Limiter config applied |
| Job completion | Completed jobs stored/removed |
| Job failure | Failed jobs stored with error |

### 2.3 External API Integration (with mocks)

**File:** `tests/integration/external/arxiv.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArxivService } from '@/lib/services/arxiv';
import { mockArxivResponse } from '../../mocks/arxiv';

describe('ArXiv API Integration', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should retry on 5xx errors with backoff', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, text: () => mockArxivResponse.singlePaper });

    const service = new ArxivService();
    // Note: ArxivService currently doesn't have retry logic - this test documents needed behavior
  });

  it('should abort on timeout', async () => {
    fetchMock.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 35000)));

    const service = new ArxivService();
    await expect(service.fetchRecentPapers('cs.AI', 10)).rejects.toThrow();
  });
});
```

---

## 3. API Route Tests

### 3.1 Public API Routes

**File:** `tests/integration/api/papers.test.ts`

#### GET /api/papers

| Test Case | Expected Result |
|-----------|-----------------|
| Default request | Returns 20 papers from cs.AI |
| With category filter | Returns papers from specified category |
| With search query | Returns matching papers (ilike search) |
| With limit parameter | Respects limit (max 100) |
| Empty database | Returns empty array, no error |
| Database error | Returns 500 with error message |

**Example Test:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { GET } from '@/app/api/papers/route';
import { setupTestDb, teardownTestDb, seedPapers } from '../../setup/testcontainers';

describe('GET /api/papers', () => {
  beforeAll(async () => {
    await setupTestDb();
    await seedPapers(25); // Seed 25 test papers
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should return papers with default parameters', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/papers',
    });

    const response = await GET(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.papers).toHaveLength(20);
    expect(data.pagination.category).toBe('cs.AI');
  });

  it('should filter by category', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/papers?category=cs.LG',
    });

    const response = await GET(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    data.papers.forEach((paper: any) => {
      expect(paper.categories).toContain('cs.LG');
    });
  });

  it('should perform case-insensitive search', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/papers?search=TRANSFORMER',
    });

    const response = await GET(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should find papers with "transformer" in title/abstract
  });

  it('should include analysis data when present', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/papers',
    });

    const response = await GET(req as any);
    const data = await response.json();

    const paperWithAnalysis = data.papers.find((p: any) => p.analysis !== null);
    if (paperWithAnalysis) {
      expect(paperWithAnalysis.analysis).toHaveProperty('role');
      expect(paperWithAnalysis.analysis).toHaveProperty('interestingness');
    }
  });
});
```

#### GET /api/papers/[id]

| Test Case | Expected Result |
|-----------|-----------------|
| Valid UUID | Returns paper with all relations |
| Invalid UUID format | Returns 400 |
| Non-existent UUID | Returns 404 |
| Paper with analysis | Includes full analysis data |

#### GET /api/papers/[id]/analysis

| Test Case | Expected Result |
|-----------|-----------------|
| Paper with analysis | Returns full analysis |
| Paper without analysis | Returns 404 or empty |
| Invalid paper ID | Returns 404 |

#### GET /api/papers/[id]/mentions

| Test Case | Expected Result |
|-----------|-----------------|
| Paper with mentions | Returns sorted by engagement |
| Paper without mentions | Returns empty array |
| Platform filter | Returns only specified platform |

#### GET /api/papers/trending

| Test Case | Expected Result |
|-----------|-----------------|
| Default request | Returns papers sorted by mentions |
| With time filter | Returns papers from time range |

### 3.2 User API Routes (Requires Auth)

**File:** `tests/integration/api/user.test.ts`

#### GET /api/user/saved

| Test Case | Expected Result |
|-----------|-----------------|
| Authenticated user | Returns saved papers |
| Unauthenticated | Returns 401 |
| No saved papers | Returns empty array |

#### POST /api/user/saved

| Test Case | Expected Result |
|-----------|-----------------|
| Valid arXiv ID | Creates saved paper entry |
| Already saved | Returns 409 Conflict |
| Invalid arXiv ID | Returns 400 |
| Paper not in DB | Fetches from arXiv, creates, saves |
| Unauthenticated | Returns 401 |

#### DELETE /api/user/saved

| Test Case | Expected Result |
|-----------|-----------------|
| Valid saved paper | Removes from saved |
| Not saved | Returns success (idempotent) |
| Unauthenticated | Returns 401 |

**Auth Mocking:**

```typescript
import { vi } from 'vitest';

// Mock NextAuth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/auth';

describe('User API Routes', () => {
  it('should reject unauthenticated requests', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    const response = await GET_SAVED(req);
    expect(response.status).toBe(401);
  });

  it('should allow authenticated requests', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
    });

    const response = await GET_SAVED(req);
    expect(response.status).toBe(200);
  });
});
```

### 3.3 Admin API Routes

**File:** `tests/integration/api/admin.test.ts`

#### Authentication Tests (All Admin Routes)

| Test Case | Expected Result |
|-----------|-----------------|
| No Authorization header | Returns 401 |
| Invalid Bearer format | Returns 401 |
| Wrong secret | Returns 401 |
| Missing ADMIN_SECRET env | Returns 500 |
| Valid auth | Proceeds with request |

#### POST /api/admin/backfill

| Test Case | Expected Result |
|-----------|-----------------|
| AI disabled | Returns 503 |
| Valid request | Fetches papers, returns count |
| arXiv rate limited | Returns 429 |
| Custom count param | Respects count limit |

#### POST /api/admin/queue-summaries

| Test Case | Expected Result |
|-----------|-----------------|
| AI disabled | Returns 503 |
| Papers without summaries | Queues jobs, returns count |
| All papers have summaries | Returns 0 queued |

#### POST /api/admin/queue-analyses

| Test Case | Expected Result |
|-----------|-----------------|
| AI disabled | Returns 503 |
| Papers without analyses | Queues jobs, returns count |

#### GET /api/admin/queues

| Test Case | Expected Result |
|-----------|-----------------|
| Valid auth | Returns queue stats |
| Queue empty | Returns counts of 0 |

### 3.4 Health/Status Routes

**File:** `tests/integration/api/health.test.ts`

#### GET /api/health

| Test Case | Expected Result |
|-----------|-----------------|
| All services up | Returns healthy status |
| DB down | Returns unhealthy with details |
| Redis down | Returns partial healthy |

#### GET /api/status

| Test Case | Expected Result |
|-----------|-----------------|
| Normal operation | Returns paper count, next fetch time |
| AI status | Reflects AI_ENABLED setting |

---

## 4. Database Tests

### 4.1 Migration Tests

**File:** `tests/integration/db/migrations.test.ts`

| Test Case | Description |
|-----------|-------------|
| Fresh migration | All tables created on empty DB |
| Migration idempotency | Running migrations twice is safe |
| Rollback safety | Can rollback without data loss |
| Index creation | All indexes created correctly |

### 4.2 Query Correctness Tests

**File:** `tests/integration/db/queries.test.ts`

| Test Case | Description |
|-----------|-------------|
| Batch author fetch | IN query returns all authors |
| Batch mention fetch | Grouped correctly by paper ID |
| Array contains query | Category filter works with arrays |
| Full-text search | ilike search finds matches |
| Pagination | LIMIT/OFFSET work correctly |
| Sorting | ORDER BY publishedAt DESC |

### 4.3 Race Condition Tests

**File:** `tests/integration/db/concurrency.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { papers, paperSources } from '@/lib/db/schema';

describe('Database Race Conditions', () => {
  it('should handle concurrent paper inserts with same ID', async () => {
    const sourceId = await getArxivSourceId();

    // Simulate 5 concurrent insert attempts
    const promises = Array(5).fill(null).map(() =>
      db.insert(papers)
        .values({
          sourceId,
          externalId: '2401.99999',
          title: 'Concurrent test',
        })
        .onConflictDoNothing()
        .returning({ id: papers.id })
    );

    const results = await Promise.all(promises);

    // Only one should have inserted
    const successfulInserts = results.filter(r => r.length > 0);
    expect(successfulInserts.length).toBe(1);

    // Verify only one paper exists
    const allPapers = await db.select().from(papers)
      .where(eq(papers.externalId, '2401.99999'));
    expect(allPapers).toHaveLength(1);
  });

  it('should handle concurrent user save operations', async () => {
    // Similar test for userSavedPapers
  });
});
```

---

## 5. Worker Tests

### 5.1 ArXiv Worker (`src/lib/queue/workers/arxiv-worker.ts`)

**File:** `tests/integration/workers/arxiv-worker.test.ts`

| Test Case | Description |
|-----------|-------------|
| `processArxivFetch` | Fetches papers, inserts new, skips existing |
| `processArxivFetch` | Deduplicates across categories |
| `processArxivFetch` | Queues AI jobs only when AI_ENABLED |
| `processArxivFetch` | Queues social monitor jobs for all papers |
| `processArxivFetchByDate` | Acquires distributed lock |
| `processArxivFetchByDate` | Skips if lock held by another worker |
| `processArxivFetchByDate` | Releases lock on completion |
| `processArxivFetchByDate` | Releases lock on error |
| `processArxivFetchByDate` | Updates ingestion_runs table |
| Rate limiting | Respects 3-second delay between API calls |
| Error handling | Records failed ingestion runs |

**Mock Setup:**

```typescript
import { vi, beforeEach } from 'vitest';
import { createArxivWorker } from '@/lib/queue/workers/arxiv-worker';

// Mock external dependencies
vi.mock('@/lib/services/arxiv', () => ({
  arxivService: {
    fetchPapersPaginated: vi.fn(),
    fetchAllPapersForDate: vi.fn(),
  },
  AI_CATEGORIES: ['cs.AI', 'cs.LG'],
}));

vi.mock('@/lib/queue/queues', () => ({
  summaryQueue: { add: vi.fn() },
  analysisQueue: { add: vi.fn() },
  socialMonitorQueue: { add: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  redisConnection: {},
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));
```

### 5.2 Summary Worker (`src/lib/queue/workers/summary-worker.ts`)

**File:** `tests/integration/workers/summary-worker.test.ts`

| Test Case | Description |
|-----------|-------------|
| `processSummaryJob` | Calls OpenRouter, updates paper |
| `processSummaryJob` | Handles API key not configured |
| `processSummaryJob` | Handles OpenRouter errors |
| `processSummaryJob` | Uses model override if provided |
| Idempotency | Should skip if summary exists (missing feature) |
| Rate limiting | Respects limiter config (10/min) |
| Retry | Retries 3 times with exponential backoff |

### 5.3 Analysis Worker (`src/lib/queue/workers/analysis-worker.ts`)

**File:** `tests/integration/workers/analysis-worker.test.ts`

| Test Case | Description |
|-----------|-------------|
| `processAnalysisJob` | Generates analysis, saves to DB |
| `processAnalysisJob` | Skips if analysis exists (idempotent) |
| `processAnalysisJob` | Force re-analysis deletes existing |
| `processAnalysisJob` | Maps use cases to taxonomy |
| `processAnalysisJob` | Increments taxonomy usage count |
| `processAnalysisJob` | Creates provisional taxonomy proposals |
| `processAnalysisJob` | Handles missing taxonomy entries |
| Rate limiting | Respects limiter config (5/min) |

### 5.4 Social Monitor Worker

**File:** `tests/integration/workers/social-worker.test.ts`

| Test Case | Description |
|-----------|-------------|
| Paper monitoring | Fetches from all platforms |
| Deduplication | Doesn't insert duplicate mentions |
| Platform failures | Continues on single platform failure |
| Engagement sorting | Returns highest engagement first |

### 5.5 News Worker

**File:** `tests/integration/workers/news-worker.test.ts`

| Test Case | Description |
|-----------|-------------|
| News fetch | Calls Serper service |
| URL deduplication | Uses urlHash for dedup |
| Service disabled | Skips gracefully when no API key |

### 5.6 Backfill Worker

**File:** `tests/integration/workers/backfill-worker.test.ts`

| Test Case | Description |
|-----------|-------------|
| Date-based fetch | Fetches papers for specific date |
| Cross-category dedup | Same paper in multiple categories |
| Does NOT queue AI | Backfill doesn't auto-trigger AI |
| Rate limiting | Respects arXiv rate limits |

---

## 6. E2E Tests

### 6.1 Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 6.2 Critical User Flows

**File:** `tests/e2e/flows/homepage.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load and display papers', async ({ page }) => {
    await page.goto('/');

    // Wait for papers to load
    await expect(page.getByRole('heading', { name: /artificial intelligence/i })).toBeVisible();

    // Check paper cards are rendered
    const paperCards = page.locator('.paper-card');
    await expect(paperCards.first()).toBeVisible();
  });

  test('should filter papers by category', async ({ page }) => {
    await page.goto('/');

    // Click ML category
    await page.getByRole('link', { name: 'ML' }).click();

    // URL should update
    await expect(page).toHaveURL('/?category=cs.LG');

    // Heading should update
    await expect(page.getByRole('heading', { name: /machine learning/i })).toBeVisible();
  });

  test('should show update status', async ({ page }) => {
    await page.goto('/');

    // Status component should be visible
    await expect(page.getByText(/last updated|next update/i)).toBeVisible();
  });
});
```

**File:** `tests/e2e/flows/paper-detail.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Paper Detail Page', () => {
  test('should display paper details', async ({ page }) => {
    // Navigate to a known paper
    await page.goto('/papers/[test-paper-id]');

    // Check title displayed
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Check tabs are present
    await expect(page.getByRole('tab', { name: 'Summary' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Abstract' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'ELI5' })).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/papers/[test-paper-id]');

    // Click Abstract tab
    await page.getByRole('tab', { name: 'Abstract' }).click();

    // Abstract content should be visible
    await expect(page.getByRole('tabpanel')).toContainText(/abstract|introduction/i);
  });

  test('should link to PDF and arXiv', async ({ page }) => {
    await page.goto('/papers/[test-paper-id]');

    // Check external links
    const pdfLink = page.getByRole('link', { name: 'PDF' });
    await expect(pdfLink).toHaveAttribute('href', /arxiv\.org\/pdf/);

    const arxivLink = page.getByRole('link', { name: 'arXiv' });
    await expect(arxivLink).toHaveAttribute('href', /arxiv\.org\/abs/);
  });
});
```

**File:** `tests/e2e/flows/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login button when not authenticated', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should redirect to login page', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/login');
  });

  test('should show user menu when authenticated', async ({ page }) => {
    // This requires auth state setup
    // Use Playwright's storageState for authenticated tests
  });

  test('should protect /saved route', async ({ page }) => {
    await page.goto('/saved');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});
```

**File:** `tests/e2e/flows/save-paper.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Save Paper Flow', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('should save a paper', async ({ page }) => {
    await page.goto('/');

    // Click save button on first paper
    const saveButton = page.locator('.paper-card').first().getByRole('button', { name: /save/i });
    await saveButton.click();

    // Button should update to show saved state
    await expect(saveButton).toHaveText(/saved/i);
  });

  test('should unsave a paper', async ({ page }) => {
    await page.goto('/saved');

    // Click remove on first saved paper
    const removeButton = page.locator('.paper-card').first().getByRole('button', { name: /remove|unsave/i });
    await removeButton.click();

    // Paper should be removed from list
  });
});
```

**File:** `tests/e2e/flows/settings.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Settings', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('should update preferences', async ({ page }) => {
    await page.goto('/settings');

    // Change category preferences
    await page.getByLabel('Machine Learning').check();

    // Submit form
    await page.getByRole('button', { name: /save/i }).click();

    // Should show success message
    await expect(page.getByText(/preferences saved/i)).toBeVisible();
  });
});
```

### 6.3 Admin Flow Tests

**File:** `tests/e2e/flows/admin.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Pages', () => {
  test('should block unauthorized access to test pages', async ({ page }) => {
    await page.goto('/test/model-comparison');

    // Should show unauthorized or redirect
    // Note: This test documents current behavior - test pages should be protected
  });
});
```

---

## 7. Load/Performance Tests

### 7.1 k6 Test Scripts

**File:** `tests/load/scripts/papers-api.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up
    { duration: '1m', target: 50 },   // Sustained load
    { duration: '30s', target: 100 }, // Peak
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  const categories = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'];
  const category = categories[Math.floor(Math.random() * categories.length)];

  const res = http.get(`${__ENV.BASE_URL}/api/papers?category=${category}&limit=20`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has papers array': (r) => JSON.parse(r.body).papers !== undefined,
  });

  errorRate.add(res.status !== 200);
  latency.add(res.timings.duration);

  sleep(Math.random() * 2); // Random 0-2s think time
}
```

**File:** `tests/load/scripts/paper-detail.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  // Pre-fetch list to get paper IDs
  const listRes = http.get(`${__ENV.BASE_URL}/api/papers?limit=50`);
  const papers = JSON.parse(listRes.body).papers;

  if (papers.length > 0) {
    const paperId = papers[Math.floor(Math.random() * papers.length)].id;

    const detailRes = http.get(`${__ENV.BASE_URL}/api/papers/${paperId}`);
    check(detailRes, {
      'status is 200': (r) => r.status === 200,
    });

    // Also test analysis endpoint
    const analysisRes = http.get(`${__ENV.BASE_URL}/api/papers/${paperId}/analysis`);
    check(analysisRes, {
      'analysis status is 200 or 404': (r) => [200, 404].includes(r.status),
    });
  }

  sleep(1);
}
```

### 7.2 Performance Targets

| Endpoint | p50 | p95 | p99 | Max RPS |
|----------|-----|-----|-----|---------|
| GET /api/papers | <100ms | <300ms | <500ms | 100 |
| GET /api/papers/[id] | <50ms | <150ms | <300ms | 200 |
| GET /api/papers/[id]/analysis | <50ms | <150ms | <300ms | 200 |
| GET /api/papers/[id]/mentions | <50ms | <150ms | <300ms | 200 |
| POST /api/user/saved | <100ms | <300ms | <500ms | 50 |
| Homepage (SSR) | <500ms | <1000ms | <2000ms | 50 |

### 7.3 Load Test Commands

```bash
# Run papers API load test
k6 run -e BASE_URL=http://localhost:3000 tests/load/scripts/papers-api.js

# Run with cloud reporting
k6 cloud run tests/load/scripts/papers-api.js

# Run with HTML report
k6 run --out json=results.json tests/load/scripts/papers-api.js
```

---

## 8. Security Tests

### 8.1 Authentication Bypass Tests

**File:** `tests/security/auth-bypass.test.ts`

| Test Case | Description |
|-----------|-------------|
| Admin route without auth | All admin routes return 401 |
| Admin route with wrong secret | Returns 401, not 403 |
| User routes without session | Returns 401 |
| Timing attack resistance | constantTimeCompare used |
| Secret in URL query | No longer accepted (fixed) |

### 8.2 Input Validation Tests

**File:** `tests/security/input-validation.test.ts`

| Test Case | Description |
|-----------|-------------|
| SQL injection in search | Search param sanitized |
| XSS in paper content | Content properly escaped |
| Path traversal in paper ID | Invalid UUIDs rejected |
| Oversized request body | Body size limits enforced |
| Invalid JSON body | Returns 400, not 500 |

### 8.3 Rate Limiting Tests

**File:** `tests/security/rate-limiting.test.ts`

| Test Case | Description |
|-----------|-------------|
| Public API rate limit | Enforced after threshold |
| Auth route rate limit | Prevents brute force |
| Admin API no abuse | Limited by auth, but consider rate limit |

### 8.4 Secret Exposure Tests

**File:** `tests/security/secrets.test.ts`

| Test Case | Description |
|-----------|-------------|
| Error responses | Don't leak env vars |
| API responses | Don't include secrets |
| Logs | Secrets redacted |
| Git history | No committed secrets |

### 8.5 OWASP ZAP Scan Configuration

```yaml
# zap-baseline.yaml
env:
  contexts:
    - name: "Research Aggregator"
      urls:
        - "http://localhost:3000"
      includePaths:
        - "http://localhost:3000/api/.*"
      excludePaths:
        - "http://localhost:3000/api/admin/.*"
  parameters:
    failOnError: true
    failOnWarning: false
    progressToStdout: true
```

---

## 9. Priority Matrix

### P0 - Critical (Week 1)

| Category | Tests | Effort |
|----------|-------|--------|
| Security | Admin auth bypass tests | 1 day |
| Security | Input validation | 1 day |
| Unit | AI config helper | 0.5 day |
| Unit | Admin auth helper | 0.5 day |
| Integration | API auth scenarios | 1 day |
| **Total** | | **4 days** |

### P1 - High (Week 2-3)

| Category | Tests | Effort |
|----------|-------|--------|
| Unit | ArxivService | 2 days |
| Unit | OpenRouterService | 1.5 days |
| Unit | PaperAnalysisService | 2 days |
| Integration | GET /api/papers | 1 day |
| Integration | User saved papers API | 1 day |
| Worker | ArxivWorker | 1.5 days |
| Worker | SummaryWorker | 1 day |
| E2E | Homepage flow | 1 day |
| **Total** | | **11 days** |

### P2 - Medium (Week 4-5)

| Category | Tests | Effort |
|----------|-------|--------|
| Unit | SerperService | 1 day |
| Unit | SocialAggregatorService | 1 day |
| Unit | React components | 2 days |
| Integration | Admin APIs | 1 day |
| Worker | AnalysisWorker | 1.5 days |
| Worker | Social/News workers | 1 day |
| E2E | Auth flows | 1 day |
| E2E | Paper detail | 1 day |
| Database | Race condition tests | 1 day |
| **Total** | | **10.5 days** |

### P3 - Low (Week 6+)

| Category | Tests | Effort |
|----------|-------|--------|
| Integration | Full DB schema tests | 2 days |
| Worker | BackfillWorker | 1 day |
| E2E | Save paper flow | 0.5 day |
| E2E | Settings flow | 0.5 day |
| Load | k6 scripts | 1 day |
| Load | Performance baseline | 1 day |
| Security | OWASP ZAP scan | 0.5 day |
| **Total** | | **6.5 days** |

### Total Estimated Effort: ~32 days (6-7 weeks)

---

## 10. CI/CD Pipeline Configuration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  DATABASE_URL: postgresql://test:test@localhost:5432/test_db
  REDIS_URL: redis://localhost:6379
  ADMIN_SECRET: test_admin_secret
  AI_ENABLED: false
  NEXTAUTH_SECRET: test_secret_32_characters_long!!
  NEXTAUTH_URL: http://localhost:3000

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          flags: unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run db:push
      - run: npm run test:integration
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          flags: integration

  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run db:push
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.11.0
        with:
          target: 'http://localhost:3000'
          cmd_options: '-I'

  load-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/load/scripts/papers-api.js
          flags: --vus 10 --duration 30s
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage tests/unit",
    "test:integration": "vitest run --coverage tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:load": "k6 run tests/load/scripts/papers-api.js",
    "test:security": "zap-baseline.py -t http://localhost:3000",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

---

## Appendix: Test Data Factories

### Paper Factory

```typescript
// tests/fixtures/papers.ts
import { faker } from '@faker-js/faker';

export function createPaperFixture(overrides = {}) {
  return {
    externalId: `${faker.date.recent().getFullYear()}.${faker.string.numeric(5)}`,
    title: faker.lorem.sentence(),
    abstract: faker.lorem.paragraphs(2),
    categories: ['cs.AI', 'cs.LG'],
    primaryCategory: 'cs.AI',
    publishedAt: faker.date.recent(),
    pdfUrl: `https://arxiv.org/pdf/${faker.string.numeric(10)}.pdf`,
    summaryBullets: [
      faker.lorem.sentence(),
      faker.lorem.sentence(),
      faker.lorem.sentence(),
    ],
    summaryEli5: faker.lorem.paragraph(),
    ...overrides,
  };
}

export function createPapersFixture(count: number, overrides = {}) {
  return Array.from({ length: count }, () => createPaperFixture(overrides));
}
```

### Analysis Factory

```typescript
// tests/fixtures/analyses.ts
import { faker } from '@faker-js/faker';

export function createAnalysisFixture(paperId: string, overrides = {}) {
  return {
    paperId,
    analysisVersion: 'dtlp_v1',
    role: faker.helpers.arrayElement(['Primitive', 'Platform', 'Proof', 'Provocation']),
    roleConfidence: faker.number.float({ min: 0.5, max: 1, precision: 0.01 }),
    timeToValue: faker.helpers.arrayElement(['Now', 'Soon', 'Later', 'Unknown']),
    timeToValueConfidence: faker.number.float({ min: 0.5, max: 1, precision: 0.01 }),
    interestingness: {
      total_score: faker.number.int({ min: 0, max: 12 }),
      tier: faker.helpers.arrayElement(['low', 'moderate', 'high', 'very_high']),
      checks: [],
    },
    businessPrimitives: {
      selected: ['cost', 'speed'],
      justification: faker.lorem.sentence(),
      evidence_pointers: [],
    },
    keyNumbers: [],
    constraints: [],
    failureModes: [],
    whatIsMissing: [faker.lorem.sentence()],
    readinessLevel: faker.helpers.arrayElement(['research_only', 'prototype_candidate', 'deployable_with_work']),
    readinessJustification: faker.lorem.sentence(),
    readinessEvidencePointers: [],
    publicViews: {
      hook_sentence: faker.lorem.sentence(),
      '30s_summary': [faker.lorem.sentence()],
      '3m_summary': faker.lorem.paragraph(),
    },
    ...overrides,
  };
}
```

### User Factory

```typescript
// tests/fixtures/users.ts
import { faker } from '@faker-js/faker';

export function createUserFixture(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    image: faker.image.avatar(),
    ...overrides,
  };
}
```

### ArXiv API Response Mock

```typescript
// tests/mocks/arxiv.ts
export const mockArxivResponse = {
  singlePaper: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <opensearch:totalResults>1</opensearch:totalResults>
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <title>Attention Is All You Need: A Transformer Architecture</title>
    <summary>We propose a new architecture based entirely on attention mechanisms.</summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <category term="cs.AI"/>
    <category term="cs.LG"/>
    <arxiv:primary_category term="cs.AI"/>
    <published>2024-01-15T00:00:00Z</published>
    <updated>2024-01-16T00:00:00Z</updated>
    <link href="http://arxiv.org/pdf/2401.12345v1" type="application/pdf"/>
  </entry>
</feed>`,

  multiplePapers: (count: number) => {
    const entries = Array.from({ length: count }, (_, i) => `
      <entry>
        <id>http://arxiv.org/abs/2401.${10000 + i}v1</id>
        <title>Test Paper ${i + 1}</title>
        <summary>Abstract for paper ${i + 1}</summary>
        <author><name>Author ${i + 1}</name></author>
        <category term="cs.AI"/>
        <arxiv:primary_category term="cs.AI"/>
        <published>2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z</published>
        <updated>2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z</updated>
      </entry>
    `).join('');

    return `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <opensearch:totalResults>${count}</opensearch:totalResults>
  ${entries}
</feed>`;
  },

  emptyFeed: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <opensearch:totalResults>0</opensearch:totalResults>
</feed>`,

  rateLimited: 'Rate exceeded. Please retry after 30 seconds.',
};
```

---

## Conclusion

This test suite plan provides a comprehensive roadmap for achieving high test coverage across all layers of the Research Aggregator application. By following the priority matrix, the team can focus on critical security and reliability tests first, then expand coverage to integration and E2E tests.

Key success metrics:
- **Unit/Integration coverage**: 80% lines, 70% branches
- **Worker critical paths**: 70% lines minimum
- **E2E flows**: 100% of critical paths covered
- **Security**: Zero P0 vulnerabilities
- **Performance**: All endpoints meet latency targets

Review this document quarterly and update as the application evolves.
