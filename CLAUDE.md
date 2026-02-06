# Research Aggregator

## Deployment

**Platform: Railway** (NOT Vercel)

- **Live URL**: https://research.dimitrov.im
- **GitHub**: https://github.com/tseoeo/research-aggregator.git
- **Deploy**: Push to `main` triggers Railway auto-deploy (Nixpacks builder)
- **Railway MCP** is configured — use `mcp__railway-mcp-server__*` tools for logs, variables, deployments

### Services (4)

| Service | Role | Domain |
|---------|------|--------|
| `research-aggregator` | Next.js web app | research.dimitrov.im |
| `research-aggregator-worker` | BullMQ background workers | internal only |
| `Postgres` | PostgreSQL 16 database | internal only |
| `Redis` | Redis 7 (job queues) | internal only |

### Process Commands (Procfile)
- **web**: `db:push` (Drizzle schema sync) then `npm run start`
- **worker**: `npm run workers` (tsx src/workers/index.ts)

## Tech Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Drizzle ORM + PostgreSQL, BullMQ + Redis
- AI: OpenRouter API (Kimi K2.5 model — `moonshotai/kimi-k2.5`), toggled via `AI_ENABLED` env var
- Auth: NextAuth v5 (GitHub OAuth)

## Key Architecture

- `/src/app/` — Next.js App Router pages and API routes
- `/src/components/` — React components (shadcn/ui based)
- `/src/lib/db/schema.ts` — Drizzle database schema
- `/src/lib/services/` — External service clients (arXiv, OpenRouter)
- `/src/lib/queue/` — BullMQ queue definitions and workers
- `/src/workers/index.ts` — Worker process entry point

## Gotchas

- **Paper IDs**: The `/papers/[id]` route expects an arXiv ID (e.g. `2501.12345`), NOT the database UUID. Paper cards must link using `paper.externalId`, not `paper.id`.
- **Local dev**: Run `docker-compose up -d` for Postgres + Redis, then `npm run dev` and `npm run workers:dev`.
- **DB migrations**: Use `npm run db:push` (Drizzle push) — the web service runs this automatically on deploy.
