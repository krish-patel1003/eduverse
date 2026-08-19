"use client";

import { MODE_OPTIONS, type TeachingMode } from "@/lib/pedagogy";

interface Props {
  /** Currently selected mode ("auto" is the recommended default). */
  value: TeachingMode;
  onPick: (mode: TeachingMode) => void;
  disabled?: boolean;
  /** Compact variant for showing above an already-generated lesson. */
  compact?: boolean;
}

/**
 * "Math My Way": the only teaching choice a child is ever shown.
 *
 * Deliberately plain language. The child says how they want help; the engine
 * decides the instructional method (Kumon, Singapore, Japanese, Russian and so
 * on) behind the scenes. "Teach Me the Best Way" is the prominent default,
 * because that is the button we most want learners pressing.
 */
export default function ModePicker({ value, onPick, disabled, compact }: Props) {
  const auto = MODE_OPTIONS[0];
  const rest = MODE_OPTIONS.slice(1);

  return (
    <div className={`mp ${compact ? "compact" : ""}`}>
      {!compact && <div className="mp-title">How should I help you?</div>}

      <button
        className={`mp-auto ${value === "auto" ? "on" : ""}`}
        onClick={() => onPick("auto")}
        disabled={disabled}
      >
        <span className="mp-emoji">{auto.emoji}</span>
        <span className="mp-auto-text">
          <b>{auto.label}</b>
          <small>{auto.blurb}</small>
        </span>
        {value === "auto" && <span className="mp-tick">✓</span>}
      </button>

      <div className="mp-grid">
        {rest.map((m) => (
          <button
            key={m.id}
            className={`mp-opt ${value === m.id ? "on" : ""}`}
            onClick={() => onPick(m.id)}
            disabled={disabled}
            title={m.blurb}
          >
            <span className="mp-emoji">{m.emoji}</span>
            <span className="mp-label">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
