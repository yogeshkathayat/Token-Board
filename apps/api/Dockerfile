# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Native deps for argon2
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm ci --workspaces --include-workspace-root --omit=optional

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm --workspace @tokenboard/shared run build && \
    npm --workspace @tokenboard/api run build

# --- Dev target (used by docker-compose.dev.yml) ---
FROM build AS dev
WORKDIR /app
EXPOSE 3000
CMD ["npm", "--workspace", "apps/api", "run", "dev"]

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/migrations ./apps/api/migrations

USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/server.js"]
