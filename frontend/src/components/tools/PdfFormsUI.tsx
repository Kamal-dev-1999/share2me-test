"use client";

/**
 * PDF Forms — fully client-side (pdf-lib).
 * Detects fillable AcroForm fields (text, checkbox, dropdown, radio),
 * presents them as a friendly form, writes the values back into the PDF,
 * with an optional "flatten" (make fields non-editable) on download.
 */

import { useState } from "react";
import { Download, Loader2, FormInput, AlertTriangle } from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";
import { ToolChrome, ToolDropZone } from "./ToolChrome";
import { downloadBytes } from "@/lib/pdfRender";

type FieldKind = "text" | "checkbox" | "dropdown" | "radio";

interface FormFieldInfo {
  name: string;
  kind: FieldKind;
  options?: string[];      // dropdown / radio
  multiline?: boolean;
}

export function PdfFormsUI({ tool }: { tool: PdfTool }) {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fields, setFields] = useState<FormFieldInfo[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [flatten, setFlatten] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noFields, setNoFields] = useState(false);

  const loadFile = async (f: File) => {
    setError(null);
    setNoFields(false);
    setLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = await import("pdf-lib");
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const form = doc.getForm();
      const found: FormFieldInfo[] = [];
      const initial: Record<string, string | boolean> = {};

      for (const field of form.getFields()) {
        const name = field.getName();
        if (field instanceof PDFTextField) {
          found.push({ name, kind: "text", multiline: field.isMultiline() });
          initial[name] = field.getText() ?? "";
        } else if (field instanceof PDFCheckBox) {
          found.push({ name, kind: "checkbox" });
          initial[name] = field.isChecked();
        } else if (field instanceof PDFDropdown) {
          found.push({ name, kind: "dropdown", options: field.getOptions() });
          initial[name] = field.getSelected()[0] ?? "";
        } else if (field instanceof PDFRadioGroup) {
          found.push({ name, kind: "radio", options: field.getOptions() });
          initial[name] = field.getSelected() ?? "";
        }
        // Signature/button fields are skipped — nothing sensible to fill.
      }

      setFile(f);
      setBytes(buf);
      setFields(found);
      setValues(initial);
      setNoFields(found.length === 0);
    } catch {
      setError("Couldn't open this PDF. It may be corrupted or password-protected — unlock it first with the Unlock PDF tool.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!bytes || !file) return;
    setSaving(true);
    setError(null);
    try {
      const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = doc.getForm();

      for (const f of fields) {
        const v = values[f.name];
        try {
          const field = form.getField(f.name);
          if (field instanceof PDFTextField) field.setText(String(v ?? ""));
          else if (field instanceof PDFCheckBox) (v ? field.check() : field.uncheck());
          else if (field instanceof PDFDropdown && typeof v === "string" && v) field.select(v);
          else if (field instanceof PDFRadioGroup && typeof v === "string" && v) field.select(v);
        } catch {
          // A single unusual field must never break the whole save.
        }
      }

      if (flatten) {
        try { form.flatten(); } catch { /* fields with missing appearances — keep editable */ }
      }

      const out = await doc.save();
      downloadBytes(out, file.name.replace(/\.pdf$/i, "") + "-filled.pdf");
    } catch {
      setError("Saving failed — this PDF's form structure is unusual. Try without flattening.");
    } finally {
      setSaving(false);
    }
  };

  const prettyName = (n: string) =>
    n.replace(/[_.-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim() || n;

  return (
    <ToolChrome tool={tool}>
      <div className="card-brutalist p-4 sm:p-8">
        {error && (
          <div className="mb-4 p-3 border-2 border-error bg-error-container text-on-error-container text-sm font-semibold rounded-md">{error}</div>
        )}

        {!file && !loading && <ToolDropZone onFile={loadFile} label="Choose a fillable PDF form" />}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-on-surface-variant">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[13px] font-medium">Detecting form fields…</span>
          </div>
        )}

        {file && !loading && noFields && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <AlertTriangle className="w-8 h-8 text-on-surface-variant" />
            <p className="text-[15px] font-semibold text-on-surface">No fillable fields found</p>
            <p className="text-[13px] text-on-surface-variant max-w-[420px]">
              <b>{file.name}</b> has no interactive form fields. If it&apos;s a scanned or flat form, you can
              write on it with the Sign PDF tool instead.
            </p>
            <button onClick={() => { setFile(null); setBytes(null); }} className="mt-2 h-10 px-4 rounded-lg border-2 border-ink text-[12px] font-bold hover:bg-surface-container">
              Choose another PDF
            </button>
          </div>
        )}

        {file && !loading && fields.length > 0 && (
          <div className="flex flex-col gap-5 max-w-[720px]">
            <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
              <FormInput className="w-4 h-4" />
              <span><b className="text-on-surface">{fields.length}</b> fillable field{fields.length !== 1 ? "s" : ""} found in <b className="text-on-surface">{file.name}</b></span>
            </div>

            <div className="flex flex-col gap-4">
              {fields.map((f) => (
                <div key={f.name} className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-on-surface">{prettyName(f.name)}</label>

                  {f.kind === "text" && (f.multiline ? (
                    <textarea
                      value={String(values[f.name] ?? "")}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border-2 border-ink/25 bg-white px-3 py-2 text-[14px] focus:outline-none focus:border-ink"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(values[f.name] ?? "")}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className="w-full h-11 rounded-lg border-2 border-ink/25 bg-white px-3 text-[14px] focus:outline-none focus:border-ink"
                    />
                  ))}

                  {f.kind === "checkbox" && (
                    <button
                      onClick={() => setValues((v) => ({ ...v, [f.name]: !v[f.name] }))}
                      className={`self-start inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border-2 text-[13px] font-semibold transition-colors ${
                        values[f.name] ? "border-ink bg-ink text-white" : "border-ink/25 bg-white text-on-surface"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${values[f.name] ? "border-white bg-white" : "border-ink/40"}`}>
                        {values[f.name] && <span className="w-2 h-2 bg-ink rounded-[2px]" />}
                      </span>
                      {values[f.name] ? "Checked" : "Unchecked"}
                    </button>
                  )}

                  {(f.kind === "dropdown" || f.kind === "radio") && (
                    <select
                      value={String(values[f.name] ?? "")}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className="w-full h-11 rounded-lg border-2 border-ink/25 bg-white px-3 text-[14px] focus:outline-none focus:border-ink"
                    >
                      <option value="">— Select —</option>
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2.5 text-[13px] font-semibold cursor-pointer select-none">
              <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} className="w-4 h-4 accent-[#111827]" />
              Flatten the form (values become permanent — no longer editable)
            </label>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-ink text-white text-[13px] font-bold disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download filled PDF
              </button>
              <button
                onClick={() => { setFile(null); setBytes(null); setFields([]); }}
                className="h-11 px-4 rounded-lg border-2 border-ink text-[13px] font-bold hover:bg-surface-container"
              >
                Choose another PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolChrome>
  );
}
