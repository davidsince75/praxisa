# ── Stage 1: dependency install ────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN npm install -g pnpm@9 --quiet
WORKDIR /app

# Copy manifests only — maximises layer cache reuse
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/audit-sdk/package.json ./packages/audit-sdk/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/policy-engine/package.json ./packages/policy-engine/

RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/audit-sdk ./packages/audit-sdk
COPY packages/shared-types ./packages/shared-types
COPY packages/policy-engine ./packages/policy-engine

RUN pnpm --filter @praxisa/shared-types build && \
    pnpm --filter @praxisa/policy-engine build && \
    pnpm --filter @praxisa/audit-sdk build && \
    pnpm --filter @praxisa/api build

# ── Stage 3: production runtime ────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN npm install -g pnpm@9 --quiet

RUN addgroup -S praxisa && adduser -S -G praxisa praxisa
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/audit-sdk/package.json ./packages/audit-sdk/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/policy-engine/package.json ./packages/policy-engine/

RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# Compiled output
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/audit-sdk/dist ./packages/audit-sdk/dist
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/policy-engine/dist ./packages/policy-engine/dist

# Migrations live alongside migrate.js so new URL("./migrations", import.meta.url) resolves correctly
COPY --from=build /app/apps/api/src/db/migrations ./apps/api/dist/db/migrations

USER praxisa

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run migrations, then start the API
CMD ["sh", "-c", "node apps/api/dist/db/migrate.js && node apps/api/dist/index.js"]
