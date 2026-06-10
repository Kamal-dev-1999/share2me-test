"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopNav }       from "@/components/TopNav";
import { HeroSection }  from "@/components/HeroSection";
import { TrustSection } from "@/components/TrustSection";
import { SendFlow }     from "@/components/SendFlow";
import { ReceiveFlow }  from "@/components/ReceiveFlow";
import { useSocket }    from "@/hooks/useSocket";
import { useTransfer }  from "@/hooks/useTransfer";
import Link from "next/link";

function HomeContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"send" | "receive">("send");

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent<"send" | "receive">).detail;
      setMode(mode);
    };
    window.addEventListener("set-transfer-mode", handler);
    return () => window.removeEventListener("set-transfer-mode", handler);
  }, []);

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
    senderPhase, senderStatus, senderOtc, senderProgress, senderBytes,
    createRoom, createTextRoom, startWebRtcSend,
    receiverPhase, receiverStatus, receiverKeyStatus, receiverProgress, receiverBytes, receivedText,
    joinRoom
  } = useTransfer(socket);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <HeroSection />

      {/* Transfer Workspace */}
      <section id="transfer" className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 pb-24">
        <div className="bg-background-elevated rounded-[24px] border border-border p-2 sm:p-6 shadow-soft">
          
          {/* Top Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-2 sm:px-0">
            {/* Segmented Control for Mode Switching */}
            <div className="flex bg-background border border-border p-1.5 rounded-[14px] w-full sm:w-auto shadow-inner relative">
              <button
                onClick={() => setMode("send")}
                className={`flex-1 sm:flex-none py-3 px-6 sm:px-10 text-[15px] sm:text-[16px] font-bold rounded-[10px] transition-all duration-200 z-10 ${
                  mode === "send" ? "text-primary shadow-[0_2px_12px_rgba(0,0,0,0.15)] bg-background-elevated border border-border/50" : "text-text-secondary hover:text-text-primary border border-transparent"
                }`}
              >
                Send Files
              </button>
              <button
                onClick={() => setMode("receive")}
                className={`flex-1 sm:flex-none py-3 px-6 sm:px-10 text-[15px] sm:text-[16px] font-bold rounded-[10px] transition-all duration-200 z-10 ${
                  mode === "receive" ? "text-primary shadow-[0_2px_12px_rgba(0,0,0,0.15)] bg-background-elevated border border-border/50" : "text-text-secondary hover:text-text-primary border border-transparent"
                }`}
              >
                Receive Files
              </button>
            </div>
            
          </div>

          {/* Transfer Flow */}
          <div className="w-full">
            {mode === "send" ? (
              <SendFlow
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
                phase={receiverPhase}
                status={receiverStatus}
                keyStatus={receiverKeyStatus}
                progress={receiverProgress}
                bytesTransferred={receiverBytes}
                receivedText={receivedText}
                onJoin={joinRoom}
              />
            )}
          </div>
        </div>
      </section>

      <TrustSection />

      {/* Footer */}
      <footer className="w-full border-t border-border bg-background py-12">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
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

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}
