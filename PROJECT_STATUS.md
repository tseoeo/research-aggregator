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
- GitHub + Google OAuth configured
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
- **Web App**: ✅ Deployed at `research-aggregator-production.up.railway.app`
- **PostgreSQL**: ✅ Provisioned
- **Redis**: ✅ Provisioned
- **Worker Service**: ❌ Not yet added

### Environment Variables Set
- [x] DATABASE_URL
- [x] REDIS_URL
- [x] AUTH_SECRET
- [x] AUTH_URL

### Environment Variables Needed
- [ ] AUTH_GITHUB_ID - GitHub OAuth app ID
- [ ] AUTH_GITHUB_SECRET - GitHub OAuth app secret
- [ ] AUTH_GOOGLE_ID - Google OAuth client ID
- [ ] AUTH_GOOGLE_SECRET - Google OAuth client secret
- [ ] OPENROUTER_API_KEY - For AI summaries
- [ ] SERPER_API_KEY - For news search (optional, 2500 free/month)

---

## Next Steps

### 1. Set Up OAuth Providers
**GitHub OAuth:**
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set Homepage URL: `https://research-aggregator-production.up.railway.app`
4. Set Callback URL: `https://research-aggregator-production.up.railway.app/api/auth/callback/github`
5. Copy Client ID → `AUTH_GITHUB_ID`
6. Generate secret → `AUTH_GITHUB_SECRET`

**Google OAuth:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://research-aggregator-production.up.railway.app/api/auth/callback/google`
4. Copy Client ID → `AUTH_GOOGLE_ID`
5. Copy Client Secret → `AUTH_GOOGLE_SECRET`

### 2. Set Up OpenRouter (AI Summaries)
1. Go to https://openrouter.ai
2. Create account and get API key
3. Add to Railway: `OPENROUTER_API_KEY`

### 3. Set Up Serper (News Search - Optional)
1. Go to https://serper.dev
2. Create account (2,500 free searches/month)
3. Add to Railway: `SERPER_API_KEY`

### 4. Add Worker Service on Railway
1. In Railway, click "+ New" → "GitHub Repo"
2. Select same `research-aggregator` repo
3. Go to Settings → Change Start Command to: `npm run workers`
4. Add same environment variables as web app

### 5. Run Database Migration
In Railway shell: `npm run db:push`

### 6. Test Each Feature
- [ ] Homepage loads with papers from arXiv
- [ ] Paper detail page shows summary tabs
- [ ] Login with GitHub/Google works
- [ ] Save paper functionality works
- [ ] Social mentions load
- [ ] News tab loads (if Serper configured)

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
