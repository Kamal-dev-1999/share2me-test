# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
# Uses a separate stage to cache the node_modules layer.
# If only src/ changes, this layer is reused — making rebuilds very fast.
FROM node:20-alpine AS deps

WORKDIR /app

# Copy lockfiles first — Docker layer cache means this only re-runs
# when package.json or package-lock.json changes, not on every code change.
COPY package.json package-lock.json ./

RUN npm ci --omit=dev


# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy deps from the previous stage (cached if no package changes)
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source code
COPY . .

# Build-time env vars — these are baked into the Next.js static bundle.
# They are NOT secrets; the signaling URL is public-facing.
ARG NEXT_PUBLIC_SIGNAL_URL
ENV NEXT_PUBLIC_SIGNAL_URL=${NEXT_PUBLIC_SIGNAL_URL}
ENV NEXT_TELEMETRY_DISABLED=1
# Activate Next.js standalone output mode for minimal production image
ENV DOCKER_BUILD=1

RUN npm run build


# ─── Stage 3: Production Runner ───────────────────────────────────────────────
# Use the minimal Next.js standalone output — dramatically smaller image.
# This requires `output: 'standalone'` in next.config.js (see note below).
FROM node:20-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy the standalone output from the builder stage.
# The standalone build includes only the files needed to run the app,
# stripping out all dev dependencies and build artifacts.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
