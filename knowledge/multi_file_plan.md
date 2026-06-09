# Share2Me Multi-File Transfer Plan

## Objective
Implement a highly scalable, robust multi-file transfer feature (up to 10 files) without disrupting the currently stable WebRTC pipeline, signaling backend, or AES encryption architecture.

## The Strategy: Client-Side Virtual Archiving
Instead of rewriting the WebRTC DataChannel to multiplex thousands of interwoven chunks from different files—which introduces massive complexity, memory leaks, and sequence synchronization nightmares—we will implement **Virtual Archiving**.

When a user selects multiple files, the frontend will instantaneously package them into a single virtual `.zip` Blob directly in the browser's memory using an ultra-fast library like `fflate`.

### Why This is the Safest & Most Scalable Approach:
1. **Zero Protocol Changes:** The Web Worker, AES-GCM encryption, WebRTC data channel, and Socket.io signaling will not know the difference between a single video file and a ZIP of 10 files. They will just process a single continuous stream of bytes. This guarantees exactly **zero regressions** in our connection stability.
2. **Bypasses Browser Pop-up Blockers:** Modern browsers (Chrome, Safari) strictly block websites from triggering multiple automatic downloads. If we sent 10 files individually, the receiver's browser would block 9 of them. Zipping guarantees a single, seamless, one-click download for the receiver.
3. **Preserves Native Speeds:** Client-side zipping using `fflate` is non-blocking and executes in milliseconds for standard files. 

---

## Step-by-Step Implementation Guide

### Phase 1: Frontend UI (Selection & Validation)
1. **File Input Modification:** 
   - Update the `<input type="file" />` in `SendFlow.tsx` to include the `multiple` attribute.
2. **Validation Guards:**
   - Enforce a strict `files.length <= 10` limit.
   - Enforce a total memory limit (e.g., sum of file sizes must be `< 1.5 GB`) to prevent mobile browsers from crashing due to Out-Of-Memory (OOM) errors during the zipping process.
3. **Visual Feedback:**
   - Redesign the "File Selected" card to display a scrollable mini-list of the selected files and their individual sizes.

### Phase 2: Virtual Packaging (`fflate` Integration)
1. **Dependency:** Install `fflate` (an incredibly lightweight, fast, and modern JS compression library).
2. **Pre-processing:**
   - When the user clicks "Create OTC", intercept the array of files.
   - If `files.length === 1`, pass the single file straight to the Web Worker (preserving current behavior).
   - If `files.length > 1`, iterate through the files, read them into memory, and compress them into a virtual `archive.zip` Blob.
3. **Handoff:** Pass this single `archive.zip` Blob to the Web Worker for standard AES encryption.

### Phase 3: Metadata Enhancement (Receiver Illusion)
To make the experience feel magical for the receiver, they shouldn't just see "Receiving archive.zip". They should see exactly what is inside it.
1. **Sender Updates:** Modify the `SenderMeta` object created in the Web Worker to include an array of filenames: `originalFiles: ["photo.jpg", "document.pdf"]`.
2. **Receiver UI Updates:** Update `ReceiveFlow.tsx`. When the receiver imports the metadata, if `originalFiles` is present, render a list showing the receiver exactly which 10 files are actively being transferred to them inside the archive.

### Phase 4: Receiver Unpacking
1. The receiver decrypts the chunks exactly as they do now.
2. The assembly function pieces the chunks back together into the `archive.zip` buffer.
3. The browser triggers a single native download of `Shared_Files.zip`. 

---

## Risk Assessment & Fallbacks
- **Risk:** High memory usage on mobile devices when zipping multiple large video files.
- **Mitigation:** We will implement `fflate` using its stream-based or asynchronous methods where possible to keep the main UI thread buttery smooth, and enforce the 1.5GB total size limit to respect standard mobile browser RAM caps.

This architecture ensures your application scales to handle multi-file transfers gracefully while protecting the hard-fought stability of our WebRTC handshake and Socket backend.
