# Tools fixing — audit and production-grade remediation plan

> **Created:** 2026-11-24  
> **Status:** Planning document only. No application code was changed by this audit.  
> **Scope:** All tools except tools in the `ai` category.  
> **Source of truth for catalogue:** `frontend/src/lib/pdfTools.ts`

---

## 1. Executive summary

The tools catalogue currently advertises **32 tools**, all marked `phase: "ready"` in `frontend/src/lib/pdfTools.ts:62-108`. The audit found that this label is not reliable:

- Some tools are fully implemented and safe to use.
- Some tools are guaranteed to fail because the queue dispatcher has no matching engine.
- Some tools run successfully but produce results that contradict their own catalogue description or configuration UI.
- Many server-side tools are wired correctly but depend on external infrastructure (R2, LibreOffice, Chromium, qpdf, mutool, Gemini, ML service). In an environment missing those dependencies they fail at job runtime, often after the file has already been uploaded.

This document records the audit evidence and a production-grade plan to fix the in-scope tools end to end: catalogue, UI, worker, backend engine, queue, storage, validation, observability, rollout and verification.

### Headline numbers

| Category | Count | Notes |
|---|---:|---|
| Total catalogued tools | 32 | All marked `ready`. |
| Tools excluded as `ai` category | 5 | `bg-remover`, `ai-summarizer`, `translate-pdf`, `ocr-pdf`, `scan-to-pdf`. |
| In-scope tools | 27 | Categories: organize, convert-to-pdf, convert-from-pdf, edit, security, optimize. |
| In-scope tools with no known defect | 6 | Need regression tests only. |
| In-scope tools with a shared PDF-renderer risk | 4 | `compare-pdf` is confirmed broken; `edit-pdf`, `redact-pdf` and `sign-pdf` use the same renderer. |
| In-scope tools needing contract or engine fixes | 21 | 1 hard queue failure, 1 confirmed renderer failure, 7 wrong-contract tools, 9 dependency/engine-risk tools. Categories overlap; unique total is 21. |
| AI-category tools | 5 | Out of scope for this pass. |

Correction from review: `compare-pdf` was initially classified as OK. It is now confirmed broken by live reproduction and is included in the fix plan.

Special case: **`pdf-to-markdown`** is in the `convert-from-pdf` category, so it is in scope for this plan, but its current backend engine uses Gemini. It is treated as an AI-dependent non-AI-category tool. A product decision is needed at Phase 0: either keep it in this plan with an explicit `GEMINI_API_KEY` capability gate and configurable model, or defer it with the AI tools.

---

## 2. Scope

### 2.1 In scope

All tools whose `category` in `frontend/src/lib/pdfTools.ts:62-108` is not `"ai"`:

#### Organize

- `merge-pdf`
- `split-pdf`
- `rotate-pdf`
- `organize-pdf`
- `crop-pdf`
- `page-numbers`

#### Convert to PDF

- `jpg-to-pdf`
- `word-to-pdf`
- `excel-to-pdf`
- `powerpoint-to-pdf`
- `html-to-pdf`

#### Convert from PDF

- `pdf-to-jpg`
- `pdf-to-word`
- `pdf-to-excel`
- `pdf-to-powerpoint`
- `pdf-to-markdown`
- `pdf-to-pdfa`

#### Edit

- `edit-pdf`
- `watermark-pdf`
- `pdf-forms`
- `redact-pdf`
- `compare-pdf`

#### Security

- `protect-pdf`
- `unlock-pdf`
- `sign-pdf`

#### Optimize

- `compress-pdf`
- `repair-pdf`

### 2.2 Out of scope for this pass

The following tools are in `category: "ai"` and are intentionally excluded:

| Slug | Catalogue line | Current state |
|---|---:|---|
| `bg-remover` | `pdfTools.ts:103` | Custom UI + `/api/tools/bg-remover` + Python ML service. |
| `ai-summarizer` | `pdfTools.ts:104` | Server queue + Gemini + Puppeteer rendering. |
| `translate-pdf` | `pdfTools.ts:105` | Server queue + Gemini. |
| `ocr-pdf` | `pdfTools.ts:106` | Server queue + Gemini; local Tesseract engine is dead code. |
| `scan-to-pdf` | `pdfTools.ts:107` | Client-side camera capture; currently working. |

They should remain marked `ready` only if their capabilities are verified separately. This document does not plan their fixes.

---

## 3. Current architecture and constraints

### 3.1 Frontend execution paths

Every tool page is dynamically routed through:

- `frontend/src/app/tools/[slug]/page.tsx`
- `frontend/src/components/PdfToolShell.tsx`
- `frontend/src/hooks/useToolProcessor.ts`

`useToolProcessor` has two fundamentally different paths:

1. **Client tier** (`processingTier: "client"`)
   - Reads selected files into `ArrayBuffer`s.
   - Posts `{ type: "PROCESS", requestId, slug, buffers, config }` to `frontend/public/workers/pdf-processor.js`.
   - Worker handler is selected from `TOOL_HANDLERS` at `pdf-processor.js:120-408`.
   - Unknown slugs return `UNKNOWN_TOOL` at `pdf-processor.js:419-423`.

2. **Server tier** (`processingTier: "server"`)
   - Calls `POST /g2p/tools/presign`.
   - Uploads the first file directly to R2 with `axios.put`.
   - Calls `POST /g2p/tools/:slug/enqueue`.
   - Opens an SSE stream to `GET /g2p/tools/jobs/:job_id/stream`.
   - Downloads the output object after a `complete` event.
   - Evidence: `frontend/src/hooks/useToolProcessor.ts:150-275`.

Important: the server path always uses `files[0]`. Any server tool whose shell allows multiple files will silently process only the first file.

### 3.2 Backend execution paths

Server-tier tools are mounted through:

- `backend/server.js:182-192`
- `backend/g2p/index.js:30,39`
- `backend/g2p/routes/tools.js`

`backend/g2p/routes/tools.js` currently:

- Whitelists 14 slugs at lines 47-53.
- Validates only `translate-pdf` and `protect-pdf` configs explicitly at lines 57-64; everything else uses a passthrough schema.
- Offers a synchronous `/process` endpoint only for `protect-pdf` at lines 85-126.
- Generates R2 presigned upload URLs at lines 130-152.
- Enqueues jobs at lines 156-201.
- Stores job ownership in an in-memory `Map` at line 77.

`backend/g2p/workers/bullmq-mock.js` is **not** BullMQ. It is an in-memory queue:

- Jobs and SSE subscribers live only in the backend process (`bullmq-mock.js:14-21`).
- The dispatcher handles 13 slugs at `bullmq-mock.js:64-101`.
- Anything else throws `Engine for slug ${slug} is not implemented yet.` at `bullmq-mock.js:102-103`.

`docs/CONFIGURATION.md:74-85` confirms this is known technical debt.

### 3.3 Deployment constraints

From `docs/CONFIGURATION.md`:

- Production runs on OCI with Caddy at the edge and a private backend.
- The browser uses same-origin URLs; Caddy forwards `/g2p/*`, `/api/*`, `/socket.io/*`.
- Run exactly **one backend instance** until process-local state is externalized.
- Tool job ownership, event bus, rate limits and P2P rooms are process-local.
- R2 object lifecycle/TTL is a design goal, not yet a verified enforcement point.
- Tool uploads currently rely on extension whitelisting at presign; the magic-byte validation added for G2P files does not cover tool inputs.

### 3.4 External binaries and services

The backend Docker image installs `qpdf`, `mupdf-tools`, `libreoffice`, `tesseract-ocr`, `chromium` and fonts (`backend/Dockerfile:25-39`). However:

- The local development machine used for this audit did **not** have `qpdf`, `libreoffice`, `soffice`, `tesseract`, `chromium` or `chrome` on `PATH`.
- `mutool` was present.
- R2/Gemini/ML env variable names exist locally, but their values and validity were not inspected or exposed.

Any local manual verification of server tools must account for this difference.

---

## 4. Audit results

### 4.1 Hard failure — guaranteed broken

| Slug | Tier | Status | Root cause | Evidence |
|---|---|---|---|---|
| `protect-pdf` | server | **BROKEN** | Frontend sends it through the async queue; backend whitelist accepts it; queue dispatcher has no `protect-pdf` branch and throws `Engine for slug protect-pdf is not implemented yet.` The only real implementation is the synchronous `/process` endpoint, which the frontend never calls. | `pdfTools.ts:94`; `page.tsx:25`; `useToolProcessor.ts:150-195`; `tools.js:47-53,85-126,156-195`; `bullmq-mock.js:64-104` |
| `compare-pdf` | client | **BROKEN** | Shared PDF renderer loads `/pdf.worker.min.mjs` but does not configure `cMapUrl` or `standardFontDataUrl`. PDFs using standard/non-embedded fonts can fail during `getDocument`/page rendering. `ComparePdfUI` then swallows the real exception in an empty `catch` and shows a misleading “valid, non-encrypted PDFs” message. | `pdfRender.ts:19-25,43`; `ComparePdfUI.tsx:97-121`; `pdfTools.ts:91` |

The frontend handles SSE `error` events at `useToolProcessor.ts:243-252`, so the user sees a server error rather than an indefinite spinner. The job still cannot complete.

`compare-pdf` is not an isolated defect. `renderPdfToCanvases` is shared by `SignPdfUI`, `RedactPdfUI`, `PdfEditorUI`, `ActionPanel` and `ComparePdfUI`. Fixing the renderer protects all of them.

### 4.2 In-scope tools that run but violate their advertised contract

| Slug | Advertised | Actual | Root cause | Evidence |
|---|---|---|---|---|
| `jpg-to-pdf` | Checkbox: “Fit Image to Page (A4)” | Default `fitToPage: true` creates image-sized pages, not A4 | Worker uses A4 only when `fitToPage === false`; semantics are inverted | `JpgToPdfConfig.tsx:13-29`; `pdf-processor.js:287-289` |
| `pdf-to-jpg` | “Extract every page of a PDF as a JPG image” | Renders exactly one page, default `1`, and returns one JPG | Multi-page/ZIP path was never implemented; config itself admits this | `pdfTools.ts:79`; `PdfToJpgConfig.tsx:43-45`; `useToolProcessor.ts:414-441`; `pdf-processor.js:401-405` |
| `split-pdf` | “Split a PDF into separate files” | Produces one PDF containing the selected range | Worker explicitly defers multi-file/ZIP output | `pdfTools.ts:65`; `pdf-processor.js:141-162` |
| `organize-pdf` | “Reorder, delete, or duplicate pages inside a PDF visually” | Text field for comma-separated page order; reorder only | Visual organizer, delete and duplicate were never built | `pdfTools.ts:67`; `OrganizeConfig.tsx:27-41`; `pdf-processor.js:184-201` |
| `page-numbers` | Six positions offered in UI | Three positions silently fall back to bottom-center | Worker switch implements only `bottom-right`, `top-center`, `bottom-center` | `PageNumbersConfig.tsx:25-32`; `pdf-processor.js:252-258` |
| `html-to-pdf` | “Paste a URL or upload an .html file” | Only generic file upload; no URL input | Config component missing; backend engine only accepts uploaded HTML buffer | `pdfTools.ts:76`; `page.tsx:20-33,101-109`; `bullmq-mock.js:67-69` |
| `compress-pdf` | Quality selector: screen/eBook/printer | Quality value ignored; only structural `useObjectStreams` save. Multi-file UI uses only first file. | Real image recompression was never implemented; shell does not mark it single-file | `CompressConfig.tsx:19-29`; `page.tsx:51-75`; `pdf-processor.js:386-395` |

### 4.3 In-scope tools with deployment/engine risk

These tools are wired correctly in code but can fail in production if their dependency is missing, misconfigured or overloaded.

| Slug(s) | Engine | Dependency / risk | Evidence |
|---|---|---|---|
| `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf` | LibreOffice | Requires R2 + queue + LibreOffice binary. Local machine lacks LibreOffice. | `bullmq-mock.js:64-65`; `engines/libreoffice.js:20-35`; `backend/Dockerfile:25-39` |
| `html-to-pdf` | Puppeteer | Requires Chromium + R2 + queue. Local machine lacks Chromium. Also has the missing URL contract above. | `engines/puppeteer.js:14-30`; `backend/Dockerfile:8-9,31-44` |
| `pdf-to-word`, `pdf-to-excel`, `pdf-to-powerpoint` | Office engine | Requires R2 + queue + custom extraction/conversion. `pdf-to-excel` uses heuristic table extraction. | `bullmq-mock.js:90-100`; `engines/office.js:134-178,277-281` |
| `pdf-to-markdown` | AI/Gemini | Requires `GEMINI_API_KEY` before native markdown path can run. Non-AI catalogue category but AI implementation. | `bullmq-mock.js:79-82`; `engines/ai.js:20-24` |
| `pdf-to-pdfa` | LibreOffice | Requires LibreOffice PDF/A export support. | `bullmq-mock.js:87-89`; `engines/libreoffice.js:44-70` |
| `repair-pdf` | mutool | Requires mutool plus fallback chain. Local machine has mutool; production Docker installs `mupdf-tools`. | `bullmq-mock.js:83-85`; `engines/mutool.js:40-89` |

### 4.4 Shared renderer risk

`frontend/src/lib/pdfRender.ts` is a single point of failure for several interactive tools:

- `compare-pdf` — confirmed broken by user reproduction.
- `edit-pdf` — same renderer, no cMap/standard-font assets configured.
- `redact-pdf` — same renderer.
- `sign-pdf` — same renderer.
- `ActionPanel` preview path — same renderer.

Evidence: `pdfRender.ts:19-25,34-68`; `ComparePdfUI.tsx:97-121`; `SignPdfUI.tsx:327`; `RedactPdfUI.tsx:46`; `PdfEditorUI.tsx:190`; `ActionPanel.tsx:127`.

Verified environment facts:

- `frontend/node_modules/pdfjs-dist/cmaps/` and `frontend/node_modules/pdfjs-dist/standard_fonts/` exist.
- `frontend/public/` contains `pdf.worker.min.mjs` but **no** `cmaps/` or `standard_fonts/` directories.
- The renderer never sets `cMapUrl`, `cMapPacked` or `standardFontDataUrl`.

The production fix should self-host those assets under `frontend/public/pdfjs/` and point PDF.js at them. Using a CDN would work only if CSP `connect-src` allows it; self-hosting is preferred because it removes a third-party runtime dependency.

### 4.5 In-scope tools with no known functional defect

These tools have matching UI, handler and output behaviour and do not depend on the shared renderer:

- `merge-pdf`
- `rotate-pdf`
- `crop-pdf`
- `watermark-pdf`
- `pdf-forms`
- `unlock-pdf`

`edit-pdf`, `redact-pdf` and `sign-pdf` have correct contracts but remain exposed to the shared renderer defect above. The excluded `scan-to-pdf` is client-side and working, but remains out of scope because it is in the `ai` category.

### 4.6 Cross-cutting audit findings

- Tool chaining is still placeholder-only: `frontend/src/components/PdfToolShell.tsx:428-444`.
- `PdfToolShell` header says “all 31 tools” but the catalogue has 32: `PdfToolShell.tsx:3-4`.
- `ToolProcessingTier` defines `"hybrid"` but no slug uses it: `pdfTools.ts:21-24`.
- `getToolsByCategory` is defined but unused: `pdfTools.ts:114-116`.
- `getSessionToken` and `requireAuth` in `backend/g2p/routes/tools.js:31-42` are unused.
- The local Tesseract engine at `backend/g2p/workers/engines/tesseract.js` is not dispatched anywhere.
- Stale comment says the processing engine “will slot into `onProcess`” at `page.tsx:35-38`, although `useToolProcessor` is already wired.
- `frontend/src/lib/pdfRender.ts` omits cMap and standard-font asset URLs while using a locally served v6 worker; this is the confirmed `compare-pdf` failure mode.
- `ComparePdfUI.tsx:119-121` uses an empty `catch`, hiding the real exception and producing a misleading user message.
- `backend/g2p/workers/engines/ai.js:45,73,113` hard-codes `gemini-3-flash-preview`. This is a **valid preview model**, not a nonexistent one, but it is still fragile because a preview model can be retired or routed. It should be configurable and default to a supported stable model.

---

## 5. Root-cause clusters

All in-scope problems reduce to seven root causes:

1. **Catalogue drift**  
   `PDF_TOOLS` descriptions and `phase: "ready"` are not tied to an implementation contract.

2. **Dispatcher drift**  
   The frontend, backend whitelist and queue dispatcher are three separate lists. `protect-pdf` exists in two of them but not the third.

3. **Config contract drift**  
   Config components emit keys/values that workers either ignore or interpret differently (`jpg-to-pdf`, `page-numbers`, `compress-pdf`).

4. **Deferred features shipped as ready**  
   Multi-page ZIP, multi-file split, visual organize and real compression were documented as future work in code comments but still advertised as ready.

5. **Environment assumptions in code**  
   Server tools assume R2 credentials, LibreOffice, Chromium, qpdf, mutool and API keys exist. There is no capability gate before a user uploads a file.

6. **Non-production queue/storage semantics**  
   Jobs, ownership, progress events and rate limits are process-local; R2 lifecycle cleanup is not enforced as a verified production control.

7. **Shared PDF renderer misconfiguration and swallowed errors**  
   `pdfRender.ts` serves the PDF.js worker locally but not its cMap/standard-font assets, and `ComparePdfUI` hides the resulting exception behind a generic message. The same renderer is used by four other in-scope tools.

---

## 6. Target architecture

### 6.1 Single source of truth

Introduce a shared tool registry that includes, for every slug:

```ts
{
  slug,
  title,
  description,
  category,
  phase,                  // ready | beta | unavailable
  processingTier,         // client | server
  acceptedMimeTypes,
  maxFileBytes,
  configSchema,
  clientHandler?,         // worker case
  serverEngine?,          // queue dispatcher case
  capabilities: [],       // r2, libreoffice, chromium, qpdf, mutool, gemini
  outputExtension,
  outputMimeType,
  smokeFixture
}
```

The frontend catalogue, backend whitelist and contract tests should all derive from this registry or be validated against it in CI.

### 6.2 Client tier target

- One worker handler per client tool.
- No silent fallbacks for unsupported config values.
- ZIP output via `fflate` for multi-file outputs.
- PDF.js worker, cMap and standard-font assets all self-hosted from `public/pdfjs/` and version-matched to `pdfjs-dist`.
- Renderer failures logged with the real error and mapped to actionable user messages; no empty `catch` blocks.
- Explicit error codes for invalid ranges, bad passwords, unsupported characters and out-of-memory conditions.
- Large in-browser jobs remain bounded by file-size limits and worker memory limits.

### 6.3 Server tier target

```text
Browser
  → POST /g2p/tools/presign
  → PUT file to R2
  → POST /g2p/tools/:slug/enqueue
  → job row in tool_jobs (Postgres)
  → BullMQ job in Redis
  → worker downloads R2 object
  → magic-byte + size validation
  → engine runs with timeout/concurrency limit
  → output uploaded to tools/output/
  → Redis pub/sub emits progress
  → SSE reads from Redis pub/sub
  → browser downloads output
  → R2 lifecycle deletes input/output after TTL
```

### 6.4 Capability gating

Before a tool is marked `ready`, the backend must know its capabilities:

| Capability | Check |
|---|---|
| `r2` | Presign/get/put/delete smoke test at boot or health probe. |
| `libreoffice` | `soffice --version` succeeds. |
| `chromium` | Puppeteer can launch `CHROME_BIN`. |
| `qpdf` | `qpdf --version` succeeds. |
| `mutool` | `mutool -v` succeeds. |
| `gemini` | API key present; optional cheap validation call. |

`GET /g2p/health` should report tool capabilities and unavailable slugs. The frontend should render unavailable tools with a clear state rather than allowing upload.

---

## 7. Remediation plan

### 7.0 Sequencing decision (revised after review)

The queue rewrite is **not** a prerequisite for fixing the tools users are hitting today. Production currently runs one backend process, so the in-memory job bus works for current single-process operation. The durable queue remains required before multi-instance scaling or GA labelling, but it must not block P0/P1 fixes.

| Milestone | Scope | Phases |
|---|---|---|
| **M1 — Immediate P0 hotfixes** | Fix `protect-pdf`; fix shared PDF renderer and `compare-pdf` error reporting; provision Google OAuth env on VM 1; confirm CI workflow is already fixed; add the smallest registry guard so these cannot regress. | Phase 1 (minimal), Phase 2 renderer item, Phase 3, adjacent infra items |
| **M2 — Tool contract and quality** | Fix config semantics, implement missing client features, add capability health checks, harden server engines. | Phase 2, Phase 4, Phase 5 |
| **M3 — Platform hardening / GA gate** | Durable queue, Postgres job state, Redis pub/sub, TTL enforcement, full observability. Do this before multi-instance rollout or calling server tools GA. | Phase 6, Phase 7 |

Adjacent production issues found during review but outside the tools scope:

| Issue | Evidence | Status |
|---|---|---|
| Google OAuth `invalid_request: Missing required parameter: client_id` | `frontend/src/auth.ts:39-42` passes empty strings when env vars are absent; `docker-compose.frontend.yml:22-24` loads `.env.frontend`. | Requires deployment-side verification/provisioning of `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on VM 1. Do not put secret values in the repo. |
| `Verify` workflow failed for commit `5244d90` | Old workflow used `npm ci` with an untracked `package-lock.json`. Current `.github/workflows/verify.yml:23-24` uses `npm install --prefix frontend`, and the push trigger was removed. | Already fixed in `e1fe919`. No further action. |

### Phase 0 — Decisions and registry freeze

**Goal:** Decide truth versus implementation for every broken contract and freeze the supported tool matrix.

Actions:

1. Decide whether `pdf-to-markdown` stays in scope despite its Gemini dependency.
2. For each wrong-contract tool, choose one:
   - **Implement the promised feature**, or
   - **Change the promise** to match actual behaviour.
3. Recommended choices:

| Slug | Recommendation |
|---|---|
| `jpg-to-pdf` | Implement both `auto` and `a4` page sizing; migrate `fitToPage` to a named `pageSize` with backward-compatible mapping. |
| `pdf-to-jpg` | Implement all-pages ZIP; retain single-page mode. |
| `split-pdf` | Implement both `range` and `each-page` modes; ZIP for `each-page`. |
| `organize-pdf` | Implement full visual reorder/delete/duplicate in the tool UI; global theme untouched. |
| `page-numbers` | Implement all six positions in the worker. |
| `html-to-pdf` | Implement URL input with SSRF-safe backend fetching; keep HTML upload. |
| `compress-pdf` | Add real quality levels via a server Ghostscript/qpdf path; keep client structural compression as instant fallback. |
| `protect-pdf` | Implement in the queued dispatcher with qpdf. |
| `compare-pdf` | Fix shared PDF.js assets and surface the real error; then add fixture tests for standard-font PDFs. |
| `edit-pdf`, `redact-pdf`, `sign-pdf` | No contract change; regression-test them against the same renderer fix. |

Exit criteria: signed-off tool matrix with exact behaviour, tier, capabilities and output format for every in-scope slug.

### Phase 1 — Contract tests and CI gate

**Goal:** Prevent catalogue/dispatcher drift from recurring.

Actions:

1. Add a backend/frontend-shared registry test that asserts:
   - every `ready` client tool has a `TOOL_HANDLERS` entry,
   - every `ready` server tool has a `bullmq`/engine branch,
   - every emitted config key is consumed by its handler,
   - every output extension has a MIME type,
   - every capability-gated tool is hidden or marked unavailable when the capability is absent.
2. Add fixture-based smoke tests for client worker handlers using representative PDFs/images.
3. Extend `.github/workflows/verify.yml` with:
   - `npm run test:tools:contract`,
   - `npm run test:tools:client`,
   - backend engine unit tests for slugs with deterministic outputs.
4. Do not flip ESLint build gating; keep the existing informational lint job.

Exit criteria: CI fails when a `ready` tool has no handler or when a known config key is unused.

### Phase 2 — Truth and config fixes

**Goal:** Make current user-visible behaviour correct and predictable before deeper engine work.

Actions:

1. **M1 renderer hotfix:** copy `pdfjs-dist/cmaps` and `pdfjs-dist/standard_fonts` into `frontend/public/pdfjs/`, then set `cMapUrl: "/pdfjs/cmaps/"`, `cMapPacked: true` and `standardFontDataUrl: "/pdfjs/standard_fonts/"` in `pdfRender.ts`. Keep the worker version matched to the package version.
2. **M1 error visibility:** replace the empty `catch` in `ComparePdfUI.tsx:119-121` with real error logging and a taxonomy that distinguishes encrypted PDFs, missing font/cMap data, corrupt files and render failures.
3. Fix `jpg-to-pdf` boolean semantics and rename config to explicit `pageSize`.
4. Add all missing `page-numbers` positions in `pdf-processor.js`.
5. Update `compress-pdf` config copy and make the worker reject or honour quality explicitly.
6. Mark `pdf-to-jpg`, `split-pdf`, `organize-pdf` and `html-to-pdf` as `beta` until their full features land, unless Phase 4 is shipped in the same release.
7. Make the Gemini model configurable via `GEMINI_MODEL`, defaulting to a supported stable model such as `gemini-3.6-flash`; do not downgrade to `gemini-2.0-flash`. This applies only because `pdf-to-markdown` uses the shared engine; AI-category tools remain out of scope.
8. Fix stale “31 tools” and “Phase 2 will slot into onProcess” comments.

Exit criteria: no in-scope tool promises a behaviour it does not have; all config values have defined effects.

### Phase 3 — Fix `protect-pdf`

**Goal:** Make the one guaranteed-failing tool complete through the standard job flow.

Actions:

1. Add a `protect-pdf` branch to `backend/g2p/workers/bullmq-mock.js` (or its BullMQ replacement).
2. Reuse the qpdf invocation pattern from `backend/g2p/routes/tools.js:104-120`:
   - `qpdf --encrypt userPassword ownerPassword 256 -- input output`
   - `execFile` with argument arrays, never shell interpolation.
   - Never log passwords.
   - Delete temp input/output in `finally`.
3. Set output extension `.pdf` and MIME `application/pdf`.
4. Gate the tool on a `qpdf` capability probe. If qpdf is unavailable, use a pdf-lib encryption fallback only if the pinned pdf-lib version supports the required permissions; otherwise return `CAPABILITY_UNAVAILABLE` **before** the user uploads a file.
5. Keep the synchronous `/process` endpoint only as a deprecated fallback, then remove it once the queue path is proven.
6. Add tests:
   - protected output requires the user password,
   - wrong password fails,
   - owner password behaviour matches configuration,
   - passwords never appear in logs or error responses.

Exit criteria: `protect-pdf` succeeds through presign → enqueue → SSE → download in local and container environments with qpdf available.

### Phase 4 — Client tool completeness

**Goal:** Implement the advertised features for non-AI client tools.

#### 4.1 `pdf-to-jpg`

- Iterate all pages with `pdfjs-dist`.
- Render each page to JPEG at the chosen scale.
- Add all JPEGs to a ZIP with `fflate`.
- Output `processed-<name>-images.zip` for all-pages mode.
- Keep one-page mode for small/simple use.
- Bound page count and scale to avoid memory exhaustion on low-end devices.

#### 4.2 `split-pdf`

- Add `mode: "range" | "each-page"`.
- `range` keeps current single-PDF behaviour.
- `each-page` writes one PDF per page into a ZIP.
- Validate page ranges before processing.

#### 4.3 `organize-pdf`

- Replace the text order field with a visual page organizer using thumbnails.
- Support reorder, delete and duplicate.
- Emit an explicit `operations` array; worker applies operations in order.
- Preserve a text fallback for accessibility and fast keyboard use.
- This changes only the tool page, not the global theme.

#### 4.4 `page-numbers`

- Implement `bottom-left`, `bottom-center`, `bottom-right`, `top-left`, `top-center`, `top-right`.
- Add alignment/font options only if fixtures exist for them.
- Reject unknown positions instead of falling through.

#### 4.5 `compress-pdf`

- Client path: structural optimisation with honest copy.
- Server path: Ghostscript-based recompression with quality presets:
  - screen: 72 dpi, JPEG quality 40,
  - ebook: 110 dpi, JPEG quality 60,
  - printer: 150 dpi, JPEG quality 85.
- If Ghostscript is unavailable, return `CAPABILITY_UNAVAILABLE` before upload.
- Report before/after size in the ActionPanel.

Exit criteria: every in-scope client tool produces the advertised output format for its fixture set.

### Phase 5 — Server tool reliability

**Goal:** Make all non-AI server tools production-reliable.

#### 5.1 Engine wrappers

Create one wrapper module per engine with a uniform contract:

```js
async function run(inputBuffer, config, ctx) -> {
  outputBuffer,
  outputExtension,
  outputMimeType,
  warnings
}
```

`ctx` provides `emitProgress`, `signal`, `jobId`, temp directory and logger.

Requirements for every engine:

- startup capability probe,
- per-job timeout,
- bounded concurrency,
- deterministic temp directories,
- no shell interpolation,
- structured error codes,
- cleanup in `finally`,
- output size limit,
- no secrets in logs.

#### 5.2 Engine-specific work

| Engine | Tools | Production work |
|---|---|---|
| LibreOffice | `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`, `pdf-to-pdfa` | Serialize or tightly bound conversions, writable profile per job, `soffice --headless`, filter selection for PDF/A, fixture suite for DOCX/XLSX/PPTX. |
| Puppeteer | `html-to-pdf` | Add URL mode with SSRF protection: allow only `http/https`, block private/link-local/metadata IPs, cap redirects and response size, disable local file access, set navigation timeout, use `page.setContent` for uploaded HTML. |
| Office extraction | `pdf-to-word`, `pdf-to-excel`, `pdf-to-powerpoint` | Add page/table limits, quality warnings, fallback to plain text when layout extraction fails, fixture-based acceptance for tables and multi-page documents. |
| qpdf | `protect-pdf` | Covered in Phase 3. |
| mutool | `repair-pdf` | Fallback chain, corrupt-file classification, max recovery pages, output validation with `pdf-lib` before upload. |
| Gemini | `pdf-to-markdown` | Keep only if Phase 0 retains it. Add key probe, token/cost limit, timeout, prompt-version record and deterministic fallback message when unavailable. Replace hard-coded `gemini-3-flash-preview` with `GEMINI_MODEL` defaulting to a stable model (for example `gemini-3.6-flash`). `gemini-3-flash-preview` is valid but preview; `gemini-2.0-flash` is an older, sunset-prone target and is not recommended. |

Exit criteria: all server tools have structured errors, timeouts, capability checks and fixture tests.

### Phase 6 — Durable queue, storage and security (Milestone 3 / GA gate)

**Goal:** Remove beta limitations before multi-instance rollout or GA labelling. This phase is deliberately **not** a blocker for Milestone 1 or 2. Production currently runs one backend process, where the in-memory event bus and job map are functionally adequate.

Actions:

1. Replace `bullmq-mock.js` with real BullMQ on the existing Redis.
2. Add a `tool_jobs` table:

```sql
job_id            uuid primary key
slug              text not null
owner_token_hash  text not null
input_r2_key      text not null
output_r2_key     text
status            text not null
progress_pct      integer not null default 0
error_code        text
error_message     text
attempts          integer not null default 0
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
expires_at        timestamptz not null
```

3. Store only a hash of the client session token; never store the raw token.
4. Publish progress through Redis pub/sub; SSE handlers subscribe to Redis, not a local `EventEmitter`.
5. Move tool rate limits to Redis, keyed by session token and IP.
6. Validate uploaded bytes after download from R2 using the same magic-byte detector as `frontend/src/../backend/g2p/lib/validate.js` patterns. Extension whitelisting at presign is not sufficient.
7. Enforce R2 lifecycle deletion for `tools/input/*` and `tools/output/*`, with a scheduled sweeper as a backstop.
8. Delete input/output objects immediately on terminal failure where retention provides no value.
9. Keep the single-backend deployment rule until P2P rooms, print agents and rate limits are externalized too.

Exit criteria: backend restart does not lose accepted jobs; progress works across processes; no tool object lives beyond its TTL; job download ownership survives restart.

### Phase 7 — Observability, rollout and rollback

**Goal:** Ship safely and know when a tool is failing before users report it.

Actions:

1. Add metrics:
   - jobs accepted, started, completed, failed,
   - duration by slug and engine,
   - failure code counts,
   - R2 upload/download failures,
   - capability probe failures,
   - output bytes and compression ratio.
2. Add structured logs with `jobId`, `slug`, `engine`, `durationMs`, `errorCode`; never log file contents, passwords or tokens.
3. Add per-tool feature flags via environment or database config:

```text
TOOLS_ENABLED=merge-pdf,split-pdf,rotate-pdf,...
TOOLS_BETA=pdf-to-jpg,split-pdf,organize-pdf
```

4. Roll out in waves:
   - Wave 1 / M1: shared renderer fix + `compare-pdf` error visibility + `protect-pdf` queue engine + Google OAuth env provisioning.
   - Wave 2 / M2: config truth fixes and client feature completion, then server tools with capability gates.
   - Wave 3 / M3: durable queue, then remove beta labels and allow multi-instance backend deployment.
5. Rollback is a flag flip plus redeploy; no database migration should be required to disable a tool.
6. Keep a public status entry for tool capabilities in `/g2p/health`.

Exit criteria: every in-scope tool can be independently disabled, measured and rolled back.

---

## 8. Per-tool work packages

| Slug | Current status | Work package | Phase | Output |
|---|---|---|---|---|
| `protect-pdf` | BROKEN | Add queue engine branch with qpdf | 3 | Encrypted PDF via normal job flow |
| `jpg-to-pdf` | WRONG CONTRACT | Replace inverted boolean with explicit page-size modes | 2 | A4 or image-sized pages as selected |
| `pdf-to-jpg` | WRONG CONTRACT | All-pages render + ZIP | 4 | ZIP of JPEGs or single JPG |
| `split-pdf` | WRONG CONTRACT | Range + each-page ZIP modes | 4 | One PDF or ZIP of PDFs |
| `organize-pdf` | WRONG CONTRACT | Visual page organizer with operations array | 4 | Reordered/edited PDF |
| `page-numbers` | WRONG CONTRACT | Implement all six positions | 2 | Correct placement |
| `html-to-pdf` | WRONG CONTRACT + DEPENDENCY | Add URL input, SSRF-safe fetch, capability gate | 2 + 5 | PDF from URL or uploaded HTML |
| `compress-pdf` | WRONG CONTRACT | Real quality presets via Ghostscript; honest client fallback | 4 + 5 | Compressed PDF with size report |
| `word-to-pdf` | DEPENDENCY | LibreOffice wrapper + fixtures + capability gate | 5 | DOCX/DOC → PDF |
| `excel-to-pdf` | DEPENDENCY | LibreOffice wrapper + fixtures + capability gate | 5 | XLSX/XLS → PDF |
| `powerpoint-to-pdf` | DEPENDENCY | LibreOffice wrapper + fixtures + capability gate | 5 | PPTX/PPT → PDF |
| `pdf-to-word` | DEPENDENCY | Office engine hardening | 5 | DOCX |
| `pdf-to-excel` | DEPENDENCY | Office engine hardening + table limits | 5 | XLSX |
| `pdf-to-powerpoint` | DEPENDENCY | Office engine hardening | 5 | PPTX |
| `pdf-to-markdown` | AI-DEPENDENT, IN SCOPE | Decide retention; key probe + cost cap if retained | 0 + 5 | Markdown |
| `pdf-to-pdfa` | DEPENDENCY | LibreOffice PDF/A filter + validation | 5 | PDF/A |
| `repair-pdf` | DEPENDENCY | mutool fallback chain + output validation | 5 | Repaired PDF |
| `compare-pdf` | BROKEN (renderer) | Self-host cMap/standard fonts, fix error reporting, add fixtures | 1 + 2 | Visual diff with real errors |
| `edit-pdf` | RENDERER RISK | Regression-test after renderer fix | 1 + 2 | Edited PDF |
| `redact-pdf` | RENDERER RISK | Regression-test after renderer fix | 1 + 2 | Redacted PDF |
| `sign-pdf` | RENDERER RISK | Regression-test after renderer fix | 1 + 2 | Signed PDF |
| `merge-pdf` | OK | Regression test only | 1 | Merged PDF |
| `rotate-pdf` | OK | Regression test only | 1 | Rotated PDF |
| `crop-pdf` | OK | Regression test only | 1 | Cropped PDF |
| `watermark-pdf` | OK | Regression test only | 1 | Watermarked PDF |
| `pdf-forms` | OK | Regression test only | 1 | Filled PDF form |
| `unlock-pdf` | OK | Regression test only | 1 | Unlocked PDF |

---

## 9. Test strategy

### 9.1 Automated

| Layer | Test |
|---|---|
| Registry | Every `ready` tool has a handler, capability list and output contract. |
| Config | Every config key emitted by UI is consumed by worker/backend. |
| Worker | Fixture-based processing for all client tools. |
| Renderer | `compare-pdf`, `edit-pdf`, `redact-pdf` and `sign-pdf` fixtures using standard-font PDFs; assert no font/cMap fetch failures. |
| Backend | Engine wrapper unit tests with small fixtures. |
| API | Presign, enqueue, SSE, download, ownership and rate-limit tests. |
| Security | Magic-byte validation, path traversal, SSRF, password logging, zip bombs. |
| Durability | Kill backend mid-job; job resumes after restart once BullMQ is live. |
| CI | Contract + client + backend tests run in `verify.yml`. |

### 9.2 Manual matrix

Run on desktop Chrome and a 4× CPU-throttled mobile profile:

| Route | Checks |
|---|---|
| `/tools/merge-pdf` | Multi-file merge, ordering, output opens. |
| `/tools/compare-pdf` | Two standard-font PDFs compare successfully; encrypted/corrupt inputs show specific errors. |
| `/tools/sign-pdf`, `/tools/redact-pdf`, `/tools/edit-pdf` | Standard-font PDFs render without font/cMap failures. |
| `/tools/jpg-to-pdf` | A4 and auto page sizes produce correct page dimensions. |
| `/tools/pdf-to-jpg` | Multi-page PDF produces ZIP with one JPG per page. |
| `/tools/split-pdf` | Range and each-page modes. |
| `/tools/page-numbers` | All six positions. |
| `/tools/organize-pdf` | Reorder, delete, duplicate. |
| `/tools/protect-pdf` | Password required, wrong password rejected. |
| `/tools/html-to-pdf` | HTML upload and URL mode; SSRF cases rejected. |
| `/tools/compress-pdf` | Quality presets change output size. |
| `/tools/word-to-pdf`, `/tools/excel-to-pdf`, `/tools/powerpoint-to-pdf` | Complex fixture conversions. |
| `/tools/pdf-to-word`, `/tools/pdf-to-excel`, `/tools/pdf-to-powerpoint` | Tables/images preserved where supported. |
| `/tools/pdf-to-pdfa`, `/tools/repair-pdf` | Output validates with a PDF validator. |

### 9.3 Failure-path checks

- Missing capability shows “unavailable” before upload.
- Bad magic bytes rejected.
- Job timeout emits structured error.
- Backend restart does not lose accepted job once Phase 6 ships.
- R2 objects removed after TTL.
- No secrets, passwords or file bytes in logs.

---

## 10. Definition of done

The tools work is done when:

1. No `ready` tool lacks a handler, capability declaration or smoke fixture.
2. All 27 in-scope tools have a single documented behaviour matching catalogue, UI and implementation.
3. `protect-pdf` completes through the normal queue path.
4. `compare-pdf` works on standard-font PDFs and shows accurate errors for encrypted/corrupt inputs; `edit-pdf`, `redact-pdf`, `sign-pdf` and `ActionPanel` pass the same renderer fixtures.
5. All in-scope client tools have fixture-based tests.
6. All in-scope server tools have capability gates, timeouts, structured errors and fixture tests.
7. `pdf-to-markdown` decision from Phase 0 is implemented and documented; the Gemini model is configurable and not a hard-coded preview.
8. Google OAuth env variables are verified present on VM 1 and a real sign-in succeeds.
9. M1/M2 acceptance does **not** require the durable queue; M3/GA acceptance requires tool uploads magic-byte validated after R2 download, rate limits and job ownership surviving backend restart, and R2 input/output TTL enforced and swept.
10. `/g2p/health` reports tool capabilities and unavailable slugs.
11. Every tool can be independently disabled by flag.
12. CI enforces the registry contract on every PR.
13. Manual verification matrix passes on desktop and throttled mobile.

---

## 11. Risks and decisions required

| Risk / decision | Recommendation |
|---|---|
| Visual organizer changes a tool page UI | Allowed; global theme stays untouched. Confirm product owner approval. |
| Ghostscript adds a system dependency | Required for real compression; add to Docker image and capability gate. |
| URL-to-PDF creates SSRF risk | Backend must fetch with private-IP blocking and response-size limits. Never let the browser fetch arbitrary URLs into the PDF renderer without checks. |
| `pdf-to-markdown` depends on Gemini | Decide in Phase 0 whether to keep in this plan or defer with AI tools. If kept, make `GEMINI_MODEL` configurable. `gemini-3-flash-preview` is valid but preview; do not “fix” it to `gemini-2.0-flash`. |
| Shared PDF renderer failure affects multiple tools | Fix once in `pdfRender.ts` and self-host cMap/standard-font assets; do not patch each tool separately. |
| Durable queue is a larger migration | Keep it as M3/GA gate. Do not block current user-facing tool fixes on it while production remains single-backend. |
| LibreOffice is memory-heavy | Concurrency 1–2, timeouts, per-job profile, queue backpressure. |
| Existing users may depend on current `fitToPage` behaviour | Migrate config key with backward-compatible mapping and announce the corrected behaviour. |
| Existing local environment lacks binaries | Use the container for engine smoke tests; local failures must be classified as capability failures, not code failures. |

---

## 12. File index

### Frontend

- `frontend/src/lib/pdfTools.ts` — catalogue and source-of-truth candidate.
- `frontend/src/app/tools/[slug]/page.tsx` — tool routing and config map.
- `frontend/src/components/PdfToolShell.tsx` — shared upload shell and post-processing actions.
- `frontend/src/hooks/useToolProcessor.ts` — client/server dispatch and SSE handling.
- `frontend/public/workers/pdf-processor.js` — client worker handlers.
- `frontend/src/lib/pdfRender.ts` — shared PDF.js renderer; cMap/standard-font configuration point.
- `frontend/src/components/tools/configs/*` — per-tool config UIs.
- `frontend/src/components/tools/PdfEditorUI.tsx` — custom edit tool.
- `frontend/src/components/tools/PdfFormsUI.tsx` — custom forms tool.
- `frontend/src/components/tools/RedactPdfUI.tsx` — custom redact tool.
- `frontend/src/components/tools/ComparePdfUI.tsx` — custom compare tool.
- `frontend/src/components/tools/SignPdfUI.tsx` — custom sign tool.

### Backend

- `backend/g2p/routes/tools.js` — presign, enqueue, sync protect, SSE/download ownership.
- `backend/g2p/workers/bullmq-mock.js` — current in-memory dispatcher.
- `backend/g2p/workers/engines/libreoffice.js` — document conversion and PDF/A.
- `backend/g2p/workers/engines/puppeteer.js` — HTML to PDF.
- `backend/g2p/workers/engines/office.js` — PDF to Word/Excel/PowerPoint.
- `backend/g2p/workers/engines/mutool.js` — PDF repair.
- `backend/g2p/workers/engines/ai.js` — Gemini engine used by `pdf-to-markdown`.
- `backend/g2p/workers/engines/tesseract.js` — currently dead code.
- `backend/Dockerfile` — system binaries and Chromium configuration.
- `backend/lib/r2.js` — R2 presign/get helpers.

### Adjacent deployment files (outside tools scope)

- `frontend/src/auth.ts` — Google OAuth provider configuration.
- `docker-compose.frontend.yml` — VM 1 frontend env file wiring.
- `.env.frontend` on VM 1 — must contain `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; never commit values.

### Docs and CI

- `docs/CONFIGURATION.md` — current runtime constraints and known technical debt.
- `.github/workflows/verify.yml` — non-deploying CI quality gate.
- `knowledge/v4.0_tools_platform_plan.md` — historical target architecture.
- `knowledge/v4.0_tools_integration_plan.md` — historical integration notes.

---

## 13. Review validation notes

The external review was checked against the repository and current vendor documentation:

| Review claim | Verdict | Action taken |
|---|---|---|
| `compare-pdf` is broken, not OK | **Accepted.** Live symptom plus code evidence: `pdfRender.ts` lacks cMap/standard-font URLs and `ComparePdfUI` has an empty `catch`. | Added to hard-failure list, work packages, tests, manual matrix and M1. |
| `gemini-3-flash-preview` does not exist | **Rejected.** Google's model docs list `gemini-3-flash-preview` as a valid preview model. The recommended `gemini-2.0-flash` is older and has sunset notices; current stable targets are `gemini-3.6-flash` / newer. | Kept AI-category tools out of scope, but changed the shared engine requirement to configurable `GEMINI_MODEL` with a stable default. |
| Phase 6 queue rewrite is premature | **Accepted.** Production is single-backend today; in-memory job state is functional in that topology. | Demoted Phase 6 to Milestone 3 / GA gate and added explicit sequencing. |
| Google OAuth env missing on VM 1 | **Partially accepted.** Code path and compose wiring are confirmed; remote `.env.frontend` cannot be inspected from this workspace. | Added as adjacent P0 infra item with deployment-side verification/provisioning, no secret values in repo. |
| GitHub Actions `Verify` failure | **Accepted as already resolved.** Current `verify.yml` uses `npm install --prefix frontend` and no push trigger. | Recorded as resolved; no work item. |

Sources checked: `frontend/src/lib/pdfRender.ts`, `frontend/src/components/tools/ComparePdfUI.tsx`, `frontend/node_modules/pdfjs-dist/`, `backend/g2p/workers/engines/ai.js`, `frontend/src/auth.ts`, `docker-compose.frontend.yml`, `.github/workflows/verify.yml`, and Google AI model documentation for `gemini-3-flash-preview`, `gemini-3.5-flash` and `gemini-3.6-flash`.
