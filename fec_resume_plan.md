# Implementation Plan: XOR FEC + OPFS Partial Resume

## Feature 1 — XOR Forward Error Correction (FEC)

### What it does
For every **K data chunks**, the sender computes one **XOR parity chunk**.
If any single chunk in a group is lost in transit, the receiver reconstructs
it instantly from the parity — no NACK round-trip needed.

```
K=8 data chunks: [A][B][C][D][E][F][G][H]
parity chunk P:   A⊕B⊕C⊕D⊕E⊕F⊕G⊕H

If D is lost:     D = A⊕B⊕C⊕E⊕F⊕G⊕H⊕P   ← instant, no re-send
```

Overhead: 1 parity per 8 data chunks = ~12.5% more chunks sent.

> **Scope**: 2+ losses in the same group still fall back to the existing NACK retry. FEC and NACK coexist — FEC handles 1-loss groups silently, NACK handles the rest.

---

### Files changed (FEC)

| File | Change |
|---|---|
| `frontend/public/worker.js` | After encrypting all chunks, generate XOR parity chunks and post them |
| `frontend/src/hooks/useTransfer.ts` | Track parity chunks separately; attempt FEC recovery before NACK; include `fecGroupSize` in metadata |
| `frontend/src/components/SendFlow.tsx` | Minor: show "X data + Y parity chunks" in metadata panel |

### Protocol changes (FEC)

Metadata gains:
```json
{ "fecGroupSize": 8 }
```

Parity chunks use `seq` = `totalDataChunks + groupIndex`, flagged with `"isParity": true`:
```json
{ "seq": 850, "total": 900, "isParity": true, "group": 3, "data": "...", "iv": "..." }
```

### Sender flow (FEC)
```
prepareSenderTransfer:
  1. Encrypt all N data chunks (existing logic, unchanged)
  2. For each group of K chunks:
     a. XOR their plaintext together → parity plaintext
     b. Encrypt parity plaintext with same AES key → parity chunk
     c. Assign seq = N + groupIndex, isParity: true
  3. Post all N data chunks + ceil(N/K) parity chunks
  4. Include fecGroupSize: K in senderMetadata
```

### Receiver flow (FEC)
```
On done received:
  1. Find all missing data seq numbers
  2. For each group with exactly 1 missing chunk:
     a. Find its parity chunk (if received)
     b. XOR all other group members + parity → recover missing chunk
     c. Mark as recovered, remove from missing list
  3. Remaining missing → NACK as before
```

---

## Feature 2 — OPFS Partial Resume

### What it does
If the receiver's page reloads mid-transfer (crash, accidental refresh), and
the **same sender is still online**, the receiver reconnects and only downloads
the missing chunks. Already-received and decrypted chunks are retrieved from
OPFS/IndexedDB instead.

```
Without resume: 80% received → reload → re-download 100%
With resume:    80% received → reload → re-download only 20%
```

> **Resume key = SHA-256 hash of file content** (already computed by sender in `worker.js` as `h`).
> This is stable across sessions for the same file regardless of OTC.

---

### Files changed (Resume)

| File | Change |
|---|---|
| `frontend/public/storage.js` | Add `saveResumeManifest`, `getResumeManifest`, `clearResumeManifest`, `saveDecryptedChunk`, `getDecryptedChunk` |
| `frontend/public/worker.js` | After decrypting each chunk, post it to main thread immediately (already does this); no change needed |
| `frontend/src/hooks/useTransfer.ts` | After importing metadata: check OPFS for existing manifest; emit `resume_request` with already-held seqs; on assembly use stored chunks |
| `backend/server.js` | Add `resume_request` relay event (same pattern as `nack`) |
| `frontend/src/components/ReceiveFlow.tsx` | Show "Resuming — X/Y chunks already saved" badge when resume is detected |

### New storage schema (Resume)

```
OPFS / IDB:
  Existing:  {transferId}_{side}_{seq}.bin    ← encrypted chunks (current)
  New:       resume_{fileHash}_{seq}.bin      ← decrypted plaintext chunks
  New:       resume_{fileHash}.manifest.json  ← { fileHash, total, receivedSeqs[], ts }
```

Decrypted chunks are stored under `resume_{fileHash}` so they survive a page
reload and remain accessible in the next session even with a new OTC/key.

### Sender flow (Resume)
```
startWebRtcSend:
  1. Receiver may send resume_request: { fileHash, haveSeqs: [0,1,2,...799] }
  2. Sender receives resume_request via socket
  3. Sender skips those seqs when streaming chunks
  4. Sender still sends done signal with total count
```

### Receiver flow (Resume)
```
importMetadata (called after receiver joins room):
  1. Check OPFS for resume_{fileHash}.manifest.json
  2. If found AND total matches:
     a. Load haveSeqs list
     b. Show "Resuming: 800/1000 chunks already saved"
     c. Emit resume_request: { otc, fileHash, haveSeqs } via socket
  3. On chunk received: save decrypted plaintext to resume_{fileHash}_{seq}.bin
     AND update manifest
  4. On assembly:
     a. For each seq 0..total-1:
        - If in haveSeqs: read from resume store
        - Otherwise: read from regular chunk store (newly received)
     b. Concatenate → blob → download
  5. On successful assembly: clear resume manifest for this fileHash
```

### New socket event (Resume)

```
resume_request: { otc, fileHash, haveSeqs: number[] }
  → relayed by server to sender (same pattern as nack)
```

---

## Implementation Order

1. **FEC first** (self-contained, no protocol breaking changes)
   - `worker.js` XOR parity generation
   - `useTransfer.ts` parity tracking + FEC recovery
   - Build check → test → commit

2. **OPFS Resume second** (requires storage + server + hook changes)
   - `storage.js` resume functions
   - `server.js` resume_request relay
   - `useTransfer.ts` resume check + assembly change
   - `ReceiveFlow.tsx` resume badge
   - Build check → test → commit

---

## What stays unchanged
- AES-GCM-256 encryption pipeline (FEC operates on plaintext before encryption)
- ECDH key exchange
- WebRTC DataChannel transport
- NACK retry (still the fallback after FEC recovery)
- Text transfer mode (both features apply equally to text chunks)
- QR / OTC flow

---

## Risk / Notes

| Risk | Mitigation |
|---|---|
| FEC parity chunk lost too | Falls back to NACK — no worse than today |
| Resume manifest out of sync with actual OPFS files | Verify each seq in manifest has a file before trusting it |
| Resume with different file same hash (SHA-256 collision) | Astronomically unlikely; resume validates total chunk count too |
| OPFS not available (some browsers) | IDB fallback already in storage.js; resume works identically on IDB |
| Sender disconnects before resume completes | Normal error handling (phase → error); manifest kept for next attempt |
