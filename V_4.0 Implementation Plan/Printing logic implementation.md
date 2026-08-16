# Print Shop — Industry-Grade Redesign Plan

## Background & Current State

The codebase already has strong foundations: the backend `printshop.js` route correctly handles server-side price recalculation, concurrency-safe DB transactions, Razorpay order creation, and Socket.IO real-time push. The frontend `PrintFlow.tsx` has a working 4-step wizard, and `PrintShopPanel.tsx` has the dashboard skeleton.

The fundamental problems are:

1. **Mode detection is wrong** — `g2p/[code]/page.tsx` detects "print mode" by checking if `qrUrl` is set. It should check `persona === 'PRINT_SHOP'` from the public shop API instead.
2. **Settings don't persist state visually** — Bank details are in the DB but the UI doesn't hydrate from them correctly to show "Connected".
3. **Settings should auto-generate a permanent QR** — Once a vendor saves pricing, a personal payment QR (with their UPI ID or Razorpay link) should be generated automatically, not manually uploaded.
4. **Student payment UX is broken** — The "Pay online" button shows Stripe references. The Razorpay modal opens but the "disabled" condition still checks `stripeChargesEnabled` instead of `charges_enabled`.
5. **Vendor dashboard has no print job management** — No status tracking ("printed" / "ready for pickup"), no inline payment confirmation, no job detail drawer.
6. **No print configuration in the student flow** — Students cannot specify copies, double-sided, stapling, etc.

---

## Open Questions

> [!IMPORTANT]
> **QR Code Generation**: Razorpay provides a built-in "Payment Links" or "QR Codes" API to auto-generate a permanent QR that collects payment to the vendor's account. This is the correct approach. However, since vendors don't have a live `acc_` ID yet (only `pending_kyc_...`), the QR should be generated using the **platform's Razorpay account** with the vendor's `share2me_id` as a note for manual reconciliation. Do you want this approach, or would you prefer vendors enter their own UPI ID (e.g., `kamal@upi`) and we generate a QR from that?

> [!IMPORTANT]
> **Print Configurations**: Should students be able to configure copies, double-sided, stapling, paper size (A4/A3) etc. from the UI? Or is this always decided at the counter?

---

## Proposed Changes

### Architecture Overview

```
Student visits /g2p/[code]
    │
    ├─ Backend: GET /printshop/shop/:code
    │    Returns: { persona, shopName, bwPrice, colorPrice, isAccepting, qrUrl, charges_enabled, razorpay_account_id }
    │
    ├─ IF persona === 'PRINT_SHOP'  →  show PrintFlow (4-step wizard)
    └─ ELSE                         →  show standard G2P file transfer form
```

---

### Phase 1 — Fix Mode Detection & Student Flow

#### [MODIFY] [`g2p/[code]/page.tsx`](file:///d:/Downloads/ShareIt/frontend/src/app/g2p/%5Bcode%5D/page.tsx)
- Change print mode detection from `!!settings.qrUrl` to `settings.isPrintShop === true`
- The `GET /printshop/shop/:code` backend will return a new `isPrintShop: true` field when the vendor persona is `PRINT_SHOP`
- If not a print shop, render the existing plain file transfer form

#### [MODIFY] [`PrintFlow.tsx`](file:///d:/Downloads/ShareIt/frontend/src/components/printshop/PrintFlow.tsx)

**Step 3 (Payment) fixes:**
- Change the "Pay online" disabled condition from `stripeChargesEnabled` → `charges_enabled`
- Remove all "Stripe" references from UI copy; replace with "Razorpay"
- The UPI QR image from `settings.qrUrl` should be shown on-screen for the "online" option so the student can scan and pay directly without waiting for the vendor
- When the student selects "Pay online", show the Razorpay modal immediately (not just a description card)

**New: Print Configuration step (optional, between Step 2 and Step 3):**
- Copies (1–20)
- Double-sided toggle (saves 50% pages)
- Stapling toggle
- Paper size: A4 (default) / A3
- These are sent as `printConfig: { copies, doubleSided, stapling, paperSize }` to `POST /jobs`

---

### Phase 2 — Settings: Bank → Auto-Generate QR

#### [MODIFY] [`PrintingSettings.tsx`](file:///d:/Downloads/ShareIt/frontend/src/components/printshop/PrintingSettings.tsx)

**Current flow (broken):**
```
Vendor enters bank details → POST /billing/connect → charges_enabled = true
But QR is never generated. Vendor must separately upload a QR image.
```

**New flow:**
```
Vendor enters UPI ID (e.g. kamal@ybl) → POST /billing/connect
Backend:
  1. Saves UPI ID to vendors.upi_id
  2. Calls Razorpay Payment Links API to create a permanent QR link
  3. Stores the QR URL in printshop_settings.payment_qr_url  
  4. Sets charges_enabled = true
Frontend:
  → Shows green "Connected" card with the generated QR embedded
  → QR is a permanent link — never expires
  → Vendor can display this QR at their counter too
```

**UI after connection:**
- Green "Razorpay Connected" header
- Embedded QR code image (from `payment_qr_url`)
- "Download QR" button so vendor can print it out for their counter
- Account number + IFSC masked display (e.g., `••••3954866`)

#### [MODIFY] [`billing.js`](file:///d:/Downloads/ShareIt/backend/g2p/routes/billing.js)
- Replace the fake `pending_kyc_` account ID generation
- Accept `upiId` in request body instead of bank account + IFSC
- Call Razorpay `paymentLink.create()` with a description linking back to the vendor's `share2me_id`
- Store the resulting `short_url` / QR URL in `printshop_settings.payment_qr_url`

#### [MODIFY] [`schema.sql`](file:///d:/Downloads/ShareIt/backend/g2p/schema.sql)
- Add `vendors.upi_id TEXT`
- Add `printshop_settings.payment_qr_url TEXT` (the auto-generated Razorpay QR link URL)

---

### Phase 3 — Vendor Dashboard: Print Jobs Management

#### [MODIFY] [`PrintShopPanel.tsx`](file:///d:/Downloads/ShareIt/frontend/src/components/printshop/PrintShopPanel.tsx)

**Current:** Shows KPI cards + revenue chart + a flat list of "Shared Documents" (regular file transfer requests, not print jobs)

**New: Complete Print Jobs board**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Print Shop                       [Refresh]  [Filter: All / Paid / Pending]│
├─────────────────────────────────────────────────────────────────────┤
│  KPI Row: Total Jobs | Paid | Pending | Revenue | B&W | Color       │
├─────────────────────────────────────────────────────────────────────┤
│  Revenue Chart (recharts AreaChart — daily/weekly/monthly toggle)   │
├─────────────────────────────────────────────────────────────────────┤
│  Print Jobs Table                                                   │
│  ┌──────┬────────────────┬───────┬──────┬──────────┬────────────┐  │
│  │ Name │ Document       │ Pages │ Type │ Amount   │ Status     │  │
│  ├──────┼────────────────┼───────┼──────┼──────────┼────────────┤  │
│  │ Kamal│ thesis.pdf     │  142  │ B&W  │ ₹284     │ ● Pending  │  │
│  │      │                │       │      │          │ [Confirm ✓]│  │
│  │      │                │       │      │          │ [Fail ✗]   │  │
│  ├──────┼────────────────┼───────┼──────┼──────────┼────────────┤  │
│  │ Priya│ slides.pptx    │   18  │ Color│ ₹180     │ ● Paid ✓   │  │
│  └──────┴────────────────┴───────┴──────┴──────────┴────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Job status lifecycle:**
```
pending → printed (vendor clicks "Mark as Printed") → paid (auto on Razorpay verify OR manual "Confirm Cash Received")
        ↘ failed (vendor rejects)
```

**Each job row expands into a drawer/accordion showing:**
- Document name, file type, size
- Pages, print type, copies, double-sided, stapling
- Price breakdown: `18 pages × ₹10 = ₹180`
- Payment method (online / cash)
- Razorpay Payment ID (if paid online)
- Paid at timestamp
- Action buttons: **Mark as Printed** | **Confirm Cash Received** | **Mark as Failed**

#### [MODIFY] [`printshop.js`](file:///d:/Downloads/ShareIt/backend/g2p/routes/printshop.js)

New endpoints needed:
- `PATCH /jobs/:id/print` — vendor marks job as printed (new `printed_at` column)
- Update `POST /shop/:code` public API to return `isPrintShop: true` when persona is `PRINT_SHOP`

Add `printshop_jobs` columns:
- `status TEXT DEFAULT 'queued'` → `'queued'` | `'printed'` | `'cancelled'`
- `print_config JSONB` — stores `{ copies, doubleSided, stapling, paperSize }`
- `printed_at TIMESTAMPTZ`

---

### Phase 4 — Student UX: Reduce Manual Steps

#### Key UX improvements in `PrintFlow.tsx`

1. **Step 3: Show QR on screen immediately** — No need to visit another page. The vendor's QR is embedded right in the payment step. Student scans → pays → marks as paid.

2. **"Pay online" flow (Razorpay modal auto-opens)** — Instead of showing a description card that the student reads and then clicks a separate button, when the student clicks "Pay online", the Razorpay modal opens immediately.

3. **After Razorpay success** — The payment is auto-verified server-side. The student's step 4 screen shows a real-time payment confirmation (green checkmark) that updates via Socket.IO without a page refresh.

4. **Cash flow** — Show the exact amount and the shop's QR so the student can also pay via QR at the counter. The vendor's dashboard updates in real time when they tap "Confirm Cash Received".

5. **"Transfer complete" screen** — Replace the current generic success screen for print shop submissions. Show:
   - Document submitted ✓
   - Total amount: ₹284
   - Payment: Cash at counter / Paid via Razorpay
   - Tracking: `Job #abc123` with a status indicator that updates live

---

### Phase 5 — Sync & Polish

#### Real-time status sync (already partially working)
- Backend emits `printshop:new_job` and `printshop:job_updated` via Socket.IO ✓
- Frontend `useJobs` listens and updates in real time ✓
- **Fix:** Add `printshop:job_printed` event emission when vendor marks as printed

#### Data fetching — cache invalidation
- `apiGet` now uses `cache: 'no-store'` ✓
- Add `staleTime: 0` to any future SWR/React Query usage

---

## Verification Plan

### Automated Checks
- `npx tsc --noEmit` — zero TypeScript errors
- `npm run build` — clean production build

### End-to-End Test Flow
1. **Vendor setup**: Log in as print shop vendor → go to Settings → enter UPI ID → save → green "Connected" card appears with QR → download QR button works
2. **Student sends job**: Visit `/g2p/[shop_code]` → print flow appears (not generic form) → upload PDF → select B&W → configure 2 copies → choose "Pay online" → Razorpay modal auto-opens → complete test payment → step 4 shows green "Paid" with correct amount
3. **Vendor receives**: Dashboard Print Jobs tab shows the new job in real time → expand row → click "Mark as Printed" → status updates to "Printed"
4. **Cash flow**: Student selects "Pay cash" → submits → sees amount owed with shop QR → vendor sees pending job → clicks "Confirm Cash Received" → student's page updates to "Paid" via Socket.IO

---

## File Change Summary

| File | Change Type | Priority |
|------|-------------|----------|
| `backend/g2p/routes/printshop.js` | MODIFY | P0 — Mode detection fix, new PATCH /print endpoint |
| `backend/g2p/routes/billing.js` | MODIFY | P0 — UPI ID + auto-QR generation |
| `backend/g2p/schema.sql` | MODIFY | P0 — Add upi_id, payment_qr_url, print_config, printed_at |
| `frontend/src/app/g2p/[code]/page.tsx` | MODIFY | P0 — Correct mode detection |
| `frontend/src/components/printshop/PrintFlow.tsx` | MODIFY | P0 — Fix disabled check, Razorpay modal, QR display |
| `frontend/src/components/printshop/PrintingSettings.tsx` | MODIFY | P1 — Show QR after connect, UPI ID input |
| `frontend/src/components/printshop/PrintShopPanel.tsx` | MODIFY | P1 — Full job table with actions |
| `frontend/src/lib/printShop.ts` | MODIFY | P0 — Update types for new fields |
