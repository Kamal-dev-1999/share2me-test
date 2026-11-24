"use client";

import { useEffect } from "react";
import { ConfigProps } from "./RotateConfig";
import { GlassSelect } from "@/components/ui/GlassSelect";

const DEFAULTS: Record<string, unknown> = {
  pageSize: "A4",
  orientation: "portrait",
  marginMm: 18,
  scale: 1,
  printBackground: true,
  title: "",
  language: "en",
  header: false,
  footer: false,
  toc: false,
  remoteResources: false,
  maxPages: 200,
};

export function MarkdownToPdfConfig({ config, onChange }: ConfigProps) {
  useEffect(() => {
    if (Object.keys(config).length === 0) {
      onChange({ ...DEFAULTS });
    }
  }, [config, onChange]);

  const pageSize = (config.pageSize as string) || "A4";
  const orientation = (config.orientation as string) || "portrait";
  const marginMm = (config.marginMm as number) ?? 18;
  const scale = (config.scale as number) ?? 1;
  const title = (config.title as string) || "";
  const language = (config.language as string) || "en";
  const printBackground = config.printBackground !== false;
  const header = config.header === true;
  const footer = config.footer === true;
  const toc = config.toc === true;
  const remoteResources = config.remoteResources === true;

  const num = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return (
    <div className="flex flex-col gap-4 bg-surface border border-hairline rounded-xl p-5 shadow-soft">
      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Page Size</label>
        <GlassSelect
          value={pageSize}
          onChange={(val) => onChange({ ...config, pageSize: val })}
          options={[
            { label: "A4", value: "A4" },
            { label: "Letter", value: "Letter" },
          ]}
        />
      </div>

      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Orientation</label>
        <GlassSelect
          value={orientation}
          onChange={(val) => onChange({ ...config, orientation: val })}
          options={[
            { label: "Portrait", value: "portrait" },
            { label: "Landscape", value: "landscape" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Margin (mm)</label>
          <input
            type="number"
            min={0}
            max={40}
            value={marginMm}
            onChange={(e) => onChange({ ...config, marginMm: Math.min(40, Math.max(0, num(e.target.value, 18))) })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Scale</label>
          <input
            type="number"
            min={0.1}
            max={2}
            step={0.1}
            value={scale}
            onChange={(e) => onChange({ ...config, scale: Math.min(2, Math.max(0.1, num(e.target.value, 1))) })}
            className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Document Title</label>
        <input
          type="text"
          maxLength={200}
          value={title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="From the first # heading"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
      </div>

      <div>
        <label className="text-[13px] font-semibold text-on-surface block mb-1.5">Language</label>
        <input
          type="text"
          maxLength={20}
          value={language}
          onChange={(e) => onChange({ ...config, language: e.target.value })}
          placeholder="en"
          className="w-full h-11 px-3 bg-surface-container border border-hairline rounded-lg text-[14px] text-on-surface placeholder:text-text-muted focus:border-ink focus:ring-1 focus:ring-ink transition-all outline-none"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-4">
        {[
          { key: "printBackground", label: "Print background graphics", value: printBackground },
          { key: "header", label: "Show header", value: header },
          { key: "footer", label: "Show footer with page numbers", value: footer },
          { key: "toc", label: "Include table of contents", value: toc },
          { key: "remoteResources", label: "Allow remote images / links", value: remoteResources },
        ].map((item) => (
          <label key={item.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={item.value}
              onChange={(e) => onChange({ ...config, [item.key]: e.target.checked })}
              className="mt-0.5 w-5 h-5 rounded border-2 border-ink text-ink focus:ring-ink"
            />
            <span className="text-[13px] font-medium text-on-surface leading-snug">{item.label}</span>
          </label>
        ))}
        <p className="text-[11px] text-text-muted leading-relaxed">
          Remote resources are blocked by default for safety. Inline data-URI images always work.
        </p>
      </div>
    </div>
  );
}
