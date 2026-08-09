"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function PdfToJpgConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ page: "1", scale: "2" });
    }
  }, [config, onChange]);

  const page = (config.page as string) || "1";
  const scale = (config.scale as string) || "2";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Page to Extract</label>
          <input
            type="number"
            min="1"
            value={page}
            onChange={(e) => onChange({ ...config, page: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Resolution (Scale)</label>
          <select
            value={scale}
            onChange={(e) => onChange({ ...config, scale: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          >
            <option value="1">1x (Standard)</option>
            <option value="2">2x (High)</option>
            <option value="3">3x (Ultra High)</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
        Currently extracts one page at a time. Multi-page ZIP extraction requires the server-side engine (Phase 2).
      </p>
    </div>
  );
}
