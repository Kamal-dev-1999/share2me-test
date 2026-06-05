"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopNav }       from "@/components/TopNav";
import { HeroSection }  from "@/components/HeroSection";
import { ModeSelector } from "@/components/ModeSelector";
import { SendFlow }     from "@/components/SendFlow";
import { ReceiveFlow }  from "@/components/ReceiveFlow";
import { useSocket }    from "@/hooks/useSocket";
import { useTransfer }  from "@/hooks/useTransfer";

export default function Home() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"send" | "receive">("send");

  // Listen for nav-dispatched mode switches (same-page scroll)
  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent<"send" | "receive">).detail;
      setMode(mode);
    };
    window.addEventListener("set-transfer-mode", handler);
    return () => window.removeEventListener("set-transfer-mode", handler);
  }, []);

  // Auto-select receive mode + scroll if ?mode=receive (cross-page nav)
  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "receive" || m === "send") {
      setMode(m);
      setTimeout(() => {
        document.getElementById("transfer")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [searchParams]);

  const socket = useSocket();
  const {
    senderPhase, senderStatus, senderOtc, senderMeta, senderProgress,
    createRoom, startWebRtcSend,
    receiverPhase, receiverStatus, receiverKeyStatus, receiverProgress,
    joinRoom, importMetadata,
  } = useTransfer(socket);

  return (
    <div className="min-h-screen bg-canvas-dark">
      <TopNav />
      <HeroSection />

      {/* Transfer workspace — id used for scroll-to from nav */}
      <section id="transfer" className="px-4 sm:px-6 pb-16 sm:pb-section max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-xl sm:text-title-lg font-display font-semibold text-white">
            Start a Transfer
          </h2>
          <ModeSelector mode={mode} onChange={setMode} />
        </div>

        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-hairline-dark bg-surface-elevatedDark/40">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                mode === "send"
                  ? (senderPhase === "done" ? "bg-trading-up" : senderPhase !== "idle" ? "bg-primary animate-pulse-ring" : "bg-muted")
                  : (receiverPhase === "done" ? "bg-trading-up" : receiverPhase !== "idle" ? "bg-trading-up animate-pulse-ring" : "bg-muted")
              }`} />
              <span className="text-white text-sm font-semibold">
                {mode === "send" ? "Sender Workspace" : "Receiver Workspace"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {mode === "send" && senderOtc && (
                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                  OTC: {senderOtc}
                </span>
              )}
              {mode === "receive" && (
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  receiverKeyStatus === "ready"
                    ? "text-trading-up bg-trading-up/10"
                    : receiverKeyStatus === "generated"
                    ? "text-primary bg-primary/10"
                    : "text-muted bg-surface-elevatedDark"
                }`}>
                  {receiverKeyStatus === "ready" ? "Key: ready ✓" : receiverKeyStatus === "generated" ? "Key: generated" : "Key: pending"}
                </span>
              )}
            </div>
          </div>

          {/* Card body */}
          <div className="p-4 sm:p-6">
            {mode === "send" ? (
              <SendFlow
                phase={senderPhase}
                status={senderStatus}
                otc={senderOtc}
                meta={senderMeta}
                progress={senderProgress}
                onCreateRoom={createRoom}
                onStartSend={startWebRtcSend}
              />
            ) : (
              <ReceiveFlow
                phase={receiverPhase}
                status={receiverStatus}
                keyStatus={receiverKeyStatus}
                progress={receiverProgress}
                onJoin={joinRoom}
                onImport={importMetadata}
              />
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-softLight border-t border-hairline-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <div className="text-sm font-semibold text-body-light mb-4">Product</div>
              {["How it Works", "Security", "Roadmap"].map(l => (
                <a key={l} href="#" className="block text-sm text-muted hover:text-body-light mb-2 transition-colors">{l}</a>
              ))}
            </div>
            <div>
              <div className="text-sm font-semibold text-body-light mb-4">Security</div>
              {["AES-GCM-256", "ECDH Key Exchange", "Zero Knowledge"].map(l => (
                <div key={l} className="text-sm text-muted mb-2">{l}</div>
              ))}
            </div>
            <div>
              <div className="text-sm font-semibold text-body-light mb-4">Transfer</div>
              {["WebRTC P2P", "QR Scan", "Chunk Resume"].map(l => (
                <div key={l} className="text-sm text-muted mb-2">{l}</div>
              ))}
            </div>
            <div>
              <div className="text-sm font-semibold text-body-light mb-4">Open Source</div>
              {["GitHub", "Contribute", "License"].map(l => (
                <a key={l} href="#" className="block text-sm text-muted hover:text-body-light mb-2 transition-colors">{l}</a>
              ))}
            </div>
          </div>
          <div className="mt-8 sm:mt-12 pt-6 border-t border-hairline-light flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-muted text-center">© 2026 ShareIt. No data stored. No servers involved.</span>
            <span className="text-xs text-muted text-center">E2E encrypted · WebRTC P2P · AES-GCM-256</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
