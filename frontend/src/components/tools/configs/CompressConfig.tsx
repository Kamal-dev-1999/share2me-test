"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";
import { GlassSelect } from "@/components/ui/GlassSelect";

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
        <GlassSelect
          value={quality}
          onChange={(val) => onChange({ ...config, quality: val })}
          options={[
            { label: "Screen (Lowest size, lowest quality)", value: "screen" },
            { label: "eBook (Medium size, medium quality)", value: "ebook" },
            { label: "Printer (Large size, high quality)", value: "printer" },
          ]}
        />
        <p className="text-[11px] text-text-muted mt-1.5">Note: In-browser compression primarily optimizes PDF structure.</p>
      </div>
    </div>
  );
}
