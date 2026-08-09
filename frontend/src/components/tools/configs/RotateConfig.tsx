"use client";

import { useEffect } from "react";
import { GlassSelect } from "@/components/ui/GlassSelect";

export interface ConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function RotateConfig({ config, onChange }: ConfigProps) {
  // Set defaults
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ degrees: "90", pageRange: "" });
    }
  }, [config, onChange]);

  const degrees = (config.degrees as string) || "90";
  const pageRange = (config.pageRange as string) || "";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Rotation Angle</label>
        <GlassSelect
          value={degrees}
          onChange={(val) => onChange({ ...config, degrees: val })}
          options={[
            { label: "90° Clockwise", value: "90" },
            { label: "180° Upside Down", value: "180" },
            { label: "270° Counter-Clockwise", value: "270" },
          ]}
        />
      </div>

      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Pages (Optional)</label>
        <input
          type="text"
          value={pageRange}
          onChange={(e) => onChange({ ...config, pageRange: e.target.value })}
          placeholder="e.g. 1-3, 5"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
        <p className="text-[11px] text-text-muted mt-1.5">Leave blank to rotate all pages.</p>
      </div>
    </div>
  );
}
