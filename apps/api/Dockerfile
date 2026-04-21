# syntax=docker/dockerfile:1.7
# ^ needed for BuildKit cache mounts (--mount=type=cache)

# ── Stage 1: Install deps & build ──
FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

WORKDIR /app

# Copy only manifests first so this layer is cached whenever package.json /
# pnpm-lock.yaml haven't changed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# BuildKit cache mount — pnpm's global store persists across builds,
# so when the lockfile hasn't changed install completes in seconds.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# TypeScript incremental compile cache (tsconfig must have incremental:true
# for this to take effect — it does in apps/api/tsconfig.json).
RUN --mount=type=cache,id=tsc-shared,target=/app/packages/shared/.tsbuildcache \
    --mount=type=cache,id=tsc-api,target=/app/apps/api/.tsbuildcache \
    pnpm --filter @crm/shared build && \
    pnpm --filter api prisma generate && \
    pnpm --filter api build

# Prune dev deps for smaller image — reuse the same cached store.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ── Stage 2: Production ──
FROM node:22-alpine AS runner

WORKDIR /app

# Copy everything we need from builder (with generated prisma client)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

WORKDIR /app/apps/api
EXPOSE 4000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
