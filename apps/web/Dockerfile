# syntax=docker/dockerfile:1.7
# ^ needed for BuildKit cache mounts (--mount=type=cache)

# ── Stage 1: Install deps ──
FROM node:22-alpine AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# BuildKit cache mount — pnpm store persists across builds.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ── Stage 2: Build ──
FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ ./packages/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

# Next.js build cache (.next/cache) + TS incremental — both significantly
# cut build time on subsequent runs when only some files changed.
RUN --mount=type=cache,id=next-cache,target=/app/apps/web/.next/cache \
    --mount=type=cache,id=tsc-shared,target=/app/packages/shared/.tsbuildcache \
    pnpm --filter @crm/shared build && \
    pnpm --filter web build

# ── Stage 3: Production ──
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
