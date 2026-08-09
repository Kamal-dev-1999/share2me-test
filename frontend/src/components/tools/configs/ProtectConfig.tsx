"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";

export function ProtectConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ userPassword: "", ownerPassword: "" });
    }
  }, [config, onChange]);

  const userPassword = (config.userPassword as string) || "";
  const ownerPassword = (config.ownerPassword as string) || "";

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">User Password (Required)</label>
        <input
          type="password"
          value={userPassword}
          onChange={(e) => onChange({ ...config, userPassword: e.target.value })}
          placeholder="Password to open PDF"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
        <p className="text-[11px] text-text-muted mt-1.5">This password will be required to open the document.</p>
      </div>

      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Owner Password (Optional)</label>
        <input
          type="password"
          value={ownerPassword}
          onChange={(e) => onChange({ ...config, ownerPassword: e.target.value })}
          placeholder="Password to modify PDF"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
        <p className="text-[11px] text-text-muted mt-1.5">Leave blank to use the same as the user password.</p>
      </div>
    </div>
  );
}
