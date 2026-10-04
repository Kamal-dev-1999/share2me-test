# Share2Me Frontend (v3.5)

The Next.js 15 client application for **Share2Me** — an end-to-end encrypted peer-to-peer file transfer engine and merchant receive portal.

---

## 🚀 Overview

The frontend is built with **Next.js 15 (App Router)**, **React 18/19**, **TypeScript 5**, **Tailwind CSS**, and **Framer Motion**. It is engineered for low latency, zero-knowledge encryption, and high-fidelity responsive interactions across mobile and desktop viewports.

---

## 📦 Key Directory Structure

```
src/
├── app/
│   ├── layout.tsx              # Root HTML layout, SEO tags, SideRail mount, Google Analytics
│   ├── page.tsx                # Home / P2P file & text transfer interface
│   ├── g2p/
│   │   ├── page.tsx            # Authenticated vendor dashboard & role selection gate
│   │   ├── [code]/page.tsx     # Public student/client file-drop portal
│   │   └── nearby/page.tsx     # PostGIS print shop locator with Leaflet
│   ├── tools/                  # PDF signing, page numbers, background remover, visual editor
│   ├── pricing/                # Razorpay Pro membership checkout
│   └── globals.css             # Design tokens, custom scrollbars, animations
│
├── components/
│   ├── G2pDashboard.tsx        # Bento Box dashboard (metrics, orders, active uploads)
│   ├── SideRail.tsx            # iOS-inspired fluid curved mobile dock & desktop side rail
│   ├── settings/
│   │   └── UserSettingsHub.tsx # Segmented User Settings (Storefront, Rates, UPI 2FA, QR Branding)
│   ├── SendFlow.tsx            # P2P sender tab (drag-drop, OTC code, QR display)
│   ├── ReceiveFlow.tsx         # P2P receiver tab (OTC entry, WebRTC progress)
│   ├── printshop/              # PrintShopPanel, NearbyMap, RoleSelectModal
│   ├── tools/                  # SignPdfUI, BgRemoverUI, PdfEditorCanvas
│   └── ui/                     # AnimatedCopyIcon, ScrambleText, ConfettiButton, ContextMenu
│
├── hooks/
│   ├── useSocket.ts            # Singleton WebSocket hook for signaling
│   └── useTransfer.ts          # State machine orchestrating WebRTC DataChannels & Crypto Workers
│
└── lib/
    ├── printShop.ts            # Type definitions, OTP bank endpoints, R2 presign callers
    └── backendUrl.ts           # Dynamic backend host resolution
```

---

## 🎨 Design System & UI Architecture

### 1. Bento Box Architecture
The dashboard follows a clean glass-morphism aesthetic using:
- `backdrop-blur-2xl`, `bg-white/20`, and `border-white/30`
- Dynamic gradient file-type icons (`grad-pdf`, `grad-image`, `grad-code`, `grad-archive`)
- Performance-tuned transitions utilizing React 18 `useTransition` to prevent UI freezing during tab shifts

### 2. User Settings Hub (`UserSettingsHub.tsx`)
A modular settings architecture with 4 distinct sub-domains:
1. **Storefront & Profile Details**: Shop name, contact info, bio, pickup landmark, live GPS coordinates (Nominatim reverse geocoding), and 3-photo Cloudflare R2 gallery.
2. **Orders & Pricing**: Order intake toggle (Accepting Orders vs. Paused) and per-page rates for B&W and Color printing.
3. **Direct UPI Settlement & 2FA**: Direct vendor UPI payouts with zero platform cut, protected by 2FA email OTP verification modal.
4. **Plan & Portal Branding**: Persona selector, Razorpay Pro subscription upgrade, and interactive SVG QR preview (`react-qr-code`) with customizable foreground, background, and center logo URL.
5. **Unified Contextual Floating Save Bar**: Elevated at `bottom-24 lg:bottom-6` to avoid colliding with the mobile dock, with dirty-state change tracking and instant discard.

### 3. Mobile Navigation Dock (`SideRail.tsx`)
- On mobile (`lg:hidden`), renders a fixed bottom navigation dock at `bottom-6` with height `72px` and curved radius `rounded-[26px]`.
- All scroll containers add `pb-28 lg:pb-16` to guarantee bottom cards are never obstructed by the floating dock.

---

## ⚡ Client-Side Cryptography (`public/worker.js`)

Zero-knowledge P2P transfers are computed off the main thread:
1. **Key Generation**: Sender generates an ephemeral ECDH P-256 keypair and a random 256-bit AES-GCM symmetric key.
2. **Key Wrapping**: When the receiver joins and transmits its public key, the sender derives a shared secret via ECDH, wraps the AES key with AES-KW, and sends it over the signaling relay.
3. **Chunk Encryption**: Files are split into binary chunks and encrypted using AES-GCM with unique 12-byte initialization vectors (IVs).
4. **Decryption**: The receiver unwraps the AES key, receives chunks over the `RTCDataChannel`, decrypts each chunk in the worker, and reassembles the original file in memory or via OPFS/IndexedDB.

---

## 🛠️ Development & Commands

```bash
# Start frontend dev server on port 3001
npm run dev

# Check TypeScript types
npx tsc --noEmit

# Run Next.js production build
npx next build

# Run linter
npm run lint
```

---

## 🌐 Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_SIGNAL_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE=http://localhost:3000/g2p/printshop
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
```
