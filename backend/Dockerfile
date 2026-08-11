# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodeapp

ENV NODE_ENV=production

COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --chown=nodeapp:nodejs server.js    ./
COPY --chown=nodeapp:nodejs package.json ./
COPY --chown=nodeapp:nodejs public/      ./public/
COPY --chown=nodeapp:nodejs lib/         ./lib/
COPY --chown=nodeapp:nodejs p2p/         ./p2p/
COPY --chown=nodeapp:nodejs g2p/         ./g2p/

USER nodeapp

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/health || exit 1

CMD ["node", "server.js"]
