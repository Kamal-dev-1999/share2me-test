"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function OrganizeConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ order: "" });
    }
  }, [config, onChange]);

  const orderStr = Array.isArray(config.order) 
    ? config.order.map((n: number) => n + 1).join(", ") 
    : (config.order as string) || "";

  const handleChange = (val: string) => {
    // We store the raw string for the input, but the worker expects an array of 0-based indices.
    // The worker actually parses it if it's an array, but we can pass the array directly.
    const parts = val.split(",").map(s => s.trim()).filter(s => s !== "");
    const parsed = parts.map(s => parseInt(s, 10) - 1).filter(n => !isNaN(n));
    onChange({ ...config, order: parsed, _rawOrder: val });
  };

  const displayVal = (config._rawOrder as string) ?? orderStr;

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Page Order</label>
        <input
          type="text"
          value={displayVal}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g. 3, 1, 2"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
        <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
          Specify a comma-separated list of page numbers in the desired order.<br/>
          Example: 3, 1, 2, 5, 4
        </p>
      </div>
    </div>
  );
}
