# Research Aggregator - Project Status

## Project Vision
A public website that aggregates AI research papers (inspired by [whathappened.tech](https://www.whathappened.tech/)) with:
- Papers from arXiv (extensible to other sources)
- AI-generated summaries (3 bullet points + ELI5)
- Social media mentions (Bluesky, Reddit, Twitter)
- News coverage tracking
- Author profiles with social discovery
- User features (save papers, follow authors)

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Styling | TailwindCSS + shadcn/ui |
| Database | PostgreSQL (via Railway) |
| ORM | Drizzle ORM |
| Job Queue | Redis + BullMQ |
| Auth | Auth.js v5 (NextAuth) |
| Deployment | Railway |
| AI | OpenRouter (GPT-5.1) |
| Theme | next-themes |

---

## What Has Been Built (Phases 1-7 Complete)

### Phase 1: Foundation ✅
- Next.js app with App Router
- PostgreSQL database with Drizzle ORM
- Full database schema (papers, authors, mentions, users, etc.)
- ArxivService for fetching papers
- Paper list and detail pages
- Responsive layout with header/navigation

### Phase 2: AI Summaries ✅
- OpenRouterService for AI summaries
- Redis + BullMQ job queue setup
- Summary worker (3 bullets + ELI5)
- Summary display on paper detail page

### Phase 3: Social Monitoring ✅
- BlueskyService (free public API)
- RedditService (free JSON API)
- Content deduplication with hashing
- Social mentions UI with platform tabs

### Phase 4: Author Discovery ✅
- ORCID lookup service
- OpenAlex API integration
- Author profile pages
- Social links display

### Phase 5: Authentication ✅
- Auth.js v5 with Drizzle adapter
- GitHub OAuth (Google removed)
- Protected routes middleware
- Save papers functionality
- Follow authors functionality
- User settings page

### Phase 6: News & Production ✅
- SerperService for news search
- News UI components
- Background job workers:
  - `arxiv-worker` - fetches papers every 6 hours
  - `summary-worker` - generates AI summaries with GPT-5.1
  - `social-monitor-worker` - monitors Bluesky/Reddit
  - `news-worker` - fetches news articles
- Daily refresh job for recent papers (social + news)
- Railway deployment config
- Health check endpoints

### Phase 7: UI/Design Overhaul ✅ (January 13, 2026)
- **Theme System**: Dark/light mode toggle with next-themes
- **Typography**: Instrument Serif (headings) + DM Sans (body) + DM Mono (code)
- **Color Scheme**:
  - Dark mode: Deep midnight slate (#0c0f14) with warm amber (#f59e0b) accents
  - Light mode: Warm paper whites (#fafaf9) with rich slate primary
- **Header Redesign**: Pill-style navigation with active state indicators
- **Paper Card Redesign**:
  - Better visual hierarchy with serif titles
  - Improved tab styling with icons
  - Subtle amber gradient hover effects
  - Category badges with monospace font
- **Update Transparency**:
  - `/api/status` endpoint showing last/next fetch times
  - UpdateStatus component on home and trending pages
- **Polish**: Custom scrollbars, subtle grain texture, stagger animations

---

## Current Deployment Status

### Railway Services
- **Web App**: Deployed at `research.dimitrov.im` (custom domain)
- **PostgreSQL**: ✅ Provisioned
- **Redis**: ✅ Provisioned
- **Worker Service**: ✅ Deployed and running

### Recent Deployment Issue (Jan 13, 2026)
- Added `next-themes` to package.json but package-lock.json was out of sync
- Railway uses `npm ci` which requires lock file sync
- **Fix Applied**: Added `nixpacks.toml` to override install command to `npm install`
- **Status**: Awaiting rebuild - check Railway dashboard

### Environment Variables Set
- [x] DATABASE_URL
- [x] REDIS_URL
- [x] AUTH_SECRET
- [x] AUTH_URL
- [x] AUTH_GITHUB_ID
- [x] AUTH_GITHUB_SECRET
- [x] OPENROUTER_API_KEY
- [x] SERPER_API_KEY
- [x] ADMIN_SECRET

---

## Features Working

- [x] Homepage loads with papers from database
- [x] Paper cards with 5 tabs: Summary, Abstract, ELI5, Social, News
- [x] Category filter (AI, ML, NLP, Vision, Stats ML)
- [x] Trending page (papers ranked by social engagement)
- [x] Paper detail page
- [x] Login with GitHub
- [x] Save paper functionality
- [x] Social mentions (Bluesky + Reddit)
- [x] News tab
- [x] Dark/light theme toggle (header)
- [x] Update status display ("Updated Xh ago", "Next in Yh")
- [x] Mobile responsive design
- [x] Admin endpoint to regenerate summaries (`/api/admin/regenerate-summaries`)

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Database schema | `src/lib/db/schema.ts` |
| Auth config | `src/auth.ts` |
| ArXiv service | `src/lib/services/arxiv.ts` |
| OpenRouter service | `src/lib/services/openrouter.ts` |
| Bluesky service | `src/lib/services/bluesky.ts` |
| Reddit service | `src/lib/services/reddit.ts` |
| Serper service | `src/lib/services/serper.ts` |
| Job queues | `src/lib/queue/queues.ts` |
| Workers entry | `src/workers/index.ts` |
| Health check | `src/app/api/health/route.ts` |
| Status API | `src/app/api/status/route.ts` |
| Theme toggle | `src/components/theme-toggle.tsx` |
| Theme provider | `src/components/theme-provider.tsx` |
| Update status | `src/components/update-status.tsx` |
| Global styles | `src/app/globals.css` |
| Nixpacks config | `nixpacks.toml` |

---

## Recent Commits (Jan 13, 2026)

```
ef446ab Add nixpacks.toml to override install command
d89c50c Fix Railway build: use npm install instead of npm ci
762a62c Complete UI/design overhaul with Academic Luxe aesthetic
a5ce505 Add GPT-5.1 model and summary regeneration endpoint
```

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run workers:dev      # Start workers in dev mode

# Database
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run workers          # Start workers (production)
```

---

## Next Steps / Ideas

1. **Search** - Implement paper search functionality
2. **Email Digests** - Daily/weekly email with new papers
3. **Author Pages** - Enhanced author profiles with social discovery
4. **Paper Collections** - Let users create curated collections
5. **Comments/Discussion** - Community discussion on papers

---

## Repository
GitHub: https://github.com/tseoeo/research-aggregator

---

*Last updated: January 13, 2026*
