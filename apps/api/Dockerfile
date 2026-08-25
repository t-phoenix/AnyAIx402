# syntax=docker/dockerfile:1

FROM oven/bun:1.4.0-slim AS deps
WORKDIR /app

# Manifests only, so a source-only change reuses the cached install layer.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/sdk/package.json packages/sdk/
COPY packages/config/package.json packages/config/

RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.0-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

RUN groupadd --system --gid 1001 anyx \
    && useradd --system --uid 1001 --gid anyx anyx

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY apps/api ./apps/api
COPY packages/core ./packages/core
COPY packages/db ./packages/db
COPY packages/config ./packages/config

USER anyx

EXPOSE 3000

# The API serves in a degraded mode without a database, so a healthy check here
# means the process is up, not that every capability is enabled. GET /health
# reports which are.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://localhost:'+(process.env.PORT??3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/api/src/index.ts"]
