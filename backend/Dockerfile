# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# Skip downloading Puppeteer's Chrome since we use Alpine's chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm ci --omit=dev


# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install all necessary system dependencies:
# - qpdf: for PDF manipulation (pdf-forms, redact)
# - libreoffice: for document conversions (word-to-pdf, etc.)
# - tesseract-ocr, tesseract-ocr-data-eng: for OCR
# - chromium, nss, freetype, harfbuzz: for Puppeteer (html-to-pdf)
# - ttf-freefont, ttf-dejavu, font-noto, font-noto-cjk: for fonts and international characters
RUN apk add --no-cache \
    qpdf \
    libreoffice \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-dejavu \
    font-noto \
    font-noto-cjk && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nodeapp nodeapp

ENV NODE_ENV=production
ENV CHROME_BIN=/usr/bin/chromium-browser
# Ensure LibreOffice has a writable home directory for its user profile
ENV HOME=/home/nodeapp

COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --chown=nodeapp:nodejs server.js    ./
COPY --chown=nodeapp:nodejs package.json ./
COPY --chown=nodeapp:nodejs public/      ./public/
COPY --chown=nodeapp:nodejs lib/         ./lib/
COPY --chown=nodeapp:nodejs p2p/         ./p2p/
COPY --chown=nodeapp:nodejs g2p/         ./g2p/
COPY --chown=nodeapp:nodejs routes/      ./routes/
COPY --chown=nodeapp:nodejs ml/          ./ml/

USER nodeapp

EXPOSE 3000 8000 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/ping', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
