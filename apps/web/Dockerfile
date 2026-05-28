# ── Stage 1: install + build ──────────────────────────────────────────────────
FROM node:20-alpine AS build
RUN npm install -g pnpm@9 --quiet
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --prod=false

COPY tsconfig.base.json ./
COPY apps/web ./apps/web

RUN pnpm --filter @praxisa/web build

# ── Stage 2: serve with nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

COPY apps/web/nginx.conf.template /etc/nginx/default.conf.template
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
