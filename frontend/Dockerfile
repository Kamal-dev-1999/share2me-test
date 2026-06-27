# ─── Stage 1: Install ALL deps (including devDeps needed for next build) ──────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# Full install — devDependencies (TypeScript, ESLint) are required by `next build`
RUN npm ci


# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the static bundle at build time.
# Pass via --build-arg in the deploy script or docker-compose.
ARG NEXT_PUBLIC_SIGNAL_URL=https://api.share2.me
ENV NEXT_PUBLIC_SIGNAL_URL=${NEXT_PUBLIC_SIGNAL_URL}
ENV NEXT_TELEMETRY_DISABLED=1
# Activates output: 'standalone' in next.config.mjs
ENV DOCKER_BUILD=1

RUN npm run build


# ─── Stage 3: Production runner (minimal image) ───────────────────────────────
# The standalone output bundles only what's needed to run the server.
# Result: ~120MB image instead of 1GB+ with full node_modules.
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind to all interfaces so wget localhost:3000 healthchecks work inside the container
ENV HOSTNAME=0.0.0.0

# Only copy the standalone server, static assets, and public files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
