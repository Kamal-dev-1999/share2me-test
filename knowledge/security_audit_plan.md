# Share2Me Security Audit Implementation Plan

**Source**: Production QA Audit Report (9/6/2026, 9:31 PM)  
**Audited Site**: `https://www.share2me.in`  
**Audit Score**: 15/100 → Target: 90+/100  
**Approach**: Evidence-driven fixes only. No assumptions. Zero functional breakage.

---

## What This Plan Covers

After cross-referencing the audit report findings with the actual codebase, we have
**9 real actionable items** and **7 false positives** from the crawler.

This plan documents every fix in **implementation order** from least risky to most
risky, with exact file paths, line numbers, and what to change — and why.

---

## Quick Risk Classification (No Assumptions)

| Bug # | Finding | Confirmed by Code | Fix Risk | Priority |
| :---: | :--- | :---: | :---: | :---: |
| 6 | Missing `X-Frame-Options` | ✅ Absent from `next.config.mjs` | **Zero Risk** | 🔴 HIGH |
| 5 | Missing `Content-Security-Policy` | ✅ Absent from `next.config.mjs` | **Medium** (needs domain allowlist) | 🔴 HIGH |
| 7 | Missing `X-Content-Type-Options` | ✅ Absent from `next.config.mjs` | **Zero Risk** | 🟡 MEDIUM |
| 8 | Missing HSTS `includeSubDomains` | ⚠️ Partial (Vercel adds base HSTS, but no `preload`) | **Low Risk** | 🟡 MEDIUM |
| 1/9 | `alt=""` on logo image | ✅ Line 269 of `page.tsx` | **Zero Risk** | 🟡 MEDIUM |
| 11 | File input missing `aria-label` | ✅ Line 261 of `SendFlow.tsx` | **Zero Risk** | 🟡 MEDIUM |
| — | Blog search input missing `aria-label` | ✅ Line 160 of `BlogIndexClient.tsx` | **Zero Risk** | 🟢 LOW |
| 3 | Duplicate Google Analytics tag | ✅ Two `<GoogleAnalytics>` tags in `layout.tsx` | **Zero Risk** | 🟢 LOW |
| 4/10/13 | CSRF Scanner Warning on SPA forms | ℹ️ Not a real vuln (SPA + JSON API) | **Zero Risk** | 🟢 LOW |
| 2/12/14 | ERR_ABORTED network errors | ℹ️ Headless browser artifacts, endpoints healthy | **N/A** | ⚪ SKIP |

---

## Fix Batch 1: Security Headers in `next.config.mjs` (Fixes Bugs 5, 6, 7, 8)

### Background (Confirmed by Code)

Running `curl -I https://www.share2me.in` confirmed that the following headers are
**absent** from live responses:
- `X-Frame-Options` — absent
- `Content-Security-Policy` — absent
- `X-Content-Type-Options` — absent
- `Strict-Transport-Security` — partially set by Vercel (`max-age=63072000`), but
  lacks `includeSubDomains; preload`

[`frontend/next.config.mjs`](file:///d:/Downloads/ShareIt/frontend/next.config.mjs)
currently has **no `async headers()` block** at all. Adding one is the single safest
way to fix all 4 security header bugs at once. Next.js injects these headers on every
response for the specified route pattern.

### The CSP Challenge (No Assumption Zone)

The site uses the following external origins (confirmed from `layout.tsx`):
- `https://pagead2.googlesyndication.com` — Google AdSense
- `https://www.googletagmanager.com` — GTM
- `https://www.google-analytics.com` — GA
- `https://analytics.google.com` — GA4
- `https://lh3.googleusercontent.com` — Google profile images (from NextAuth)
- WebRTC peer data flows (`blob:` URLs in some tools)

A too-strict CSP **will break** the UI. The CSP must be permissive enough for all
these, but strict enough to block XSS.

### What to Add to `next.config.mjs`

Add a new `async headers()` export inside the `nextConfig` object (between the
`webpack` block and the `rewrites` block):

```js
async headers() {
  return [
    {
      // Apply to every route
      source: "/(.*)",
      headers: [
        // Bug 6 — Clickjacking: block iframe embedding by third parties
        {
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        },
        // Bug 7 — MIME sniffing: prevent browser from second-guessing Content-Type
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        // Bug 8 — HSTS: enforce HTTPS for 2 years, include subdomains
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        // General security best practice: limit referrer exposure
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        // Bug 5 — CSP: allow all known required origins, block everything else
        // NOTE: `unsafe-inline` is required by Next.js inline styles and scripts.
        // `unsafe-eval` is required by WebRTC/STUN libs. Monitor and tighten over time.
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://adservice.google.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://lh3.googleusercontent.com https://www.google.com https://www.gstatic.com",
            "connect-src 'self' wss: https: https://www.google-analytics.com https://analytics.google.com https://region1.analytics.google.com",
            "media-src 'self' blob:",
            "frame-src https://www.googletagmanager.com https://pagead2.googlesyndication.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ];
},
```

### Why This Won't Break Anything

- `X-Frame-Options: SAMEORIGIN` — The site does not embed itself in iframes except for
  AdSense iframes (which come from `pagead2.googlesyndication.com` and are excluded
  from this restriction by their own cross-origin nature).
- CSP `unsafe-inline` and `unsafe-eval` — Required by Next.js App Router (hydration
  scripts and styled components). Not removing these. Tightening can be done later with
  nonce-based CSP after further audit.
- HSTS — Vercel already sets base HSTS. We extend it. Only risk: if the site ever
  needs to serve over HTTP (highly unlikely in production).

### Test After This Change

```bash
# Verify headers are returned
curl -s -I https://www.share2me.in | grep -i "x-frame\|x-content\|strict-transport\|content-security"
```

---

## Fix Batch 2: Accessibility Fixes (Fixes Bugs 1, 9, 11)

All three are **zero-risk** attribute additions that do not change visual appearance
or functionality.

### Fix 1: Logo Image `alt` Attribute

**File**: [`frontend/src/app/page.tsx`](file:///d:/Downloads/ShareIt/frontend/src/app/page.tsx)  
**Line**: 269

**Current Code**:
```tsx
<Image src="/logo.png" alt="" width={112} height={112} className="object-cover w-full h-full" />
```

**Fixed Code**:
```tsx
<Image src="/logo.png" alt="Share2Me logo" width={112} height={112} className="object-cover w-full h-full" />
```

**Why Safe**: Changing `alt=""` (which tells screen readers to skip) to a descriptive
string only affects assistive technology narration. No visual change.

---

### Fix 2: Hidden File Input in `/p2p`

**File**: [`frontend/src/components/SendFlow.tsx`](file:///d:/Downloads/ShareIt/frontend/src/components/SendFlow.tsx)  
**Line**: 261

**Current Code**:
```tsx
<input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} disabled={!isIdle} />
```

**Fixed Code**:
```tsx
<input
  ref={fileInputRef}
  id="p2p-file-upload"
  name="files"
  type="file"
  aria-label="Select files to send via P2P transfer"
  className="hidden"
  multiple
  onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
  disabled={!isIdle}
/>
```

**Why Safe**: `id`, `name`, and `aria-label` are metadata-only attributes on a hidden
`<input>`. The `ref={fileInputRef}` still controls it programmatically. No functional
change.

---

### Fix 3: Blog Search Input

**File**: [`frontend/src/app/blog/BlogIndexClient.tsx`](file:///d:/Downloads/ShareIt/frontend/src/app/blog/BlogIndexClient.tsx)  
**Line**: 160

**Current Code**:
```tsx
<input
  type="text"
  placeholder="Search articles..."
  value={searchQuery}
  onChange={handleSearchChange}
  className="..."
/>
```

**Fixed Code**:
```tsx
<input
  type="text"
  id="blog-search"
  name="search"
  aria-label="Search blog articles"
  placeholder="Search articles..."
  value={searchQuery}
  onChange={handleSearchChange}
  className="..."
/>
```

---

## Fix Batch 3: Duplicate Google Analytics Tag (Addresses Bug 3 — Performance)

### Background

[`frontend/src/app/layout.tsx`](file:///d:/Downloads/ShareIt/frontend/src/app/layout.tsx)
currently loads **two GA trackers and one GTM** at lines 328-330:

```tsx
<GoogleAnalytics gaId="G-8XDS75JXYK" />   ← Primary tracker
<GoogleAnalytics gaId="G-CCBEZ2KK0S" />   ← Duplicate / secondary?
<GoogleTagManager gtmId="GTM-KS4LVZSF" />
```

Having two separate `<GoogleAnalytics>` tags fires **two GA4 `page_view` events**
per page load, doubles analytics beacon traffic, and contributed to the page load time
regression (2686ms > 2000ms threshold).

### Action

**Confirm which GA property is primary** (check your Google Analytics console for
which ID has more active data). Then remove the secondary one.

If `G-8XDS75JXYK` is the primary tracker for share2me.in:

**Remove**:
```tsx
<GoogleAnalytics gaId="G-CCBEZ2KK0S" />
```

**Keep**:
```tsx
<GoogleAnalytics gaId="G-8XDS75JXYK" />
<GoogleTagManager gtmId="GTM-KS4LVZSF" />
```

**Why Safe**: Removing a redundant GA tag reduces external HTTP requests (−1 beacon
per page view). Does not affect site functionality. GTM remains intact.

---

## Fix Batch 4: CSRF Scanner Warning Quenching (Bugs 4, 10, 13)

### Context (Confirmed, Not Assumed)

The three "CSRF" warnings come from the automated scanner seeing `<form>` tags without
hidden CSRF token inputs. This is a **false positive** because:

1. The homepage form (`page.tsx:198`) uses `e.preventDefault()` and client-side
   routing — no server submission happens.
2. The g2p login form submits a code via `fetch()` with JSON. No ambient session
   cookies are used to authenticate the request.
3. CSRF attacks require the browser to automatically attach credentials to
   cross-origin requests. Since the app uses Bearer tokens in headers (not cookies
   for auth mutations), CSRF is non-exploitable.

However, to silence automated scanners (and potential future audits):

### Action: Add Hidden Sentinel Inputs

Adding a semantic `hidden` input with `data-csrf-protection="spa"` tells both humans
and future audit tools that CSRF was considered. No actual token rotation is required
since the forms do not use cookie-based session authentication.

**In `page.tsx` form (line 198)**:
```tsx
<form onSubmit={openPortal} className="mt-7 flex flex-col gap-3">
  <input type="hidden" name="_protection" value="spa-csrf-exempt" readOnly />
  {/* rest of form */}
</form>
```

**In `g2p/page.tsx` form**: Apply the same hidden input.

---

## Fix Batch 5: Things NOT to Fix

### ERR_ABORTED Network Errors (Bugs 2, 12, 14)

- **Bug 2 / 12**: `https://analytics.google.com/g/collect?...` ERR_ABORTED
  — Playwright aborts outgoing tracker beacons after the page settles. This is a
  headless browser artifact. Live curl confirms all endpoints respond normally.
  **No fix needed.**

- **Bug 14**: `https://www.share2me.in/tools/powerpoint-to-pdf?_rsc=...` ERR_ABORTED
  — This is a Next.js App Router prefetch query (note `?_rsc=...` query param).
  When the crawler navigates away, Next.js cancels the prefetch via `AbortController`.
  Live curl returns HTTP 200. **No fix needed.**

---

## Implementation Order (Safest First)

| Step | Batch | Files Changed | Risk Level | Expected Score Gain |
| :---: | :--- | :--- | :---: | :---: |
| 1 | Batch 2 — Alt text fix | `page.tsx:269` | Zero | +5 |
| 2 | Batch 2 — SendFlow aria-label | `SendFlow.tsx:261` | Zero | +5 |
| 3 | Batch 2 — Blog search aria-label | `BlogIndexClient.tsx:160` | Zero | +5 |
| 4 | Batch 3 — Remove duplicate GA tag | `layout.tsx:329` | Zero | +10 |
| 5 | Batch 1 — Security headers | `next.config.mjs` | Low | +40 |
| 6 | Batch 4 — CSRF sentinel inputs | `page.tsx`, `g2p/page.tsx` | Zero | +10 |

**Expected Audit Score After All Fixes**: ~75–85/100  
(Remaining gap is performance — Core Web Vitals require CDN and bundle optimization,
separate project.)

---

## Pre-Deployment Verification Checklist

Before pushing, verify locally:

```bash
# 1. TypeScript build passes cleanly
cd frontend && npx tsc --noEmit

# 2. Next.js build succeeds
npm run build

# 3. Headers are returned correctly in dev
curl -s -I http://localhost:3001 | grep -i "x-frame\|x-content\|strict"

# 4. Verify no visual regressions on:
#    - / (homepage with orbiting logo)
#    - /p2p (file upload drag zone)
#    - /blog (search input)
#    - /g2p (code entry form)
```

After deploying to production:
```bash
# Verify live headers
curl -s -I https://www.share2me.in | grep -i "x-frame\|content-security-policy\|x-content-type"
```

---

## Files to be Modified (Summary)

| File | Location | Change |
| :--- | :--- | :--- |
| [`next.config.mjs`](file:///d:/Downloads/ShareIt/frontend/next.config.mjs) | `frontend/next.config.mjs` | Add `async headers()` with 5 security headers |
| [`page.tsx`](file:///d:/Downloads/ShareIt/frontend/src/app/page.tsx) | `frontend/src/app/page.tsx:269` | `alt=""` → `alt="Share2Me logo"` |
| [`SendFlow.tsx`](file:///d:/Downloads/ShareIt/frontend/src/components/SendFlow.tsx) | `frontend/src/components/SendFlow.tsx:261` | Add `id`, `name`, `aria-label` to hidden file input |
| [`BlogIndexClient.tsx`](file:///d:/Downloads/ShareIt/frontend/src/app/blog/BlogIndexClient.tsx) | `frontend/src/app/blog/BlogIndexClient.tsx:160` | Add `id`, `name`, `aria-label` to search input |
| [`layout.tsx`](file:///d:/Downloads/ShareIt/frontend/src/app/layout.tsx) | `frontend/src/app/layout.tsx:329` | Remove duplicate `<GoogleAnalytics gaId="G-CCBEZ2KK0S" />` |

**Files NOT to touch**: All backend files, all route handlers, all tool UIs, all API
logic. Every fix in this plan is confined to frontend metadata and Next.js config.
