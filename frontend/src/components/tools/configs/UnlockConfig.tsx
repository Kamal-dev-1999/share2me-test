"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function UnlockConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ password: "" });
    }
  }, [config, onChange]);

  const password = (config.password as string) || "";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Original Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => onChange({ ...config, password: e.target.value })}
          placeholder="Password required to open"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
        <p className="text-[11px] text-text-muted mt-1.5">
          You must know the current password to unlock the document and remove its protection permanently.
        </p>
      </div>
    </div>
  );
}
