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
import { Clock } from "lucide-react";
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-2 sm:px-0">
            {/* Tabs */}
            <div className="flex items-center border-b border-border w-full sm:w-auto">
              <button
                onClick={() => setMode("send")}
                className={`flex-1 sm:flex-none pb-3 px-4 text-[16px] sm:text-[17px] font-semibold transition-colors border-b-2 ${
                  mode === "send" ? "border-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                Send Files
              </button>
              <button
                onClick={() => setMode("receive")}
                className={`flex-1 sm:flex-none pb-3 px-4 text-[16px] sm:text-[17px] font-semibold transition-colors border-b-2 ${
                  mode === "receive" ? "border-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
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
              <a href="https://github.com/Kamal-dev-1999/shareit" target="_blank" rel="noopener noreferrer" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">GitHub</a>
              <a href="#" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Privacy</a>
              <a href="#" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Terms</a>
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
