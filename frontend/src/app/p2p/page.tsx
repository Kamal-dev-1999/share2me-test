"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const [initialCode, setInitialCode] = useState<string>("");

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "receive" || m === "send") setMode(m);
    
    const c = searchParams.get("code");
    if (c) setInitialCode(c);
  }, [searchParams]);

  const socket = useSocket();
  const {
    senderPhase, senderStatus, senderOtc, senderProgress, senderBytes,
    createRoom, createTextRoom, startWebRtcSend,
    receiverPhase, receiverStatus, receiverKeyStatus, receiverProgress, receiverBytes, receivedText,
    joinRoom,
  } = useTransfer(socket);

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col text-on-surface font-body relative overflow-x-hidden">
      {/* Ambient decorative glowing backdrops */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[380px] bg-gradient-to-b from-purple-200/40 via-indigo-100/30 to-transparent blur-3xl pointer-events-none -z-10" />

      <main className="w-full max-w-[820px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20 flex-1 relative z-10">
        {/* Visually-hidden h1 for screen readers and SEO */}
        <h1 className="sr-only">
          Share2Me — Peer-to-Peer File Transfer
        </h1>

        {/* Top Header & Actions Bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md border border-black/5 hover:border-black/10 hover:bg-white text-[13px] font-semibold text-gray-600 hover:text-black rounded-xl transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-gray-800" strokeWidth={2.2} />
            <span>Back</span>
          </Link>

          {/* Mode toggle pills */}
          <div className="inline-flex bg-black/[0.04] p-1 rounded-full border border-black/[0.06] backdrop-blur-md shadow-inner">
            <button
              onClick={() => setMode("send")}
              className={`py-1.5 px-6 rounded-full text-[13px] font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                mode === "send"
                  ? "bg-black text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>Send</span>
            </button>
            <button
              onClick={() => setMode("receive")}
              className={`py-1.5 px-6 rounded-full text-[13px] font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                mode === "receive"
                  ? "bg-black text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>Receive</span>
            </button>
          </div>
        </div>

        {/* Main Glassmorphic Workspace Card */}
        <div className="bg-white/90 backdrop-blur-2xl border border-white/80 rounded-[32px] p-5 sm:p-8 md:p-9 shadow-[0_24px_60px_rgba(15,23,42,0.06)] relative overflow-hidden transition-all duration-300">
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
                initialCode={initialCode}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Privacy & Security Trust Footer Banner */}
        <div className="mt-5 flex items-center justify-center gap-2 text-[12px] font-medium text-gray-500 bg-white/60 backdrop-blur-md py-2.5 px-5 rounded-2xl border border-white/80 shadow-sm mx-auto w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>🔒 Direct Device-to-Device • 100% Private &amp; Encrypted • Zero Server Retention</span>
        </div>
      </main>

      <SeoContent />

      <footer className="w-full border-t border-hairline bg-surface py-6">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="font-semibold text-on-surface">Share2Me</span>
          <span>© 2026 Share2Me — All rights reserved</span>
          <div className="flex items-center gap-5">
            <a href="https://www.linkedin.com/company/share2me" target="_blank" rel="noopener noreferrer" className="hover:text-on-surface transition-colors" aria-label="LinkedIn">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
              </svg>
            </a>
            <Link href="/privacy" className="hover:text-on-surface transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-on-surface transition-colors">Terms</Link>
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
