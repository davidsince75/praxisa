# ── Stage 1: dependency install ────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN npm install -g pnpm@9 --quiet
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY apps/api/package.json ./apps/api/
COPY packages/audit-sdk/package.json ./packages/audit-sdk/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/policy-engine/package.json ./packages/policy-engine/

RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY apps/workers ./apps/workers
COPY apps/api/src/db ./apps/api/src/db
COPY apps/api/tsconfig.json ./apps/api/
COPY packages/audit-sdk ./packages/audit-sdk
COPY packages/shared-types ./packages/shared-types
COPY packages/policy-engine ./packages/policy-engine

# Build in dependency order (project references handle this via tsc --build)
RUN pnpm --filter @praxisa/shared-types build && \
    pnpm --filter @praxisa/policy-engine build && \
    pnpm --filter @praxisa/audit-sdk build && \
    pnpm --filter @praxisa/api exec tsc -p tsconfig.json && \
    pnpm --filter @praxisa/workers build

# ── Stage 3: production runtime ────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN npm install -g pnpm@9 --quiet

RUN addgroup -S praxisa && adduser -S -G praxisa praxisa
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/audit-sdk/package.json ./packages/audit-sdk/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/policy-engine/package.json ./packages/policy-engine/

RUN pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=build /app/apps/workers/dist ./apps/workers/dist
COPY --from=build /app/packages/audit-sdk/dist ./packages/audit-sdk/dist
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/policy-engine/dist ./packages/policy-engine/dist

# Workers' compiled imports point to apps/api/src/db/schema/*.js
# Provide the compiled API schema JS files at that path
COPY --from=build /app/apps/api/dist/db/schema ./apps/api/src/db/schema

USER praxisa

ENV NODE_ENV=production

CMD ["node", "apps/workers/dist/index.js"]
