import { ConfigProps } from "./RotateConfig";

export function TranslateConfig({ config, onChange }: ConfigProps) {
  const language = (config.targetLanguage as string) || "English";

  const languages = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese", 
    "Dutch", "Russian", "Chinese (Simplified)", "Chinese (Traditional)", 
    "Japanese", "Korean", "Hindi", "Arabic", "Turkish", "Vietnamese", "Thai"
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="targetLanguage" className="text-[13px] font-semibold text-on-surface">
          Target Language
        </label>
        <div className="relative">
          <select
            id="targetLanguage"
            value={language}
            onChange={(e) => onChange({ ...config, targetLanguage: e.target.value })}
            className="w-full appearance-none bg-surface border-2 border-ink rounded-md pl-3 pr-8 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-signal-yellow"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-on-surface-variant leading-relaxed">
        Select the language you want to translate your document into. Our AI engine will seamlessly preserve the original document formatting.
      </p>
    </div>
  );
}
