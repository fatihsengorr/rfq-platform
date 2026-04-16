# RFQ Platform — Claude Code Project Reference

## Project Overview

B2B RFQ (Request for Quote) management platform for Gorhan Ltd. Manages the full lifecycle: company/contact management, RFQ creation, pricing, quote revisions, attachments, and email notifications.

**Production:** https://rfq.gorhan.co.uk (web) / https://api.gorhan.co.uk (API)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4, Radix UI, Lucide icons |
| Backend | Fastify 5, Prisma ORM (6.19), Zod validation |
| Auth | NextAuth 4 (web), JWT (API), scrypt password hashing (node:crypto) |
| Database | PostgreSQL 16 |
| Storage | S3-compatible (MinIO local, AWS S3 prod) via @aws-sdk/client-s3 |
| Email | Nodemailer via AWS SES |
| Logging | Pino (structured JSON) |
| Deploy | Docker Compose on AWS Lightsail, Caddy reverse proxy, systemd timers |

## Monorepo Structure

```
/
├── apps/
│   ├── api/          # Fastify REST API (port 4000)
│   │   ├── src/
│   │   │   ├── main.ts           # Entry point
│   │   │   ├── server.ts         # Fastify server setup (cors, helmet, rate-limit, routes)
│   │   │   ├── config.ts         # Centralized env config — never read process.env directly
│   │   │   ├── prisma.ts         # Prisma client singleton
│   │   │   ├── logger.ts         # Pino logger singleton
│   │   │   ├── middleware.ts      # Auth middleware, JWT extraction
│   │   │   ├── errors.ts         # ApiError class
│   │   │   └── modules/
│   │   │       ├── auth/         # Login, register, forgot/reset password
│   │   │       ├── rfq/          # RFQ CRUD, comments, attachments, storage (S3)
│   │   │       ├── company/      # Company & contact management
│   │   │       ├── users/        # User CRUD, role management
│   │   │       ├── email/        # Email service + templates
│   │   │       └── cron/         # Scheduled tasks (deadline reminders)
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Database schema (single file)
│   │   └── Dockerfile
│   └── web/          # Next.js frontend (port 3000)
│       ├── app/                  # App Router pages
│       │   ├── requests/         # RFQ list & detail pages
│       │   ├── quotes/           # Quote management
│       │   ├── account/          # User profile
│       │   ├── admin/            # Admin panel (user management)
│       │   ├── login/            # Auth pages
│       │   └── components/       # Page-level components (app-shell, etc.)
│       ├── lib/                  # Utilities (auth, session, upload, formatting)
│       ├── components/ui/        # Reusable UI components (shadcn/ui style)
│       └── Dockerfile
├── packages/
│   └── shared/       # @crm/shared — shared types, constants, validators
├── deploy/
│   └── lightsail/
│       ├── Caddyfile             # Reverse proxy config
│       └── systemd/              # Timer + service for deadline reminders
├── docker-compose.yml            # Dev compose (postgres, minio, api, web)
├── docker-compose.prod.yml       # Prod compose (adds caddy, uses env_file)
├── turbo.json
└── pnpm-workspace.yaml
```

## Commands

```bash
# Development
pnpm dev                          # Start all services (turbo)
pnpm build                        # Build all packages (turbo)
pnpm lint                         # Lint all packages (turbo)
pnpm test                         # Run all tests (turbo)

# API specific
pnpm --filter api dev             # Start API in dev mode (tsx watch)
pnpm --filter api build           # Compile TypeScript
pnpm --filter api test            # Run API tests (vitest)
pnpm --filter api prisma studio   # Open Prisma Studio
pnpm --filter api prisma migrate dev --name <name>   # Create migration
pnpm --filter api prisma migrate deploy              # Apply migrations
pnpm --filter api prisma generate                    # Regenerate client

# Web specific
pnpm --filter web dev             # Start Next.js dev server
pnpm --filter web build           # Build Next.js

# Shared package
pnpm --filter @crm/shared build   # Must build before api/web

# Docker (local)
docker compose up -d              # Start local stack
docker compose down               # Stop local stack

# Docker (production) — run on Lightsail server
docker compose --env-file deploy/lightsail/.env.prod -f docker-compose.yml -f docker-compose.prod.yml build
docker compose --env-file deploy/lightsail/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Code Conventions

### API Module Pattern
Each module follows: `*.routes.ts` → `*.service.ts` (or `*.store.ts`) → Prisma
- **Routes**: Fastify route registration, Zod input validation, calls service/store
- **Service/Store**: Business logic, database queries via Prisma
- **No direct `process.env` access** — always use `config` from `config.ts`
- **No `console.log/error`** — use `logger` from `logger.ts` (pino)

### Frontend Pattern
- Next.js App Router with Server Components by default
- Server Actions for mutations (form submissions)
- `lib/auth.ts` for NextAuth session handling
- `lib/api.ts` for server-side API calls (internal http://api:4000)
- `components/ui/` for reusable primitives (shadcn/ui pattern)
- Tailwind CSS 4 for styling

### TypeScript
- ESM modules (`"type": "module"`) in api and shared
- Strict mode enabled
- `.js` extensions in import paths (API & shared)
- Zod for runtime validation at API boundaries

### Testing
- Vitest for unit tests
- `vi.mock()` for module mocking (Prisma, email service, etc.)
- Test files colocated: `*.test.ts` next to source files

### Git & CI
- Pre-commit: husky + lint-staged (auto-fix ESLint)
- CI: lint → build → test → deploy (GitHub Actions)
- Deploy: push to `main` triggers auto-deploy to Lightsail

## Architecture Notes

### Docker Compose Merging (Important!)
Production uses TWO compose files merged together:
```
docker-compose.yml (base) + docker-compose.prod.yml (overrides)
```
The base file's `api.environment` block **overrides** prod's `env_file`. Any new env var must be added to BOTH:
- `docker-compose.yml` → `api.environment` section (with `${VAR:-default}`)
- `docker-compose.prod.yml` → as needed

The `--env-file deploy/lightsail/.env.prod` flag provides values for `${VAR}` substitution at compose level.

### Auth Flow
- Web uses NextAuth (session cookies) → calls API with JWT in Authorization header
- API validates JWT via middleware → attaches `request.user` with `{ id, role }`
- Roles: `ADMIN`, `MANAGER`, `SALES_REP`, `PRICING_TEAM`

### Cron / Scheduled Tasks
- Systemd timer on host calls API via `curl http://localhost:4000/api/cron/...`
- Authenticated via `X-Cron-Secret` header (value in `.env.prod`)
- Currently: deadline reminders (daily 08:00 UTC)

### Email
- Templates in `modules/email/email.templates.ts`
- Sent via `sendNotification()` which creates a DB record + sends email
- Fire-and-forget pattern with error logging

## Database

- Schema: `apps/api/prisma/schema.prisma`
- Key models: `User`, `Company`, `Contact`, `Rfq`, `QuoteRevision`, `Attachment`, `Notification`, `Lead`
- Performance indexes on all major FK columns
- API list endpoints use pagination (`?page=1&limit=20`)

## Security

- CORS restricted to `config.webBaseUrl` only
- Rate limiting: 100 req/min global, 10 req/min on auth endpoints
- Helmet security headers enabled
- Passwords hashed with scrypt (node:crypto)
- JWT tokens for API auth, NextAuth sessions for web
