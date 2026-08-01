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
    <div className="min-h-screen bg-background flex flex-col justify-between selection:bg-primary/20 text-on-surface">
      <div>
        <TopNav />
        
        <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24">
          {/* Refined Back Button */}
          <div className="mb-6">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container border border-outline hover:bg-surface-container-high text-xs font-bold text-on-surface transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-primary" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Refined Header */}
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight font-display uppercase">Person-to-Person (P2P) Transfer</h1>
            <p className="text-sm sm:text-base text-text-secondary max-w-[650px] leading-relaxed font-body">
              Direct, end-to-end encrypted file and text sharing. Keep both browsers open to transfer.
            </p>
          </div>

          {/* Refined Workspace Card */}
          <div className="bg-surface-card rounded-[24px] border border-outline-variant p-6 sm:p-8 md:p-10 relative overflow-hidden shadow-lg">
            
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex bg-surface-container border border-outline p-1 rounded-xl w-full sm:w-auto relative">
                <button
                  onClick={() => setMode("send")}
                  className={`flex-1 sm:flex-none py-2.5 px-6 sm:px-10 text-sm font-bold rounded-lg transition-all duration-200 ${
                    mode === "send" ? "text-on-primary bg-primary shadow-sm" : "text-text-secondary hover:text-on-surface"
                  }`}
                >
                  Send Files
                </button>
                <button
                  onClick={() => setMode("receive")}
                  className={`flex-1 sm:flex-none py-2.5 px-6 sm:px-10 text-sm font-bold rounded-lg transition-all duration-200 ${
                    mode === "receive" ? "text-on-primary bg-primary shadow-sm" : "text-text-secondary hover:text-on-surface"
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
      <footer className="w-full border-t border-outline-variant bg-surface-card py-12">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-on-surface font-display font-bold uppercase">Share2Me</span>
            </div>
            
            <div className="text-[13px] text-text-secondary font-mono">
              © 2026 Share2Me. All rights reserved.
            </div>

            <div className="flex items-center gap-6 font-mono text-[13px]">
              <Link href="/privacy" className="text-text-secondary hover:text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="text-text-secondary hover:text-primary transition-colors">Terms</Link>
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
