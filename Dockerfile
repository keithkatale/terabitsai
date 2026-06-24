# Terabits AI — Next.js standalone for Google Cloud Run (PORT=8080)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV WEALTH_MONITOR_ENABLED=false

FROM base AS deps

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/chart-renderer/package.json ./apps/chart-renderer/
COPY apps/engine/package.json ./apps/engine/
COPY apps/intel-worker/package.json ./apps/intel-worker/
COPY packages/agents/package.json ./packages/agents/
COPY packages/broker/package.json ./packages/broker/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma/
COPY packages/hitl/package.json ./packages/hitl/
COPY packages/indicators/package.json ./packages/indicators/
COPY packages/market-intel/package.json ./packages/market-intel/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/memory/package.json ./packages/memory/
COPY packages/model-router/package.json ./packages/model-router/
COPY packages/rag-engine/package.json ./packages/rag-engine/
COPY packages/risk/package.json ./packages/risk/

RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-http-header-size=65536"

RUN npm run build:packages
RUN npm run build -w @terabits/web

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/knowledge-base ./knowledge-base

USER nextjs
EXPOSE 8080

CMD ["node", "apps/web/server.js"]
