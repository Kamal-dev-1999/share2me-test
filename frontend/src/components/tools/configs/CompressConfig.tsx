"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function CompressConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ quality: "screen" });
    }
  }, [config, onChange]);

  const quality = (config.quality as string) || "screen";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Compression Quality</label>
        <select
          value={quality}
          onChange={(e) => onChange({ ...config, quality: e.target.value })}
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        >
          <option value="screen">Screen (Lowest size, lowest quality)</option>
          <option value="ebook">eBook (Medium size, medium quality)</option>
          <option value="printer">Printer (Large size, high quality)</option>
        </select>
        <p className="text-[11px] text-text-muted mt-1.5">Note: In-browser compression primarily optimizes PDF structure.</p>
      </div>
    </div>
  );
}
