"use client";

import { CheckCircle2, AlertTriangle, XCircle, Search, Wand2 } from "lucide-react";

export interface SeoIssue {
  id: string;
  message: string;
}

export interface SeoValidationResult {
  isValid: boolean;
  errors?: SeoIssue[];
  warnings?: SeoIssue[];
  summary?: {
    errorCount: number;
    warningCount: number;
  };
}

interface SeoCheckPanelProps {
  validation: SeoValidationResult | null;
  onAutoFix?: () => void;
}

export function SeoCheckPanel({ validation, onAutoFix }: SeoCheckPanelProps) {
  if (!validation) return null;

  // Defensive safety checks to prevent TypeError if API returns error response or partial object
  const errors = Array.isArray(validation.errors) ? validation.errors : [];
  const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
  const isValid = Boolean(validation.isValid && errors.length === 0);

  // If validation object is an API error response (e.g. { error: "..." })
  const apiError = (validation as any).error;

  return (
    <div className="w-full bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[32px] p-6 space-y-4 shadow-sm font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-2.5 font-bold text-sm text-[#0f1015]">
          <Search className="w-4 h-4 text-purple-600" />
          <span>SEO & Metadata Validation</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {apiError ? (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-extrabold">
              Checking...
            </span>
          ) : (
            <>
              {errors.length > 0 && (
                <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-extrabold">
                  {errors.length} Error{errors.length > 1 ? "s" : ""}
                </span>
              )}
              {warnings.length > 0 && (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-extrabold">
                  {warnings.length} Warning{warnings.length > 1 ? "s" : ""}
                </span>
              )}
              {errors.length === 0 && warnings.length === 0 && (
                <span className="px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold">
                  All Checks Passed
                </span>
              )}

              {onAutoFix && (errors.length > 0 || warnings.length > 0) && (
                <button
                  onClick={onAutoFix}
                  className="px-4 py-1.5 rounded-full bg-[#0f1015] text-white hover:bg-purple-900 font-extrabold transition-all shadow-md flex items-center gap-1.5 text-xs hover:scale-[1.02]"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#fcd535]" />
                  <span>Auto-Fix All Issues</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 text-xs font-medium">
        {/* Errors Section */}
        {errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-rose-600 uppercase tracking-wider text-[10px]">
                Blocking Errors (Must fix before publishing)
              </div>
              {onAutoFix && (
                <button
                  onClick={onAutoFix}
                  className="text-rose-600 underline font-bold hover:text-rose-800 text-[11px]"
                >
                  Click to Auto-Fix Missing Title, Slug & HTML
                </button>
              )}
            </div>
            {errors.map((err) => (
              <div key={err.id || Math.random()} className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{err.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warnings Section */}
        {warnings.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="font-extrabold text-amber-600 uppercase tracking-wider text-[10px]">
              Advisory Warnings
            </div>
            {warnings.map((warn) => (
              <div key={warn.id || Math.random()} className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{warn.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Passed items summary */}
        {isValid && (
          <div className="space-y-1.5 text-[#5c6578] pt-1">
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Title & Slug format verified</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>H1 tag hierarchy validated</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>HTML structure is valid</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
