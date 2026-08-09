"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function WatermarkConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ text: "CONFIDENTIAL", opacity: "0.25", angle: "45", fontSize: "64" });
    }
  }, [config, onChange]);

  const text = (config.text as string) || "CONFIDENTIAL";
  const opacity = (config.opacity as string) || "0.25";
  const angle = (config.angle as string) || "45";
  const fontSize = (config.fontSize as string) || "64";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Watermark Text</label>
        <input
          type="text"
          value={text}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
          placeholder="e.g. CONFIDENTIAL"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Opacity (0-1)</label>
          <input
            type="number"
            min="0.1"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => onChange({ ...config, opacity: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Angle (°)</label>
          <input
            type="number"
            value={angle}
            onChange={(e) => onChange({ ...config, angle: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Font Size</label>
        <input
          type="number"
          min="12"
          value={fontSize}
          onChange={(e) => onChange({ ...config, fontSize: e.target.value })}
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
      </div>
    </div>
  );
}
