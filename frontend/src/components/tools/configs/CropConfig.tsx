"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function CropConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ top: "0", bottom: "0", left: "0", right: "0" });
    }
  }, [config, onChange]);

  const top = (config.top as string) || "0";
  const bottom = (config.bottom as string) || "0";
  const left = (config.left as string) || "0";
  const right = (config.right as string) || "0";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Top Margin (pt)</label>
          <input
            type="number"
            value={top}
            onChange={(e) => onChange({ ...config, top: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Bottom Margin (pt)</label>
          <input
            type="number"
            value={bottom}
            onChange={(e) => onChange({ ...config, bottom: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Left Margin (pt)</label>
          <input
            type="number"
            value={left}
            onChange={(e) => onChange({ ...config, left: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Right Margin (pt)</label>
          <input
            type="number"
            value={right}
            onChange={(e) => onChange({ ...config, right: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
      </div>
      <p className="text-[11px] text-text-muted mt-1.5">
        Specify margins to crop in points (72pt = 1 inch). Values remove space from the edges.
      </p>
    </div>
  );
}
