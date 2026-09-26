# Aegis Arena Agent Guide

## Start Here

- Read [README.md](README.md) for setup, service ports, and the canonical Docker stack.
- Read [RUNBOOK.md](RUNBOOK.md) before changing workers, payouts, backups, or production operations.
- Read [DEAME.md](DEAME.md) for the current product and architecture map.
- For Dota Game Coordinator work, read [docs/dota-gc-service.md](docs/dota-gc-service.md).

## Commands

- Release gate: `npm run check` (Prisma generate, TypeScript, and Vitest).
- Unit tests: `npm test`; browser tests: `npm run test:e2e`; lint: `npm run lint`.
- Build: `npm run build`; this also copies the desktop helper and runs Prisma generate.
- Canonical local stack: `docker compose -f docker-compose.second.yml up -d`.
- The canonical web URL is `http://localhost:3002`; the old `docker-compose.yml` uses obsolete ports.
- Run only one tournament tick worker and one realtime server. Do not run `npm run realtime` on the host while the Docker realtime service is running.
- After source edits, restart the `web2` container if the browser still shows stale compiled output.

## Application Rules

- This is a Next.js 15 App Router application with React 19, Prisma, PostgreSQL, Redis, and Tailwind.
- Dynamic route `params` are promises in Next 15; await them before reading route values.
- Pages that query Prisma at render time should export `dynamic = 'force-dynamic'`, especially when a build may not have `DATABASE_URL`.
- Use the `@/*` path alias. Preserve `skipLibCheck: true` because of the pinned NextAuth beta types.
- Keep server authority in route handlers and server modules. Do not move authorization into UI state or treat middleware as global API protection.
- Reuse the Prisma singleton and existing service/policy modules before adding new database or authorization helpers.

## Authentication And Security

- The tournament login is Steam OpenID with the `aegis_session` cookie. The NextAuth route is retired and must not be reintroduced as the tournament auth path.
- Database session tokens are SHA-256 hashes; browser cookies contain the raw token. Never put `Session.sessionToken` from the database into a browser cookie.
- Preserve origin checks, bearer-token timing-safe comparisons, idempotency keys, advisory locks, and audit logging in sensitive mutations.
- Treat financial, roster, bracket, check-in, and dispute transitions as server-authoritative state changes.
- Do not invent Dota guild data. GC ingestion remains isolated behind its authenticated service boundary.

## Implementation And Validation

- Follow nearby implementations and existing policy/service helpers before introducing abstractions.
- Add or update focused Vitest coverage for changed domain logic; run the narrow test first, then `npm run check` when the slice is stable.
- For UI changes, verify the real route in the browser at port `3002`, including authenticated state and responsive behavior. Confirm links point to the intended route rather than relying on hashes from `/` when authenticated users are redirected.
- Keep unrelated worktree changes intact and avoid broad refactors.

## Useful References

- Steam/session boundaries: `lib/steam-session.ts`, `server/auth/session.ts`, and `app/api/auth/steam/`.
- Tournament APIs and state changes: `app/api/tournaments/`, `app/api/matches/`, and `server/jobs/tournament-tick.ts`.
- Shared database client: `lib/prisma.ts` and `prisma/schema.prisma`.
- Mobile-specific auth and party behavior: [docs/mobile-auth-party-fix.md](docs/mobile-auth-party-fix.md).
- Mobile roadmap and status: [docs/mobile-roadmap.md](docs/mobile-roadmap.md).