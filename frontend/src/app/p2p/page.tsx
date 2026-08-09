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

      <main className="w-full max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 pt-8 pb-24 flex-1">
        {/* Navigation / Actions Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-[#E1E3E5] hover:bg-[#F7F8F8] text-[13px] font-semibold text-[#5F6368] hover:text-black rounded-xl transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-black" strokeWidth={2.5} />
            Back
          </Link>
        </div>

        {/* Workspace */}
        <div className="bg-white border border-[#E1E3E5] rounded-[24px] p-5 sm:p-8 md:p-10 shadow-sm relative">

          {/* Mode toggle */}
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap relative z-10">
            <div className="inline-flex bg-[#F7F8F8] p-1 rounded-full border border-[#E1E3E5]/60 w-full sm:w-auto">
              <button
                onClick={() => setMode("send")}
                className={`flex-1 sm:flex-none py-2 px-6 rounded-full text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  mode === "send"
                    ? "bg-black text-white shadow-sm"
                    : "text-[#5F6368] hover:text-black"
                }`}
              >
                <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
                Send
              </button>
              <button
                onClick={() => setMode("receive")}
                className={`flex-1 sm:flex-none py-2 px-6 rounded-full text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  mode === "receive"
                    ? "bg-black text-white shadow-sm"
                    : "text-[#5F6368] hover:text-black"
                }`}
              >
                <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
                Receive
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 text-[12px] text-[#5F6368] bg-[#F7F8F8] px-3.5 py-1.5 rounded-full border border-[#E1E3E5]">
              <Zap className="w-3.5 h-3.5 text-[#35B94A] animate-pulse" strokeWidth={2.5} />
              <span>Ephemeral · ECDH P-256 handshake</span>
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
