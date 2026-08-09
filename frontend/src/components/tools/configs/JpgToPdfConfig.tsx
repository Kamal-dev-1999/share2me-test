"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function JpgToPdfConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ fitToPage: true });
    }
  }, [config, onChange]);

  const fitToPage = config.fitToPage ?? true;

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!fitToPage}
            onChange={(e) => onChange({ ...config, fitToPage: e.target.checked })}
            className="w-5 h-5 rounded border-2 border-ink text-ink focus:ring-ink"
          />
          <span className="text-[14px] font-medium text-on-surface">Fit Image to Page (A4)</span>
        </label>
        <p className="text-[11px] text-text-muted mt-2 ml-8">
          If checked, images will be scaled to fit a standard A4 page. If unchecked, the PDF page size will exactly match the image dimensions.
        </p>
      </div>
    </div>
  );
}
