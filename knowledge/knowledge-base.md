# Share2Me Knowledge Base (v3.5)

This document is the authoritative project handoff and architecture record for coding agents working on the Share2Me repository.

---

## 1. Project Summary

Share2Me is a browser-native, zero-knowledge peer-to-peer file transfer engine and merchant receive portal with three core operations:

1. **P2P Transfer (`/`, `/p2p`)**: Direct device-to-device transfers over WebRTC DataChannels using client-side AES-GCM-256 and ECDH P-256 key exchange inside Web Workers.
2. **G2P (Get-to-Peer) Merchant Hub (`/g2p`)**: A real-time Bento Box vendor portal where print shops, educators, and businesses receive customer documents directly using permanent custom Share Codes.
3. **Productivity Tools Suite (`/tools`)**: In-browser tools including PDF signing, background removal (WebAssembly / Cloud Run), page numbering, and visual editing.

---

## 2. Current Standing (v3.5 Milestone)

The codebase is on **branch `v3.5`**, running **Next.js 15.5.27**, **React 18/19**, **TypeScript 5.x**, and **Tailwind CSS**.

### Key Additions in v3.5:
- **Decoupled User Settings Hub (`UserSettingsHub.tsx`)**: Replaced inline settings with a modular 4-domain hub:
  1. *Storefront & Profile*: Public business identity, pickup landmark, Nominatim GPS auto-detection, and 3-photo Cloudflare R2 gallery via presigned URLs.
  2. *Orders & Pricing*: One-touch intake toggle (Accepting Orders vs. Paused) and per-page rates for B&W and Color printing.
  3. *Direct UPI Settlement & 2FA*: 100% direct customer-to-vendor payment routing with zero platform fee, protected by 2FA email OTP verification modal.
  4. *Plan & Portal Branding*: Active persona selection, Razorpay Pro subscription upgrade, and live interactive SVG QR preview with customizable foreground, background, and center logo URL.
- **Fluid Non-Clipping Tab Navigation**: Replaced rigid multi-column pills with an adaptive horizontal scrollable bar with active tab centering, preventing any right-edge truncation (`Plan & P...`).
- **Contextual Floating Save Bar**: Elevated at `bottom-24 lg:bottom-6` to avoid colliding with the mobile bottom navigation dock (`h-[72px]` at `bottom-6`), tracking dirty state across tabs.
- **Micro-Interactions**: Optimized with React 18 `useTransition` for zero-lag tab switches, `ScrambleText`, `AnimatedCopyIcon`, `ConfettiButton`, and custom right-click context menu portals.
- **Mobile Navigation Dock (`SideRail.tsx`)**: Fluid curved floating dock on mobile with iOS-style folder expansion animations for secondary tools.

---

## 3. Repository Layout

```
ShareIt/
├── backend/                         # Express + Socket.io signaling & API server
│   ├── server.js                    #   Entry point — WebSocket relay + Next.js reverse proxy
│   ├── g2p/                         #   Vendor routes, direct UPI, R2 presigning, billing
│   ├── db/                          #   Postgres + PostGIS migrations
│   └── package.json
│
├── frontend/                        # Next.js 15 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           #   Root layout, fonts, SideRail dock, analytics
│   │   │   ├── page.tsx             #   Home page — P2P transfer workspace
│   │   │   ├── g2p/
│   │   │   │   ├── page.tsx         #   Dashboard container + persona selection gate
│   │   │   │   ├── [code]/page.tsx  #   Public customer file-drop portal
│   │   │   │   └── nearby/page.tsx  #   PostGIS nearby print shops explorer
│   │   │   ├── tools/               #   Productivity suite (PDF signer, editor, bg remover)
│   │   │   └── pricing/             #   Share2Me Pro subscription upgrade
│   │   ├── components/
│   │   │   ├── G2pDashboard.tsx     #   Bento Box vendor dashboard
│   │   │   ├── SideRail.tsx         #   Fluid mobile curved dock & desktop rail
│   │   │   ├── settings/
│   │   │   │   └── UserSettingsHub.tsx  # Modular Settings Architecture
│   │   │   ├── SendFlow.tsx         #   P2P file & text sender
│   │   │   ├── ReceiveFlow.tsx      #   P2P file & text receiver
│   │   │   └── ui/                  #   AnimatedCopyIcon, ScrambleText, ConfettiButton
│   │   ├── hooks/
│   │   │   ├── useSocket.ts         #   Socket.io singleton hook
│   │   │   └── useTransfer.ts       #   P2P state machine
│   │   └── lib/
│   │       ├── printShop.ts         #   Vendor API client & TypeScript interfaces
│   │       └── backendUrl.ts        #   Dynamic backend resolution
│   ├── public/
│   │   ├── worker.js                #   Crypto worker (AES-GCM + ECDH)
│   │   └── storage.js               #   OPFS / IndexedDB persistence
│   ├── tailwind.config.ts           #   Design system tokens
│   └── next.config.mjs              #   Security headers, CSP, image domains
│
├── knowledge/                       # Architecture records & developer guides
│   ├── knowledge-base.md            #   THIS FILE
│   ├── DESIGN.md                    #   UI design system standards
│   └── security_audit_plan.md       #   Security audit & remediation records
│
├── docker-compose.yml               # Production container stack
└── README.md                        # Project root documentation
```

---

## 4. Architectural Rules & Gotchas for Future Agents

1. **Mobile Dock Avoidance**:
   - The mobile dock (`SideRail.tsx`) sits fixed at `bottom-6` with height `72px`.
   - Any floating modals, sheets, or save bars must be elevated to at least `bottom-24` (`96px`) on mobile viewports (`bottom-24 lg:bottom-6`).
   - All scrolling page containers must include `pb-28 lg:pb-16` to allow full clearance.
2. **Framer Motion Button Props**:
   - When wrapping animated buttons with Framer Motion, extend `HTMLMotionProps<"button">` rather than standard `React.ButtonHTMLAttributes<HTMLButtonElement>` to prevent `onDrag` type conflicts.
3. **Tab Label Truncation**:
   - Never rely on fixed `grid-cols-4` on medium viewports with verbose tab labels. Use `overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap` with dynamic responsive labels.
4. **Signaling Server & Proxy**:
   - In development, the Express backend (port 3000) relays WebSocket events and proxies all HTTP requests to Next.js (port 3001). This allows cross-device testing with a single ngrok tunnel on port 3000.
5. **Zero-Knowledge Keys**:
   - Never serialize raw AES keys into QR codes, URLs, or metadata blobs. Key exchange is strictly brokered via ECDH P-256 public key wrapping.

---

## 5. Quick Commands

```bash
# Start backend (3000) and frontend (3001)
npm run dev

# Check TypeScript types
cd frontend && npx tsc --noEmit

# Production Next.js build
cd frontend && npx next build
```
