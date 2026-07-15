"use client";
import { useState } from "react";
import { Zap } from "lucide-react";

export function TransferCalculator() {
  const [fileSize, setFileSize] = useState(5); // Default 5 GB
  const [sizeUnit, setSizeUnit] = useState<"GB" | "MB">("GB");
  const [speed, setSpeed] = useState(100); // Default 100 Mbps

  // Calculate times
  const sizeInMB = sizeUnit === "GB" ? fileSize * 1024 : fileSize;
  const sizeInBits = sizeInMB * 1024 * 1024 * 8;
  const speedInBps = speed * 1000000;

  const secondsP2P = sizeInBits / speedInBps;
  const secondsCloud = (secondsP2P * 2) + 15; // 2x time + server processing overhead

  const formatTime = (sec: number) => {
    if (sec < 60) return `${Math.round(sec)}s`;
    const min = Math.floor(sec / 60);
    const remainingSec = Math.round(sec % 60);
    if (min < 60) return `${min}m ${remainingSec}s`;
    const hrs = Math.floor(min / 60);
    const remainingMin = min % 60;
    return `${hrs}h ${remainingMin}m`;
  };

  return (
    <div className="w-full bg-background-elevated border border-border/80 rounded-[24px] p-6 md:p-8 space-y-6 shadow-glow relative overflow-hidden my-10">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
      
      <div>
        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary animate-pulse" />
          <span>Interactive Transfer Time Calculator</span>
        </h3>
        <p className="text-xs text-text-tertiary mt-1">
          Compare estimated speeds: direct P2P stream vs traditional cloud hosting (upload + download).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider block mb-2">File Size</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={fileSize}
                onChange={(e) => setFileSize(Math.max(0.1, parseFloat(e.target.value) || 0))}
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-primary/50"
              />
              <select
                value={sizeUnit}
                onChange={(e) => setSizeUnit(e.target.value as "GB" | "MB")}
                className="bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold text-primary focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                <option value="GB">GB</option>
                <option value="MB">MB</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider block mb-2">
              Your Internet Speed: <span className="text-primary">{speed} Mbps</span>
            </label>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-text-tertiary font-bold mt-1.5">
              <span>10 Mbps (ADSL)</span>
              <span>100 Mbps (Standard)</span>
              <span>1000 Mbps (Gigabit)</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-background/40 border border-border/40 p-5 rounded-[20px] space-y-4 flex flex-col justify-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Share2Me Direct P2P Stream</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-status-success">{formatTime(secondsP2P)}</span>
              <span className="text-[11px] text-status-success/80 font-bold uppercase tracking-wider">(⚡ Maximum Speed)</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full h-2 bg-border rounded-full overflow-hidden mt-1">
              <div className="h-full bg-status-success rounded-full" style={{ width: "30%" }} />
            </div>
          </div>

          <div className="space-y-1 border-t border-border/40 pt-3">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">WeTransfer / Cloud Drive (2-Step)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-text-secondary">{formatTime(secondsCloud)}</span>
              <span className="text-[11px] text-text-tertiary font-bold uppercase tracking-wider">(2x Upload + Download)</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full h-2 bg-border rounded-full overflow-hidden mt-1">
              <div className="h-full bg-text-tertiary rounded-full" style={{ width: "85%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
