# Paper Ingestion Fix: Complete arXiv Coverage

## Problem Statement

The Research Aggregator is **missing papers** from arXiv. Analysis of the last 10 days shows:

| Fetch Date | Papers Ingested |
|------------|-----------------|
| 2026-02-04 | 589 |
| 2026-02-03 | 918 |
| 2026-02-02 | 521 |
| 2026-01-30 | 612 |
| 2026-01-29 | 352 |
| 2026-01-28 | 376 |
| 2026-01-27 | 640 |
| 2026-01-26 | 243 |

**Key observations:**
- **Missing days**: No ingestion on January 31 or February 1
- **Variable capture**: Daily counts range from 243 to 918 (inconsistent)
- **Publish date mismatch**: We have papers published on Jan 31 (134) but no fetch that day

---

## Goals

1. **Zero missed papers**: Capture 100% of new arXiv AI papers daily
2. **Historical backfill**: Fetch all papers from January 1, 2026 to present
3. **Self-healing**: Automatically detect and fill gaps from missed fetch days
4. **Monitoring**: Track daily ingestion counts with alerting

---

## Root Cause Analysis

### Issue 1: No Date Filtering

**Current behavior** (`src/lib/queue/workers/arxiv-worker.ts:80-119`):
```typescript
// Fetches N most recent papers, sorted by submittedDate descending
await arxivService.fetchPapersPaginated(category, page, perPage);
```

The worker fetches the **N most recent papers** without any date constraint. This causes:
- If arXiv publishes 400 papers and we fetch 300, the oldest 100 are permanently missed
- No way to know if we got "all" papers or just "some"

### Issue 2: Pagination Limits

**Current configuration** (`src/workers/index.ts:44-55`):
```typescript
await arxivFetchQueue.add("fetch-all-ai", {
  useAllAICategories: true,
  maxResults: 200,  // This is actually ignored
}, {
  repeat: { pattern: "0 22 * * *" }
});
```

Default limits in `arxiv-worker.ts`:
- `maxPagesPerCategory = 3` (line 128)
- `perPage = 100` (line 83)
- **Result**: Max 300 papers per category × 6 categories = 1800 total (before deduplication)

While 1800 seems sufficient, the problem is we fetch the **most recent** papers, not papers from a **specific date range**.

### Issue 3: No Gap Recovery

**Current behavior** (`src/workers/index.ts:59-71`):
```typescript
// On startup, just fetches recent papers - no gap detection
await arxivFetchQueue.add("fetch-all-ai-startup", {
  useAllAICategories: true,
  maxResults: 200,
});
```

If the worker is down for a day (Jan 31), when it restarts (Feb 1), it just fetches the most recent papers. Papers from Jan 31 that are no longer in the "most recent" window are lost forever.

### Issue 4: Unused Date Range API

**The solution already exists!** (`src/lib/services/arxiv.ts:358-415`):
```typescript
async fetchByDateRange(
  startDate: Date,
  endDate: Date,
  category: string = "cs.AI",
  options: { maxResults?: number; start?: number } = {}
): Promise<{ papers: ArxivPaper[]; total: number }>
```

This method supports date-based fetching with the arXiv API's `submittedDate` filter, but **it's never called** by the scheduler.

---

## Proposed Solution

### Phase 1: Date-Based Daily Fetching

**Change**: Instead of fetching "most recent N papers", fetch "all papers from yesterday".

**Implementation**:

1. **New worker job type**: `arxiv-fetch-date`
   ```typescript
   interface ArxivFetchByDateJob {
     date: string;           // ISO date string "2026-02-04"
     categories: string[];   // AI_CATEGORIES
   }
   ```

2. **New fetch logic**:
   ```typescript
   async function fetchAllPapersForDate(date: Date, category: string) {
     const papers: ArxivPaper[] = [];
     let start = 0;
     const perPage = 100;

     while (true) {
       const result = await arxivService.fetchByDateRange(
         date, date, category, { maxResults: perPage, start }
       );
       papers.push(...result.papers);

       // Stop when we've fetched all papers
       if (papers.length >= result.total || result.papers.length < perPage) {
         break;
       }
       start += perPage;
     }

     return papers;
   }
   ```

3. **Updated schedule**:
   ```typescript
   // Daily at 22:00 UTC - fetch yesterday's papers
   await arxivFetchQueue.add("fetch-by-date", {
     date: getYesterdayISO(),  // "2026-02-04"
     categories: AI_CATEGORIES,
   }, {
     repeat: { pattern: "0 22 * * *" }
   });
   ```

**Benefits**:
- Guarantees 100% capture for each date
- Pagination continues until `total` is reached
- Clear success criteria: fetched papers === total papers

### Phase 2: Automatic Gap Detection & Backfill

**Change**: On worker startup, detect missing days and backfill them.

**Implementation**:

1. **Gap detection query**:
   ```sql
   -- Find dates with no papers in the last N days
   WITH date_series AS (
     SELECT generate_series(
       CURRENT_DATE - INTERVAL '30 days',
       CURRENT_DATE - INTERVAL '1 day',
       INTERVAL '1 day'
     )::date AS date
   )
   SELECT ds.date
   FROM date_series ds
   LEFT JOIN (
     SELECT DATE(created_at) as date, COUNT(*) as count
     FROM papers
     GROUP BY DATE(created_at)
   ) p ON ds.date = p.date
   WHERE p.count IS NULL OR p.count < 50  -- Suspiciously low
   ORDER BY ds.date;
   ```

2. **Startup backfill**:
   ```typescript
   async function backfillMissingDates() {
     const missingDates = await detectGaps(30); // Last 30 days

     for (const date of missingDates) {
       console.log(`[Backfill] Fetching papers for ${date}`);
       await arxivFetchQueue.add("fetch-by-date", {
         date: date.toISOString().split('T')[0],
         categories: AI_CATEGORIES,
       }, {
         delay: missingDates.indexOf(date) * 60000 // 1 min between dates
       });
     }
   }
   ```

**Benefits**:
- Self-healing after outages
- Catches both complete misses and partial fetches

### Phase 3: Historical Backfill (January 1, 2026 → Present)

**Change**: Add admin endpoint and job for bulk historical backfill.

**Implementation**:

1. **New endpoint**: `POST /api/admin/backfill-arxiv`
   ```typescript
   // Request body
   {
     "startDate": "2026-01-01",
     "endDate": "2026-02-04",
     "categories": ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"]
   }
   ```

2. **Backfill worker**:
   - Processes one day at a time
   - Respects rate limits (3 seconds between requests)
   - Reports progress via job status
   - Estimated time: ~35 days × 6 categories × ~5 pages × 3 sec = ~52 minutes

3. **Database tracking**:
   ```sql
   CREATE TABLE backfill_log (
     id SERIAL PRIMARY KEY,
     date DATE NOT NULL,
     category VARCHAR(20) NOT NULL,
     papers_fetched INT NOT NULL,
     total_available INT NOT NULL,
     completed_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(date, category)
   );
   ```

**Benefits**:
- One-time operation to catch up
- Auditable record of what was fetched
- Can be re-run for specific dates if needed

### Phase 4: Monitoring & Alerting

**Change**: Track daily ingestion metrics and alert on anomalies.

**Implementation**:

1. **Enhanced `/api/admin/paper-stats`**:
   ```typescript
   {
     "status": "ok",
     "totalPapers": 12500,
     "todayIngested": 423,
     "expectedRange": [300, 600],  // Based on historical average
     "health": "healthy",  // or "warning" or "critical"
     "missingDates": [],
     "byCategory": { ... }
   }
   ```

2. **Health check for Railway**:
   - If `todayIngested < 100` → warning
   - If `todayIngested < 50` → critical
   - If missing dates in last 7 days → critical

3. **Optional**: Webhook notification on anomalies

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/lib/queue/workers/arxiv-worker.ts` | Add `processArxivFetchByDate()` function |
| `src/workers/index.ts` | Update scheduler to use date-based fetching, add gap detection |
| `src/lib/services/arxiv.ts` | Add `fetchAllPapersForDate()` wrapper with full pagination |
| `src/app/api/admin/backfill-arxiv/route.ts` | NEW: Admin endpoint for historical backfill |
| `src/app/api/admin/paper-stats/route.ts` | Enhance with health checks and gap detection |
| `src/lib/db/schema.ts` | Optional: Add `backfill_log` table |

---

## Execution Plan

### Step 1: Implement Date-Based Fetching (Priority: HIGH)
- Modify `arxiv-worker.ts` to use `fetchByDateRange`
- Update scheduler to pass date instead of maxResults
- Deploy and verify daily capture improves

### Step 2: Add Gap Detection (Priority: HIGH)
- Add gap detection on worker startup
- Auto-queue backfill jobs for missing dates
- Monitor for 1 week to ensure reliability

### Step 3: Historical Backfill (Priority: MEDIUM)
- Create admin endpoint
- Run backfill from 2026-01-01 to present
- Verify paper counts match expected arXiv totals

### Step 4: Monitoring (Priority: LOW)
- Enhance stats endpoint
- Add health checks
- Optional: Set up alerting

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| arXiv rate limiting | Enforce 3-second delay, exponential backoff on 429 |
| Large backfill overwhelms DB | Process one day at a time, batch inserts |
| Duplicate papers during backfill | Existing deduplication by arxiv ID handles this |
| Date range API returns incomplete | Check `total` field, paginate until complete |

---

## Success Metrics

After implementation:
- [ ] Zero missing dates in the last 30 days
- [ ] Daily paper counts consistently 300-600 (matching arXiv AI volume)
- [ ] Historical data complete from January 1, 2026
- [ ] Health endpoint reports "healthy" status
- [ ] Total papers increases by ~15,000-20,000 (backfill estimate)

---

## Appendix: arXiv API Reference

**Date range query format**:
```
search_query=cat:cs.AI AND submittedDate:[202601010000 TO 202601012359]
```

**Response includes**:
```xml
<opensearch:totalResults>427</opensearch:totalResults>
<opensearch:startIndex>0</opensearch:startIndex>
<opensearch:itemsPerPage>100</opensearch:itemsPerPage>
```

Use `totalResults` to know when pagination is complete.

---

# Compatibility Addendum (Non-Conflicting with Claude’s Implementation)

Claude is currently implementing the **original plan in this document**. The changes below are **additive only** and are designed to **layer on top** of that work without renaming endpoints, job names, or behavior already defined.

**Principles for compatibility**
- Do **not** rename or remove anything Claude is adding (job names, endpoints, worker entry points).
- Only add new tables, optional fields, guardrails, or extra scheduled jobs.
- If a change touches the same function, keep the same inputs/outputs and only add logic.

## Plan v1.1 (Additive, Safe To Apply After Claude’s Changes)

### Phase A — Ingestion Ledger (Audit + Resume)
**Why:** You need a persistent record of what was expected vs. fetched per date/category to detect partial fetches and resume reliably.

**Add:** `ingestion_runs` table (new, independent)
- `date` (UTC date)
- `category`
- `expected_total`
- `fetched_total`
- `status` (`started`, `completed`, `partial`, `failed`)
- `last_start_index`
- `started_at`, `completed_at`
- `error_message`
- Unique index on `(date, category)`

**Files:**
- `src/lib/db/schema.ts` (add table)
- migrations (new)

**Integration (additive):**
- In Claude’s new `fetch-by-date` job handler, write/update a row in `ingestion_runs`.
- If the table doesn’t exist (older migration), skip gracefully.

**Behavior:**
- On start: `status = started`, `expected_total` from `opensearch:totalResults`.
- Each page: update `fetched_total` and `last_start_index`.
- On complete: `status = completed`.
- On failure: `status = partial` or `failed`.

---

### Phase B — Overlap Window (Late Arrivals)
**Why:** arXiv sometimes adds/updates papers late; a strict “yesterday only” fetch can miss them.

**Additive scheduler change:**
- Keep Claude’s daily fetch for **yesterday**.
- Add a **second job** for **day-before-yesterday**.
- Use deterministic job IDs to prevent duplicates.

**Example job IDs:**
- `arxiv-fetch-date:2026-02-04:cs.AI`

**Files:**
- `src/workers/index.ts` (scheduling only)

---

### Phase C — Gap Detection Uses `publishedAt` (Not `createdAt`)
**Why:** Backfilled data will have `createdAt = today`, which makes `createdAt`-based gap detection inaccurate.

**Update query only (same endpoint/function):**
- Use `publishedAt` (or `submittedDate`) for date aggregation.
- This is a **bug fix** and is safe even if Claude already implemented gap detection.

**Files:**
- Where Claude implements `detectGaps()` or the stats endpoint query.

---

### Phase D — Reconciliation Job (Weekly Integrity Check)
**Why:** Prevent silent partial failures.

**Add:** A weekly job that re-fetches the last 7 days using date-based fetch and compares `expected_total` vs `fetched_total`.

**Files:**
- `src/workers/index.ts` (new repeatable job)
- Reuse Claude’s `fetch-by-date` worker

---

### Phase E — Multi-Replica Safety (Global Rate Limit)
**Why:** `arxivService` rate limit is in-process and not safe for multiple worker replicas.

**Additive guard:**
- Before running a date-based fetch, acquire a Redis lock (e.g., `arxiv:fetch-lock`).
- If lock not acquired, skip.

**Files:**
- `src/lib/queue/workers/arxiv-worker.ts`
- `src/lib/redis/index.ts` (helper)

---

### Phase F — Idempotent Job IDs
**Why:** Prevent duplicates from retries and overlap window.

**Additive change:**
- Use deterministic `jobId` for each (date, category).
- If job already exists, BullMQ will dedupe.

**Files:**
- `src/workers/index.ts` (schedule)
- `src/app/api/admin/backfill-arxiv/route.ts` (when Claude adds it)

---

### Phase G — Monitoring Built on Ledger
**Why:** A ledger gives accurate expected vs. fetched counts.

**Additive change:**
- Enhance the stats endpoint to expose:
  - `expected_total` vs `fetched_total` per date/category
  - `status` per date
  - `missingDates` from ledger

**Files:**
- `src/app/api/admin/paper-stats/route.ts`

---

# Compatibility Notes

- **Do not rename** Claude’s `fetch-by-date` job type or endpoint. Only extend its behavior.
- **Do not replace** Claude’s scheduler, only add overlap jobs and reconciliation jobs.
- **Do not change** the admin endpoint inputs, only add validation and optional flags.

---

# Suggested Implementation Order (Additive Only)

1. Add `ingestion_runs` table + migration.
2. Write ledger updates inside `fetch-by-date` handler.
3. Add overlap scheduling (day -1 and day -2).
4. Fix gap detection query to use `publishedAt`.
5. Add weekly reconciliation job.
6. Add Redis lock around arXiv fetch.
7. Add deterministic `jobId` values in schedulers and backfill.

---

# Success Metrics (Additive)
- 0 dates marked `partial` or `failed` in the last 30 days.
- For each date+category: `fetched_total == expected_total`.
- Reconciliation job reports no mismatches.
- No duplicate jobs for the same (date, category).

