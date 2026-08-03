"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SendFlow } from "@/components/SendFlow";
import { ReceiveFlow } from "@/components/ReceiveFlow";
import { SeoContent } from "@/components/SeoContent";
import { useSocket } from "@/hooks/useSocket";
import { useTransfer } from "@/hooks/useTransfer";
import Link from "next/link";
import { ArrowLeft, Upload, Download, Zap } from "lucide-react";
import { AnimatePresence } from "framer-motion";

function P2PContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"send" | "receive">("send");

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "receive" || m === "send") setMode(m);
  }, [searchParams]);

  const socket = useSocket();
  const {
    senderPhase, senderStatus, senderOtc, senderProgress, senderBytes,
    createRoom, createTextRoom, startWebRtcSend,
    receiverPhase, receiverStatus, receiverKeyStatus, receiverProgress, receiverBytes, receivedText,
    joinRoom,
  } = useTransfer(socket);

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
      <TopNav />

      <main className="w-full max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 pt-8 pb-24 flex-1">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 border-2 border-ink rounded-md px-3 py-1.5 bg-surface hover:bg-signal-yellow transition-colors label-caps text-ink shadow-hard-sm"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
            Back to Home
          </Link>
        </div>

        {/* Section header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="label-caps text-on-surface-variant">// P2P · Direct Transfer</span>
            <h1 className="font-display font-bold uppercase text-[40px] md:text-[56px] leading-[1.05] text-ink mt-2">
              Person-to-Person
            </h1>
            <p className="text-on-surface-variant mt-3 max-w-[650px] leading-relaxed">
              Direct, end-to-end encrypted file and text sharing. Keep both browsers
              open to transfer.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="chip-outline">AES-256</span>
            <span className="chip-outline">WEBRTC</span>
            <span className="chip-yellow">ZERO STORAGE</span>
          </div>
        </div>

        {/* Workspace */}
        <div className="card-brutalist p-5 sm:p-8 md:p-10 relative">
          {/* Mode toggle */}
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex bg-surface-container border-2 border-ink rounded-md overflow-hidden w-full sm:w-auto">
              <button
                onClick={() => setMode("send")}
                className={`flex-1 sm:flex-none py-3 px-6 sm:px-8 label-caps transition-all flex items-center justify-center gap-2 border-r-2 border-ink ${
                  mode === "send"
                    ? "bg-signal-yellow text-ink"
                    : "bg-surface-container text-on-surface hover:bg-surface"
                }`}
              >
                <Upload className="w-4 h-4" strokeWidth={2.5} />
                Send Files
              </button>
              <button
                onClick={() => setMode("receive")}
                className={`flex-1 sm:flex-none py-3 px-6 sm:px-8 label-caps transition-all flex items-center justify-center gap-2 ${
                  mode === "receive"
                    ? "bg-signal-yellow text-ink"
                    : "bg-surface-container text-on-surface hover:bg-surface"
                }`}
              >
                <Download className="w-4 h-4" strokeWidth={2.5} />
                Receive Files
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 label-caps text-on-surface-variant">
              <Zap className="w-4 h-4" strokeWidth={2.5} />
              Ephemeral · ECDH P-256 handshake
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === "send" ? (
              <SendFlow
                key="send"
                phase={senderPhase}
                status={senderStatus}
                otc={senderOtc}
                progress={senderProgress}
                bytesTransferred={senderBytes}
                onCreateRoom={createRoom}
                onCreateTextRoom={createTextRoom}
                onStartSend={startWebRtcSend}
              />
            ) : (
              <ReceiveFlow
                key="receive"
                phase={receiverPhase}
                status={receiverStatus}
                keyStatus={receiverKeyStatus}
                progress={receiverProgress}
                bytesTransferred={receiverBytes}
                receivedText={receivedText}
                onJoin={joinRoom}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      <SeoContent />

      <footer className="w-full bg-ink text-surface py-10">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-display font-bold uppercase tracking-tight text-xl">Share2Me</span>
          <div className="label-caps text-surface/70">© 2026 Share2Me — All Rights Reserved</div>
          <div className="flex items-center gap-6">
            <a href="https://www.linkedin.com/company/share2me" target="_blank" rel="noopener noreferrer" className="text-surface/70 hover:text-signal-yellow transition-colors" aria-label="LinkedIn">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
              </svg>
            </a>
            <Link href="/privacy" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">Privacy</Link>
            <Link href="/terms" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function P2PPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <P2PContent />
    </Suspense>
  );
}
