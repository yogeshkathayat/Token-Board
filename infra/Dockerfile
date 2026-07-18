# Multi-stage build for @tokenboard/web Next.js app
# Build context: apps/web

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Pin pnpm: without this corepack fetches the latest (pnpm 11.x), which needs a newer
# node:sqlite builtin and crashes. 9.5.0 matches the lockfile.
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

# ---- Dependencies stage ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ---- Build stage ----
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- Runner stage ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone server + static assets. The standalone bundle already includes a pruned
# node_modules containing `pg`, which is all the plain-JS migrate script needs — so we do
# NOT copy the full builder node_modules (keeps the image slim and prod-only).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Static assets (logo, favicon, etc.) — standalone output does NOT include public/.
COPY --from=builder /app/public ./public

# Migrations + the plain-Node migrate runner (no tsx at runtime).
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /app/scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
