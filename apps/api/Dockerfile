# AnyX API — Bun + Hono
# Built by deploy-api.yml (Phase-later, Release/Deploy Agent). Kept here now so the image
# builds correctly once that workflow lands; not wired into ci.yml in Phase 0/1.
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY apps/api/package.json apps/api/package.json
RUN bun install --frozen-lockfile

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "apps/api/src/index.ts"]
