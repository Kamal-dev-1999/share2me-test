# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# --omit=dev skips devDependencies (there are none here, but good practice)
RUN npm ci --omit=dev


# ─── Stage 2: Production Runner ───────────────────────────────────────────────
# The backend has no build step — it's plain Node.js, so we skip a build stage.
FROM node:20-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodeapp

ENV NODE_ENV=production

# Copy only production dependencies and source
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --chown=nodeapp:nodejs server.js ./
COPY --chown=nodeapp:nodejs package.json ./

# Copy static assets if any (e.g. /public for the POC page)
COPY --chown=nodeapp:nodejs public/ ./public/

USER nodeapp

EXPOSE 8000

# Healthcheck — the /health endpoint returns 200 when the server is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "server.js"]
