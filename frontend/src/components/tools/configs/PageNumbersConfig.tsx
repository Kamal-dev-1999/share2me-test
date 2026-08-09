"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";
import { GlassSelect } from "@/components/ui/GlassSelect";

export function PageNumbersConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ position: "bottom-center", startFrom: "1", fontSize: "11" });
    }
  }, [config, onChange]);

  const position = (config.position as string) || "bottom-center";
  const startFrom = (config.startFrom as string) || "1";
  const fontSize = (config.fontSize as string) || "11";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Position</label>
        <GlassSelect
          value={position}
          onChange={(val) => onChange({ ...config, position: val })}
          options={[
            { label: "Bottom Left", value: "bottom-left" },
            { label: "Bottom Center", value: "bottom-center" },
            { label: "Bottom Right", value: "bottom-right" },
            { label: "Top Left", value: "top-left" },
            { label: "Top Center", value: "top-center" },
            { label: "Top Right", value: "top-right" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Start From</label>
          <input
            type="number"
            min="1"
            value={startFrom}
            onChange={(e) => onChange({ ...config, startFrom: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Font Size</label>
          <input
            type="number"
            min="6"
            max="72"
            value={fontSize}
            onChange={(e) => onChange({ ...config, fontSize: e.target.value })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
      </div>
    </div>
  );
}
