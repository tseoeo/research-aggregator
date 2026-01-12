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
| AI | OpenRouter |

---

## What Has Been Built (Phases 1-6 Complete)

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
  - `arxiv-worker` - fetches papers
  - `summary-worker` - generates AI summaries
  - `social-monitor-worker` - monitors Bluesky/Reddit
  - `news-worker` - fetches news articles
- Railway deployment config
- Health check endpoints

---

## Current Deployment Status

### Railway Services
- **Web App**: ✅ Deployed at `research.dimitrov.im` (custom domain)
- **PostgreSQL**: ✅ Provisioned
- **Redis**: ✅ Provisioned
- **Worker Service**: ✅ Deployed and running

### Environment Variables Set
- [x] DATABASE_URL
- [x] REDIS_URL
- [x] AUTH_SECRET
- [x] AUTH_URL
- [x] AUTH_GITHUB_ID
- [x] AUTH_GITHUB_SECRET
- [x] OPENROUTER_API_KEY
- [x] SERPER_API_KEY

---

## Completed Setup

- [x] GitHub OAuth configured
- [x] OpenRouter API key added
- [x] Serper API key added
- [x] Worker service deployed
- [x] Database migrations applied
- [x] Custom domain configured (research.dimitrov.im)

## Features Working

- [x] Homepage loads with papers from arXiv
- [x] Paper detail page shows summary tabs
- [x] Login with GitHub works
- [x] Save paper functionality works
- [x] Social mentions loading (Bluesky + Reddit)
- [x] News tab loads
- [x] Trending page (papers ranked by social engagement)
- [x] Dark mode (follows system preference)
- [x] Mobile responsive design
- [x] Category filter tabs (AI, ML, NLP, Vision, Stats ML)

## Next Steps

### Potential Enhancements
1. **Theme Toggle** - Add manual dark/light mode switch (currently auto)
2. **Search** - Implement paper search functionality
3. **GitHub Profile Discovery** - Auto-find GitHub profiles for authors

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

## Repository
GitHub: https://github.com/tseoeo/research-aggregator

---

*Last updated: January 2026*
