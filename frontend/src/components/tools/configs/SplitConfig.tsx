"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function SplitConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ pageRange: "" });
    }
  }, [config, onChange]);

  const pageRange = (config.pageRange as string) || "";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Pages to Extract</label>
        <input
          type="text"
          value={pageRange}
          onChange={(e) => onChange({ ...config, pageRange: e.target.value })}
          placeholder="e.g. 1-3, 5, 7-10"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
        <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
          Specify a comma-separated list of page numbers and/or ranges.<br/>
          Example: 1-3, 5, 7-10
        </p>
      </div>
    </div>
  );
}
