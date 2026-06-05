"use client";
import { TopNav }    from "@/components/TopNav";
import { SendFlow }  from "@/components/SendFlow";
import { useSocket } from "@/hooks/useSocket";
import { useTransfer } from "@/hooks/useTransfer";
import { Upload, Lock, Zap } from "lucide-react";
import Link from "next/link";

const STEPS = [
  {
    n: "01",
    title: "Drop your file",
    desc: "Any file type, any size. It's encrypted locally before anything leaves your device.",
  },
  {
    n: "02",
    title: "Share the code or QR",
    desc: "Send the 6-digit OTC or let the receiver scan the QR code — no account needed.",
  },
  {
    n: "03",
    title: "Direct transfer",
    desc: "A WebRTC peer-to-peer tunnel is established. Your file flows encrypted, end-to-end.",
  },
];

export default function SendPage() {
  const socket = useSocket();
  const {
    senderPhase, senderStatus, senderOtc, senderMeta, senderProgress,
    createRoom, startWebRtcSend,
  } = useTransfer(socket);

  return (
    <div className="min-h-screen bg-canvas-dark">
      <TopNav />

      {/* Page hero */}
      <div className="border-b border-hairline-dark bg-surface-cardDark/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Upload className="w-4 h-4 text-primary" />
                </div>
                <span className="text-primary text-xs font-semibold uppercase tracking-widest">Send a File</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight mb-3">
                Encrypted P2P Transfer
              </h1>
              <p className="text-muted text-sm sm:text-base max-w-lg leading-relaxed">
                Your file is encrypted with AES-GCM-256 on your device before transfer.
                It flows directly to the receiver via WebRTC — never touching our servers.
              </p>
            </div>
            {/* Trust badges */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              {[
                { icon: Lock, label: "AES-GCM-256 Encrypted" },
                { icon: Zap,  label: "WebRTC Peer-to-Peer" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted">
                  <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content — steps + transfer card */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">

          {/* Left — step guide */}
          <div className="order-2 lg:order-1">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-6">How it works</p>
            <div className="space-y-6">
              {STEPS.map((step) => (
                <div key={step.n} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20
                                  flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-primary">{step.n}</span>
                  </div>
                  <div className="pt-1">
                    <div className="text-white font-semibold text-sm mb-1">{step.title}</div>
                    <div className="text-muted text-sm leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Receiver link */}
            <div className="mt-10 p-4 rounded-xl bg-surface-cardDark border border-hairline-dark">
              <p className="text-muted text-sm mb-3">
                Is someone sending <span className="text-white font-medium">to you</span>?
              </p>
              <Link
                href="/#transfer"
                className="inline-flex items-center gap-2 text-primary text-sm font-semibold
                           hover:text-primary-active transition-colors"
              >
                ↓ Go to Receive →
              </Link>
            </div>
          </div>

          {/* Right — Send workspace card */}
          <div className="order-1 lg:order-2">
            <div className="bg-surface-cardDark rounded-xl border border-hairline-dark overflow-hidden sticky top-20">
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-hairline-dark bg-surface-elevatedDark/40">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    senderPhase === "done"
                      ? "bg-trading-up"
                      : senderPhase !== "idle"
                      ? "bg-primary animate-pulse-ring"
                      : "bg-muted"
                  }`} />
                  <span className="text-white text-sm font-semibold">Sender Workspace</span>
                </div>
                {senderOtc && (
                  <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                    OTC: {senderOtc}
                  </span>
                )}
              </div>

              {/* Send flow */}
              <div className="p-4 sm:p-5">
                <SendFlow
                  phase={senderPhase}
                  status={senderStatus}
                  otc={senderOtc}
                  meta={senderMeta}
                  progress={senderProgress}
                  onCreateRoom={createRoom}
                  onStartSend={startWebRtcSend}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
