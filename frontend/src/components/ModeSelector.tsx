"use client";

interface Props {
  mode: "send" | "receive";
  onChange: (m: "send" | "receive") => void;
}

export function ModeSelector({ mode, onChange }: Props) {
  return (
    <div className="flex items-center bg-surface-cardDark border border-hairline-dark rounded-xl p-1 w-fit">
      {(["send", "receive"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`
            px-8 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
            ${mode === m
              ? "bg-primary text-ink shadow-sm"
              : "text-muted hover:text-white"
            }
          `}
        >
          {m === "send" ? "↑ Send" : "↓ Receive"}
        </button>
      ))}
    </div>
  );
}
