# Current configuration & known constraints

This is the **canonical** reference for runtime configuration and the known
limits of the current implementation. Older documents in `knowledge/`,
`gcp/README.md`, `aws/` and `v3.0_plan_knowledge/` are historical and may
describe earlier deployment generations.

## 1. Current production topology

The active branch (`oracle-cloud`) deploys to two OCI Always-Free ARM VMs:

| Role | Address | Notes |
| --- | --- | --- |
| Edge / frontend | public | Caddy terminates TLS and routes by path. |
| Backend / signaling | private VCN `10.0.1.218:8000` | Not reachable directly from the internet. |

The browser always uses **same-origin** URLs (`frontend/src/lib/backendUrl.ts`
returns `""` on production hosts). Caddy forwards `/api/*`, `/g2p/*`,
`/socket.io/*`, `/health` and `/metrics` to the backend. Never expose the
private backend IP to the browser bundle.

GCP Cloud Run and AWS/ECS artifacts in this repository are retained history,
not the active deployment.

## 2. Environment variables

See `.env.example` for the full list actually read by the code. Important
corrections to older docs:

| Old documentation said | Code actually uses |
| --- | --- |
| `NEXT_PUBLIC_SIGNAL_URL` | not used; same-origin resolution in `backendUrl.ts` |
| `R2_ENDPOINT` | `R2_ACCOUNT_ID` (endpoint is derived) |
| `backend/db/` migrations | `backend/g2p/schema.sql`, `backend/g2p/migrations/` |
| documented in README only | `NEXT_PUBLIC_EXPRESS_URL`, `BACKEND_URL`, `BACKEND_URL` build arg for Next rewrites |

### Shared JWT secret

`frontend/src/app/api/g2p-token/route.ts` signs the vendor JWT;
`backend/g2p/lib/auth.js` verifies it. Both now resolve through a single helper:

1. `AUTH_JWT_SECRET` (canonical)
2. `JWT_SECRET` (legacy alias)
3. `AUTH_SECRET` (NextAuth name)

The aliases exist so a redeploy does not invalidate every vendor session.
**Set exactly one name, with the same value on frontend and backend.** If more
than one is set and values disagree, the backend logs a critical warning and
`/g2p/health` reports `sharedSecretConflict: true`.

Production refuses to boot if no shared secret or no `DATABASE_URL` is present.

## 3. Single-backend-instance constraint

The following state is process-local even though a Redis Socket.io adapter is
configured:

- P2P rooms (`otcToRoom`) and NACK trackers
- banned IPs and rate-limit buckets
- connected print agents (`connectedAgents`)
- tool job ownership and the tool event bus

Consequences until these move to Redis:

- A P2P sender and receiver on different backend instances cannot find each other.
- Print-job dispatch can be lost if the REST request and agent socket land on
  different instances.
- Rate limits multiply by instance count.

**Deployment rule:** run exactly one backend instance. Do not add a load
balancer with multiple backends until the state is externalized. Redis in the
current stack only fans out Socket.io room broadcasts.

## 4. Tool queue

`backend/g2p/workers/bullmq-mock.js` is an in-memory queue. It is not BullMQ
despite the filename. Jobs, ownership and SSE subscribers are lost on restart.

- `/g2p/health` reports `toolQueueMode: "in-memory-mock"`.
- The backend logs a warning at boot.
- Treat server-side tools as **beta** until a durable queue exists.

Planned migration: real BullMQ on the existing Redis, a `tool_jobs` table for
durable state, Redis pub/sub for cross-process progress, and R2 output TTL
cleanup. This is deliberately not faked in the current code.

### Markdown → PDF

`markdown-to-pdf` is a server tool backed by `engines/markdown.js` and the shared
Chromium renderer. It accepts an uploaded `.md`/`.markdown` file or pasted text;
both paths use the same presign → R2 → queue → SSE → download flow.

- `/g2p/health` reports `capabilities.chromium` and `capabilities["markdown-to-pdf"]`.
- `CHROME_BIN` selects the browser binary (the Docker image already sets it).
- `TOOLS_MD_MAX_BYTES` (default 2 MiB) caps Markdown input.
- `TOOLS_PDF_TIMEOUT_MS` (default 30000) caps the Chromium render.
- Remote images/CSS are blocked by default; only `data:` images are embedded.
- `npm run test:md-pdf --prefix backend` runs pure engine tests and, when a
  browser is present, a render + determinism smoke test. CI runs this job.

## 5. Upload validation

`POST /g2p/files/:fileId/complete` now verifies that the first 4 KB of the R2
object matches the declared MIME type (PDF, images, ZIP-based Office, OLE2
Office, plain text/JSON/CSV). This closes the "renamed executable" path created
by presigned uploads.

- Emergency bypass: `DISABLE_MAGIC_BYTE_CHECK=true` (logs a warning; never use
  in normal production).
- Print-shop uploads (`POST /g2p/printshop/jobs`) still return a presigned URL
  without a completion/validation step. That path remains a known gap.

## 6. Build quality

- `npx tsc --noEmit` is clean and `typescript.ignoreBuildErrors` is back to `false`.
- ESLint still has a large pre-existing backlog, so `eslint.ignoreDuringBuilds`
  remains `true`. `.github/workflows/verify.yml` runs ESLint as an informational
  job so the backlog stays visible. Do not flip the flag until it is cleared.
- `.github/workflows/verify.yml` runs TypeScript and backend `node --check`
  on every relevant push/PR. It does not deploy anything.

## 7. Secrets in the workspace

Credential-looking files exist in the working tree (OCI/GCP/AWS PEM keys,
tokens, local `.env` files). They are gitignored and are **not** in the current
git index, but they must still be treated as compromised:

1. Rotate every key, token and signing secret that may have been shared.
2. Keep secrets in the deployment secret store (GitHub Actions secrets → VM
   `.env.backend` / `.env.frontend`), never in the repository.
3. Never commit or push this workspace without reviewing `git status` first.

## 8. Known stubs / debug leftovers

- `POST /g2p/vendor/upgrade` returns `403 payment_required` by design; use
  `/g2p/billing/subscription/create-order`.
- `GET /g2p/vendor/analytics/test` returns 404 in production (debug-only).
- Tool chaining in `PdfToolShell` is still marked "coming in Phase 6".
- `monitoring/` does not contain a usable Prometheus configuration yet.
