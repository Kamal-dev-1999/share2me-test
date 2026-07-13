"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopNav }       from "@/components/TopNav";
import { SendFlow }     from "@/components/SendFlow";
import { ReceiveFlow }  from "@/components/ReceiveFlow";
import { SeoContent }   from "@/components/SeoContent";
import { useSocket }    from "@/hooks/useSocket";
import { useTransfer }  from "@/hooks/useTransfer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence } from "framer-motion";

function P2PContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"send" | "receive">("send");

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "receive" || m === "send") {
      setMode(m);
    }
  }, [searchParams]);

  const socket = useSocket();
  const {
    senderPhase, senderStatus, senderOtc, senderProgress, senderBytes,
    createRoom, createTextRoom, startWebRtcSend,
    receiverPhase, receiverStatus, receiverKeyStatus, receiverProgress, receiverBytes, receivedText,
    joinRoom
  } = useTransfer(socket);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <TopNav />
        
        <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24">
          {/* Refined Back Button */}
          <div className="mb-6">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-border bg-background-elevated hover:bg-border/30 hover:border-primary/30 text-xs sm:text-sm font-bold text-text-secondary hover:text-text-primary transition-all duration-200 shadow-sm active:scale-95 group"
            >
              <ArrowLeft className="w-4 h-4 text-text-tertiary group-hover:text-primary transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Refined Header */}
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">Person-to-Person (P2P) Transfer</h1>
            <p className="text-sm sm:text-base text-text-secondary max-w-[650px] leading-relaxed">
              Direct, end-to-end encrypted file and text sharing. Keep both browsers open to transfer.
            </p>
          </div>

          {/* Refined Workspace Card */}
          <div className="bg-background-elevated rounded-[32px] border border-border p-5 sm:p-8 md:p-10 shadow-soft relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex bg-background border border-border p-1.5 rounded-[16px] w-full sm:w-auto shadow-inner relative">
                <button
                  onClick={() => setMode("send")}
                  className={`flex-1 sm:flex-none py-3 px-6 sm:px-10 text-[15px] sm:text-[16px] font-bold rounded-[12px] transition-all duration-200 z-10 ${
                    mode === "send" ? "text-primary shadow-md bg-background border border-border/50" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Send Files
                </button>
                <button
                  onClick={() => setMode("receive")}
                  className={`flex-1 sm:flex-none py-3 px-6 sm:px-10 text-[15px] sm:text-[16px] font-bold rounded-[12px] transition-all duration-200 z-10 ${
                    mode === "receive" ? "text-primary shadow-md bg-background border border-border/50" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Receive Files
                </button>
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
      </div>

      <SeoContent />

      {/* Footer */}
      <footer className="w-full border-t border-border bg-background py-12">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
              <span className="text-text-primary font-display font-bold">Share2Me</span>
            </div>
            
            <div className="text-[13px] text-text-tertiary">
              © 2026 Share2Me. All rights reserved.
            </div>

            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Terms</Link>
            </div>
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
