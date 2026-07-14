# G2P Master Build Plan — Honest Technical Review

---

## Verdict Upfront

**The plan is genuinely solid for a v1 and most of it can be built as written.**
The architectural instincts are correct: modular monolith, single deletion code path,
presigned direct-upload, polling for anonymous users, sockets only for authenticated
staff. The phased rollout is sensible. The schema is clean.

But there are **5 real gaps / correctness issues** that will create production bugs
if implemented exactly as written, and a few **concurrency traps** that don't hold
at even moderate load. Flagging all of them honestly below.

---

## ✅ What the Plan Gets Right (Don't Change These)

| Decision | Why it's correct |
|---|---|
| Modular monolith, not microservices | Right call at pilot scale. The boundary is clean enough to extract later. |
| Single `deleteRequest()` code path | Without this you get storage leaks. Good discipline. |
| R2 lifecycle backstop at 2x TTL | Belt-and-suspenders. Exactly right. |
| Cap checks inside a DB transaction | The plan explicitly says "inside a single DB transaction" — this is the only correct way. |
| Server-side `accepting_requests` check on every submission | UI toggles are untrustworthy. Correct. |
| Anonymous students → polling only | Giving anonymous users a socket would add auth surface for zero benefit. Correct call. |
| `file-type` magic-byte check | Catching renamed `.exe` at confirm time is the right defense layer. |
| Reconciliation worker for closed-tab uploads | Elegant reuse of the cleanup worker. Correct. |
| Redis adapter already in stack for multi-instance socket state | Already solved. No extra work needed. |

---

## 🔴 Real Gaps & Correctness Issues

### Issue 1: Race Condition in Cap Check is Acknowledged but Under-Specified

The plan says *"both aggregate checks and the insert must happen inside a single
transaction"* — but this is harder to correctly implement with Postgres than it
sounds. A `COUNT(*) ... + INSERT` transaction at default `READ COMMITTED` isolation
still allows two concurrent requests to both read the same count (say 99), both
pass, and both insert, ending up at 101.

**The fix:** Use `SELECT ... FOR UPDATE` on the vendor row inside the transaction,
or use a Postgres advisory lock keyed on `vendor_id`. This serialises concurrent
submissions from the same vendor without locking the entire table.

```sql
-- Inside the transaction, before the COUNT:
SELECT id FROM vendors WHERE id = $1 FOR UPDATE;
-- Now other transactions for this vendor will queue, not race.
```

This is not optional — a vendor going viral with a class of students submitting
simultaneously will hit this race on day one.

---

### Issue 2: The Download Grace Timer is Not Crash-Safe

The plan proposes starting a 10-minute in-memory `setTimeout` after a vendor
downloads a file. If the ECS container restarts in those 10 minutes, that timer
is gone. The file is downloaded but never deleted — a silent storage leak.

**The fix:** Instead of an in-memory timer, write a `downloaded_at` timestamp to
the DB at download time and let the existing 5-minute cleanup worker handle it:

```js
// In deleteRequest logic, add this condition to the cleanup query:
WHERE status = 'downloaded' AND downloaded_at < NOW() - INTERVAL '10 minutes'
```

The cleanup worker already runs every 5 minutes — it naturally picks this up with
at most a 15-minute lag. No in-memory state, crash-safe, and no extra infrastructure.

---

### Issue 3: Presigned URL Expiry + File Count Collision

The plan sets a presigned URL TTL of ~15 minutes. But the transactional file-count
cap check happens *at presign time*, and the file row is inserted as `pending_upload`
at that point. If a student presigns 10 files, idles for 16 minutes, and then
tries to retry file 3, the retry presign will fail the 10-file cap check because
the 10 `pending_upload` rows are still there even though no actual uploads succeeded.

The reconciliation worker cleans `pending_upload` rows after ~10 minutes, which
helps — but if the worker runs at minute 9 and the student presigned at minute 1,
there's a window where they're blocked. This needs to be explicitly handled:

**The fix:** When `/complete` fails on expiry, the backend should also delete the
stale `pending_upload` file row so the count drops back before issuing a fresh
presigned URL. Alternatively, reconciliation worker interval should be guaranteed
< presigned URL TTL.

---

### Issue 4: Auth.js JWT Verification Coupling

Section 6c says the backend should verify the Auth.js JWT using a shared secret.
This works but there's a subtle production pitfall: **Auth.js signs JWTs with a
secret that can be rotated** (e.g., on redeploy if `AUTH_SECRET` env var changes).
If the backend caches or hard-codes the old secret, all vendor socket connections
break silently until the container restarts.

The plan calls for `AUTH_JWT_SECRET` to be a new env var — this is correct. But
the plan should explicitly document that:
1. `AUTH_SECRET` in the frontend (Next.js) and `AUTH_JWT_SECRET` in the backend
   **must be the same value** and **rotate together**.
2. Add `/g2p/health` to check that token verification is working (not just DB + R2).

Otherwise this will be a mysterious outage when someone rotates secrets.

---

### Issue 5: Socket Namespace Isolation is Stated but Not Enforced

The plan says G2P uses "its own socket namespace" but the reuse example in §6a
shows `io.on('connection', ...)` (the default namespace). If G2P actually uses
`io.of('/g2p')` as a separate namespace (the correct implementation), the existing
`io.use()` connection middleware does NOT apply to it automatically — you have to
register it again on the `/g2p` namespace.

If this is missed, the G2P socket connection bypass rate-limiting and the IP ban list.

**The fix:** Be explicit in the implementation. Either:
- **Option A (simpler):** Don't use a separate namespace. Just prefix all G2P
  events (`g2p:*`) inside the default namespace, like the plan's socket examples
  already show. The middleware automatically applies. Sockets are scoped to
  `vendor:{id}` rooms anyway.
- **Option B (cleaner isolation):** Create `const g2p = io.of('/g2p')` and
  explicitly re-register the middleware: `g2p.use(rateLimitMiddleware)`.

Pick one explicitly in the plan. The current plan implies Option B but shows
Option A code. That inconsistency will create a bug.

---

## 🟡 Concurrency Concerns Worth Knowing

### Cleanup Worker Under Load

The cleanup worker runs `every 5 minutes` using `setInterval`. At low load this is
fine. At moderate load (say, 500 requests expiring simultaneously), a single
`DELETE` on hundreds of R2 objects inside one worker tick will be slow — and if
the worker takes longer than 5 minutes, the next tick starts while the first is
still running (concurrent cleanup workers).

**Mitigation:** Add a guard flag: `let cleanupRunning = false`. If already running,
skip the tick. This is a 2-line fix and prevents the overlap entirely.

```js
let cleanupRunning = false;
setInterval(async () => {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try { await runCleanup(); } finally { cleanupRunning = false; }
}, 5 * 60_000);
```

### Status Poll Rate Limiting

`statusPollLimiter: 3 polls / 10s per IP` is sensible. But consider: a university
where 200 students on the same campus WiFi share one public IP (NAT). They'll all
share a single rate-limit bucket and 3 out of 200 will get rejected immediately.

This is a known hard problem. The plan's mitigation: use `status_token` as the
rate-limit key *instead of IP* for the status poll. The token is already random
and unguessable — rate-limiting on it is both more accurate and more abuse-resistant.

```js
// Instead of:
if (statusPollLimiter.isRateLimited(ip)) ...

// Do:
if (statusPollLimiter.isRateLimited(req.params.status_token)) ...
```

### DOCX Rendering in the Queue

The plan allows DOCX uploads but doesn't address *how the vendor views* a DOCX.
Printing a DOCX requires LibreOffice or similar server-side. This is explicitly
not in scope for MVP (vendor downloads and prints locally), but it should be
written down as a known limitation. If a vendor expects a print preview in the
dashboard and clicks on a DOCX, the current plan gives them a download — which
is actually fine, but users need to know that.

---

## 🟢 Minor Additions Worth Considering (Low Cost)

1. **Index on `requests.vendor_id + expires_at`** — the cleanup worker queries by
   `expires_at` and later filters by `vendor_id`. Adding `(vendor_id, expires_at)`
   as a compound index (in addition to the one on `vendor_id, status`) will make
   that query fast at any reasonable data volume.

2. **Soft-delete pattern is missing** — The schema has `deleted_at` on `requests`
   but deletes cascade on the DB side and rows are physically removed. Decide one:
   either soft-delete (keep row, set `deleted_at`, filter in all queries) or hard-
   delete. The current schema implies both. Pick hard-delete for simplicity since
   GDPR compliance isn't mentioned and audit trails aren't in scope.

3. **`status_token` should be rate-limited against enumeration** — The 128-bit UUID
   is effectively unguessable (2^122 space), so brute-force is not a real threat.
   But document this explicitly so no one replaces it with a sequential ID later.

---

## Summary Table

| # | Issue | Severity | Fix Complexity |
|---|---|---|---|
| 1 | Concurrent cap race (SELECT FOR UPDATE missing) | 🔴 High | Low (1 SQL line) |
| 2 | Download grace timer not crash-safe | 🔴 High | Low (move to cleanup worker) |
| 3 | Presigned URL expiry + pending_upload count collision | 🟡 Medium | Medium |
| 4 | Auth.js JWT secret rotation coupling | 🟡 Medium | Low (documentation + health check) |
| 5 | Namespace middleware isolation not enforced | 🟡 Medium | Low (pick Option A or B explicitly) |
| 6 | Cleanup worker concurrency overlap | 🟡 Medium | Trivial (guard flag) |
| 7 | Status poll rate-limiting on shared IP (NAT) | 🟡 Medium | Low (use token as key) |
