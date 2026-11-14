# Share2Me — End-to-End Routing, URL Proxy & Security Fix Plan

> **Status:** Planning — VALIDATED (AI suggestions cross-checked against real files)
> **Authored:** 2026-11-14 | **Last updated:** 2026-11-14 (post AI-suggestion audit)
> **Branch:** `oracle-cloud` | **VM:** `130.210.22.28` (OCI Mumbai)
> **Rule:** No code is pushed until user explicitly confirms.

---

## Table of Contents

1. [Actual Problem Diagnosis](#1-actual-problem-diagnosis)
2. [AI Suggestion Audit Results](#2-ai-suggestion-audit-results)
3. [Final Fix List (Validated)](#3-final-fix-list-validated)
4. [Fix A — Auth Secret (Root cause of 502)](#fix-a--auth-secret-root-cause-of-502)
5. [Fix B — Caddyfile (DRY app_routes snippet)](#fix-b--caddyfile-dry-app_routes-snippet)
6. [Fix C — backend/server.js: trust proxy](#fix-c--backendserverjs-trust-proxy)
7. [Fix D — Dockerfile: BACKEND_URL as build arg](#fix-d--dockerfile-backend_url-as-build-arg)
8. [Fix E — backendUrl.ts: Same-origin for production](#fix-e--backendUrlts-same-origin-for-production)
9. [Fix F — useSocket.ts: Connect same-origin](#fix-f--usesocketts-connect-same-origin)
10. [Fix G — docker-compose.prod.yml: Relax depends_on + remove SIGNAL_URL](#fix-g--docker-composeprodYml-relax-depends_on--remove-signal_url)
11. [Fix H — layout.tsx: Comment out Monetag](#fix-h--layouttsx-comment-out-monetag)
12. [URL Hiding: How It Works End-to-End](#url-hiding-how-it-works-end-to-end)
13. [Deployment Order](#deployment-order)
14. [Verification Checklist](#verification-checklist)
15. [DNS Cutover (Final Step)](#dns-cutover-final-step)

---

## 1. Actual Problem Diagnosis

### Issue 1: HTTP 502 on `http://130.210.22.28`

**Root cause:** `AUTH_SECRET` environment variable missing at **runtime**.

Evidence from `docker logs share2me-frontend`:
```
⨯ Error: [FATAL] AUTH_SECRET environment variable is not set. Refusing to start.
```

The Dockerfile passes `AUTH_SECRET` as a **build ARG** (baked into image at build time), but the runtime stage (`runner`) does NOT have it set as `ENV`. NextAuth v5 validates it on every request to `/api/auth/*` and crashes. The container is "healthy" (healthcheck hits `/`) but any page that triggers auth — including the homepage on SSR — returns 502.

**NOT caused by:** Caddy auto_https conflict (IP requests correctly fall into `:80` block), port binding (all ports are `127.0.0.1`-only), or container crash.

### Issue 2: `/g2p/nearby` → `{"error":"Endpoint not found"}`

**Root cause:** `:80` Caddyfile block routes ALL `/g2p/*` → `backend:8000`. But `/g2p/nearby` and `/g2p/[code]` are **Next.js pages** (in `frontend/src/app/g2p/`), not Express routes.

The named-domain blocks (`share2.me`, `share2me.in`) send **everything** to `frontend:3000` (Next.js handles routing internally). So this bug only manifests on direct IP access, not on the custom domains — which is exactly what the screenshots show.

### Issue 3: Backend URL exposed in browser

`NEXT_PUBLIC_SIGNAL_URL=https://api.share2.me` is baked into the JS bundle as a build arg. `backendUrl.ts` returns it for production custom domains. Browser DevTools Network tab shows `api.share2.me` on every API and Socket.io call.

### Issue 4: Next.js rewrites self-loop

`next.config.mjs` line 159 defaults to `"http://localhost:3000"` for `backendUrl` in rewrites. This means `/api/admin/*`, `/api/tools/*`, `/api/blogs/*` are proxied back to **the frontend itself** — infinite loop / 404. `BACKEND_URL=http://backend:8000` exists in `docker-compose.prod.yml` as runtime env, but rewrites evaluate at **build time** inside the Dockerfile, where `BACKEND_URL` is not a declared `ARG`.

---

## 2. AI Suggestion Audit Results

| AI Point | Verdict | Reason |
|----------|---------|--------|
| Drop `auto_https off` | ✅ **ACCEPT** | IP requests don't match named-domain blocks; `:80` block works fine. My original Fix A was wrong. |
| 502 = frontend crash, not Caddy | ✅ **ACCEPT** | Confirmed: `AUTH_SECRET` missing at runtime → NextAuth crash |
| Use `(app_routes)` Caddy snippet | ✅ **ACCEPT** | Eliminates IP vs domain routing drift. Good pattern. |
| Don't route `/api/*` wholesale to backend | ✅ **ACCEPT** | NextAuth at `/api/auth/*` must stay on Next.js (port 3000) |
| Rewrites bake in at build time → `localhost:3000` self-loop | ✅ **ACCEPT** | Confirmed from Dockerfile — only `NEXT_PUBLIC_SIGNAL_URL` and GA ID are build args |
| Fix F snippet (add `DOCKER_BUILD=1`, `NEXT_PUBLIC_EXPRESS_URL`) | ❌ **REJECT** | `DOCKER_BUILD=1` already set via `ENV` in Dockerfile. `NEXT_PUBLIC_EXPRESS_URL` would leak into the bundle. |
| `NEXT_PUBLIC_SIGNAL_URL` is in bundle | ✅ **ACCEPT** | Confirmed: build arg in Dockerfile line 22-23, used in `backendUrl.ts` lines 36 & 58 |
| Port exposure already handled | ✅ **ACCEPT** | `127.0.0.1:8000` and `127.0.0.1:3000` confirmed in docker-compose |
| Remove `header_up X-Forwarded-For {remote_host}` | ✅ **ACCEPT** | Caddy sets it correctly by default; override breaks Cloudflare real-IP passthrough |
| Remove `preload` from HSTS | ✅ **ACCEPT** | Hard-to-undo commitment; add only after DNS fully settled |
| Relax `depends_on` to `service_started` | ✅ **ACCEPT** | Prevents site-wide outage when backend healthcheck blips during deploys |
| `trust proxy` in Express | ✅ **ACCEPT** | Confirmed: NOT set in `backend/server.js`. Without it, `req.ip` = `127.0.0.1` behind Caddy — rate limiting and IP logging are broken |
| Fix rollout order (Caddy first, then frontend) | ✅ **ACCEPT** | Lower risk than doing everything in one deploy |

---

## 3. Final Fix List (Validated)

| # | File | Change | Priority |
|---|------|--------|----------|
| **A** | `docker-compose.prod.yml` | Add `AUTH_SECRET` to frontend runtime env | 🔴 Fixes 502 |
| **B** | `caddy/Caddyfile.prod` | Use `(app_routes)` snippet; correct `/g2p/*` split; no `/api/*` wildcard | 🔴 Fixes /g2p/nearby |
| **C** | `backend/server.js` | Add `app.set('trust proxy', 1)` after `app` creation | 🟠 IP logging/rate-limit |
| **D** | `frontend/Dockerfile` | Add `ARG BACKEND_URL=http://backend:8000` + `ENV BACKEND_URL` in builder stage | 🟠 Fixes rewrites self-loop |
| **E** | `frontend/src/lib/backendUrl.ts` | Return `""` for all production hosts (OCI IP + custom domains) | 🟠 Hides backend URL |
| **F** | `frontend/src/hooks/useSocket.ts` | Use `window.location.origin` not `getBackendUrl()` | 🟠 Socket same-origin |
| **G** | `docker-compose.prod.yml` | Relax frontend `depends_on` to `service_started`; remove `NEXT_PUBLIC_SIGNAL_URL` build arg | 🟡 Stability + clean bundle |
| **H** | `frontend/src/app/layout.tsx` | Comment out Monetag meta tags (2 locations) | 🟡 Disable ad tags |

---

## Fix A — Auth Secret (Root cause of 502)

**File:** `docker-compose.prod.yml`

The Dockerfile bakes `AUTH_SECRET` at build time, but the runtime container needs it too. NextAuth v5 re-validates it on every boot.

**Add to frontend `environment` block:**
```yaml
frontend:
  environment:
    - NODE_ENV=production
    - PORT=3000
    - HOSTNAME=0.0.0.0
    - BACKEND_URL=http://backend:8000
    - AUTH_SECRET=<same value as Dockerfile ARG>   # ← ADD
```

> **Security note:** `AUTH_SECRET` is a server-side-only env var (no `NEXT_PUBLIC_` prefix). It is NOT embedded in the JS bundle. Safe to pass at runtime.
>
> Long term: move it to a GitHub Actions secret (`OCI_FRONTEND_ENV`) and inject via CI, same as backend `.env.backend`.

---

## Fix B — Caddyfile (DRY app_routes snippet)

**File:** `caddy/Caddyfile.prod` (deployed to `/etc/caddy/Caddyfile` on VM)

The `(app_routes)` snippet is used by all three entry points so IP and production routing can never drift apart.

**Key routing rules:**
- `/api/auth/*` → NOT in backend matcher → falls through to `frontend:3000` (NextAuth stays on Next.js)
- `/g2p/printshop*`, `/g2p/requests*`, etc. → `backend:8000` (Express API routes)
- `/g2p/nearby`, `/g2p/[code]` → NOT in backend matcher → falls through to `frontend:3000` (Next.js pages)
- `/socket.io/*` → `backend:8000` (WebSocket upgrade)

```caddy
{
    email admin@share2.me
}

(app_routes) {
    encode zstd gzip

    # Named matcher: everything that belongs to Express backend
    # NOTE: /api/auth/* is intentionally excluded — NextAuth lives on Next.js
    @backend path \
        /health*        \
        /ping*          \
        /socket.io/*    \
        /api/ice-servers* \
        /api/blogs*     \
        /api/admin*     \
        /api/tools*     \
        /g2p/printshop* \
        /g2p/requests*  \
        /g2p/files*     \
        /g2p/vendor*    \
        /g2p/billing*   \
        /g2p/tools*     \
        /g2p/health*    \
        /download/*     \
        /poc/*

    handle @backend {
        reverse_proxy 127.0.0.1:8000 {
            transport http {
                keepalive         30s
                keepalive_idle_conns 100
            }
        }
    }

    # Everything else → Next.js frontend
    # Covers: /, /api/auth/*, /g2p/nearby, /g2p/[code], all pages
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}

# ── Production HTTPS domains (frontend + API via path routing) ────────────────
share2.me, www.share2.me, share2me.in, www.share2me.in {
    import app_routes

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options    "nosniff"
        X-Frame-Options           "DENY"
        Referrer-Policy           "strict-origin-when-cross-origin"
    }
}

# ── API subdomain — keep until all old tabs/cached bundles drain ──────────────
# Once NEXT_PUBLIC_SIGNAL_URL is removed and all clients use same-origin,
# this block can be removed (or made a redirect to share2.me)
api.share2.me, api.share2me.in {
    reverse_proxy 127.0.0.1:8000 {
        transport http {
            keepalive         30s
            keepalive_idle_conns 100
        }
    }
}

# ── Direct IP fallback (HTTP) — identical routing via snippet ─────────────────
:80 {
    import app_routes
}
```

> **Validate before reloading:** `caddy validate --config /etc/caddy/Caddyfile`

---

## Fix C — backend/server.js: trust proxy

**File:** `backend/server.js`

Without this, `req.ip` behind Caddy returns `127.0.0.1` (Caddy's internal loopback) instead of the real client IP. Rate limiting bans the wrong address. IP logging is useless.

**Add immediately after `const app = express();` (line 25):**
```js
const app    = express();
app.set('trust proxy', 1);   // ← ADD: trust first hop (Caddy on same host)
const server = http.createServer(app);
```

`1` means "trust one proxy hop" — appropriate since Caddy is on the same machine. If you later add Cloudflare in front, change to `2`.

---

## Fix D — Dockerfile: BACKEND_URL as build arg

**File:** `frontend/Dockerfile`

Next.js rewrites (`next.config.mjs`) run at **build time**. `BACKEND_URL` must be available during `npm run build`, not just at runtime. Currently it's only a runtime env var.

**Add to the `builder` stage:**
```dockerfile
# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SIGNAL_URL=https://api.share2.me
ENV NEXT_PUBLIC_SIGNAL_URL=${NEXT_PUBLIC_SIGNAL_URL}
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=G-CCBEZ2KK0S
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID}
ARG AUTH_SECRET=u5wF2eK9L3R8n7Q1x4b6M5v9J8t2d1Zp
ENV AUTH_SECRET=${AUTH_SECRET}

# ← ADD: server-side only, used by next.config.mjs rewrites at build time
# NOT NEXT_PUBLIC_ so it is never embedded in the browser bundle
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=${BACKEND_URL}

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1

RUN npm run build
```

**Update `next.config.mjs` line 159:**
```js
// Before (broken — self-loop to localhost:3000):
const backendUrl = process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";

// After (correct — Docker internal network, server-side only):
const backendUrl = process.env.BACKEND_URL
  || process.env.NEXT_PUBLIC_EXPRESS_URL
  || "http://backend:8000";
```

---

## Fix E — backendUrl.ts: Same-origin for production

**File:** `frontend/src/lib/backendUrl.ts`

Returns `""` (empty string = same domain) for all production hosts. The browser sends `fetch('/api/ice-servers')` — only the path is transmitted, Caddy routes it internally to `backend:8000`. Backend IP/domain is invisible to the browser.

```ts
export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();

    // 1. Local development — use dev backend directly
    if (host === "localhost" || host === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
    }

    // 2. Cloud Run (GCP legacy) — route to Cloud Run backend
    if (host.endsWith(".run.app")) {
      return CLOUD_RUN_BACKEND_URL;
    }

    // 3. All production hosts: OCI IP, share2.me, share2me.in
    //    → Return "" = same-origin relative URLs
    //    → Caddy routes /api/* and /socket.io/* to backend internally
    //    → Browser NEVER sees: 130.210.22.28, :8000, api.share2.me, backend:8000
    return "";
  }

  // Server-side (SSR / Next.js build)
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  return "http://backend:8000";
}
```

---

## Fix F — useSocket.ts: Connect same-origin

**File:** `frontend/src/hooks/useSocket.ts`

Currently: `io(getBackendUrl(), ...)` — which after Fix E returns `""` for production. `io("")` is equivalent to `io(window.location.origin)` in socket.io-client. This actually works — but to be explicit and safe:

```ts
function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!_socket) {
    // Connect to same origin — Caddy routes /socket.io/* to backend:8000
    // This hides the backend address from the browser entirely
    const url = (() => {
      const host = window.location.hostname.toLowerCase();
      // Local dev: connect directly to backend
      if (host === "localhost" || host === "127.0.0.1") {
        return process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
      }
      // Cloud Run: use Cloud Run backend directly
      if (host.endsWith(".run.app")) return CLOUD_RUN_BACKEND_URL;
      // Production: same origin, Caddy proxies /socket.io/*
      return window.location.origin;
    })();

    _socket = io(url, {
      transports: ["websocket"],
      path: "/socket.io/",        // explicit path, Caddy handles it
    });
  }
  return _socket;
}
```

> **Why `window.location.origin` not `""`?**
> Socket.io-client's `io("")` resolves to the current page URL including path — which may not be the root. Using `window.location.origin` is explicit and correct.

---

## Fix G — docker-compose.prod.yml: Stability + clean bundle

**File:** `docker-compose.prod.yml`

**Change 1 — Relax `depends_on`:**
```yaml
# Before: entire frontend waits for backend healthcheck to pass
depends_on:
  backend:
    condition: service_healthy

# After: frontend starts as soon as backend container is running
# Frontend's SSR rewrites use Docker DNS with retry — healthcheck not needed
depends_on:
  backend:
    condition: service_started
```

**Change 2 — Remove `NEXT_PUBLIC_SIGNAL_URL` build arg:**
```yaml
# Before:
args:
  NEXT_PUBLIC_SIGNAL_URL: https://api.share2.me
  NEXT_PUBLIC_GA_MEASUREMENT_ID: G-CCBEZ2KK0S

# After (once backendUrl.ts no longer uses SIGNAL_URL):
args:
  NEXT_PUBLIC_GA_MEASUREMENT_ID: G-CCBEZ2KK0S
  # NEXT_PUBLIC_SIGNAL_URL removed — no longer embedded in bundle
```

> **Prerequisite:** Only remove `NEXT_PUBLIC_SIGNAL_URL` AFTER Fix E is deployed and old cached bundles have drained (a few hours). Keep `api.share2.me` Caddy block active during this window.

---

## Fix H — layout.tsx: Comment out Monetag

**File:** `frontend/src/app/layout.tsx`

**Location 1 — `metadata.other` object (~line 167):**
```tsx
// Before:
other: {
  'monetag': 'e7a411684746076c8866b84b61029822',
},

// After:
other: {
  // 'monetag': 'e7a411684746076c8866b84b61029822',  // disabled — re-enable when needed
},
```

**Location 2 — `<head>` section (~lines 183-184):**
```tsx
// Before:
<meta name="monetag" content="e7a411684746076c8866b84b61029822" />
<meta name="monetag" content="693bcd3157f3fb9f70477feb7fae2765" />

// After:
{/* <meta name="monetag" content="e7a411684746076c8866b84b61029822" /> */}
{/* <meta name="monetag" content="693bcd3157f3fb9f70477feb7fae2765" /> */}
```

---

## URL Hiding: How It Works End-to-End

### Browser network tab: BEFORE
```
GET  https://api.share2.me/api/ice-servers   ← exposes subdomain
WS   wss://api.share2.me/socket.io/          ← exposes subdomain
GET  https://share2me-backend-xxx.run.app/   ← exposes Cloud Run URL
```

### Browser network tab: AFTER all fixes
```
GET  /api/ice-servers          ← only path visible, host is share2.me
WS   wss://share2.me/socket.io/ ← own domain only
GET  /g2p/printshop/nearby?... ← own domain only
```

### Full request flow (invisible to browser)
```
1.  Browser:         fetch('/api/ice-servers')
2.  Caddy:           receives GET /api/ice-servers on share2.me:443
                     @backend matcher → reverse_proxy 127.0.0.1:8000
3.  backend:8000:    handles /api/ice-servers → { iceServers: [...] }
4.  Caddy:           forwards response
5.  Browser:         receives JSON
                     ✅ knows: share2.me + path /api/ice-servers
                     ❌ never sees: 130.210.22.28, :8000, api.share2.me, backend:8000
```

---

## Deployment Order

> Low-risk order: each step is independently verifiable before proceeding.

### Step 1 — Fix Caddy only (no rebuild needed)
```bash
# Edit caddy/Caddyfile.prod locally → commit → push oracle-cloud
# CI rsync copies the file to VM; then SSH:
sudo cp /opt/share2me/app/caddy/Caddyfile.prod /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile   # must pass before reload
sudo systemctl reload caddy
```
**Verify:** `/g2p/nearby` returns HTML (200), not `{"error":"Endpoint not found"}`

### Step 2 — Fix docker-compose.prod.yml (AUTH_SECRET + depends_on)
```bash
# Edit docker-compose.prod.yml → commit → push → CI deploys
# No code rebuild needed — just restart containers with new env
```
**Verify:** `http://130.210.22.28` returns 200, auth pages load

### Step 3 — Fix frontend code + Dockerfile (backendUrl, useSocket, next.config, Monetag)
```bash
# Edit all frontend files → commit → push → CI builds and deploys
# Full docker build + restart
```
**Verify:** Browser DevTools shows no `api.share2.me` in Network tab

### Step 4 — Fix backend (trust proxy)
```bash
# Edit backend/server.js → commit → push → CI rebuilds backend container
```
**Verify:** `docker logs share2me-backend` shows real client IPs in access logs

### Step 5 — Remove NEXT_PUBLIC_SIGNAL_URL build arg
```bash
# Only after Step 3 has been live for a few hours (old bundles drained)
# Edit docker-compose.prod.yml args → commit → push → CI rebuild
```

### Step 6 — DNS Cutover
See section below.

---

## Verification Checklist

```bash
# 1. Main site returns 200
curl -s -o /dev/null -w '%{http_code}' http://130.210.22.28/
# → 200

# 2. Backend health via main route
curl -s http://130.210.22.28/health
# → {"status":"ok",...}

# 3. G2P nearby page (Next.js page, NOT backend error)
curl -s -o /dev/null -w '%{http_code}' http://130.210.22.28/g2p/nearby
# → 200 (HTML, not {"error":"Endpoint not found"})

# 4. G2P printshop API still hits backend
curl -s -o /dev/null -w '%{http_code}' "http://130.210.22.28/g2p/printshop/nearby?lat=28.6&lng=77.2&radius=10000"
# → 200 (JSON from Express)

# 5. API ice-servers via path routing
curl -s -o /dev/null -w '%{http_code}' http://130.210.22.28/api/ice-servers
# → 200

# 6. NextAuth still works (must NOT go to backend)
curl -s -o /dev/null -w '%{http_code}' http://130.210.22.28/api/auth/session
# → 200 (JSON from Next.js, not 404 from Express)

# 7. Monetag NOT in page source
curl -s http://130.210.22.28/ | Select-String "monetag"
# → (no output)

# 8. Backend URL NOT in JS bundle
curl -s "http://130.210.22.28/_next/static/chunks/main-app.js" | Select-String "api\.share2\.me"
# → (no output after SIGNAL_URL is removed)

# 9. All containers healthy
ssh ubuntu@130.210.22.28 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
# → all three: "Up X hours (healthy)"
```

---

## DNS Cutover (Final Step)

> Only after verification checklist fully passes. Lower TTL to 300s a day beforehand.

| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| `share2.me` | A | `130.210.22.28` | 300 |
| `www.share2.me` | A | `130.210.22.28` | 300 |
| `api.share2.me` | A | `130.210.22.28` | 300 |
| `share2me.in` | A | `130.210.22.28` | 300 |
| `www.share2me.in` | A | `130.210.22.28` | 300 |
| `api.share2me.in` | A | `130.210.22.28` | 300 |

After DNS propagates (~5-30 min), Caddy auto-provisions Let's Encrypt / ZeroSSL certs for all domains automatically. No config change needed — `auto_https` is ON by default.

Add `preload` to HSTS only after all subdomains have been on HTTPS for ≥30 days.

---

## What Is NOT Hidden (By Design)

| Item | Visible to | Note |
|------|-----------|------|
| `share2.me` domain | Everyone | Your public brand |
| `/api/*`, `/socket.io/*` path prefixes | Browser DevTools | Path is public, payloads are protected |
| SSL certificate (CT logs) | Anyone | Public by design |
| OCI IP (`130.210.22.28`) | Advanced (WHOIS, traceroute) | Mitigate later with Cloudflare orange-cloud DNS proxy |
| Response data | Authenticated users only | Protected per-request by JWT + session |

**Future hardening:** Cloudflare DNS proxy (orange cloud) hides the OCI IP entirely and adds free WAF, DDoS protection, rate limiting, and bot challenge.
