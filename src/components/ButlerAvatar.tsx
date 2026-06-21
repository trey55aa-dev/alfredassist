interface Props {
  size?: number;
  /** idle | thinking | speaking */
  state?: "idle" | "thinking" | "speaking";
  className?: string;
}

export function ButlerAvatar({ size = 56, state = "idle", className = "" }: Props) {
  const s = size;
  const thinking = state === "thinking";
  const speaking = state === "speaking";

  return (
    <svg
      viewBox="0 0 80 104"
      width={s}
      height={s}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        animation: thinking
          ? "butler-think 1.2s ease-in-out infinite"
          : speaking
            ? "butler-speak 0.5s ease-in-out infinite"
            : "butler-breathe 4s ease-in-out infinite",
      }}
      aria-hidden
    >
      <style>{`
        @keyframes butler-breathe {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-2px); }
        }
        @keyframes butler-think {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50%       { transform: translateY(-3px) rotate(1deg); }
        }
        @keyframes butler-speak {
          0%, 100% { transform: scaleY(1); }
          50%       { transform: scaleY(1.02); }
        }
      `}</style>

      {/* Hat brim */}
      <rect x="20" y="24" width="40" height="5" rx="2.5" fill="currentColor" />
      {/* Hat crown */}
      <rect x="27" y="6" width="26" height="20" rx="3" fill="currentColor" />
      {/* Hat band — gold */}
      <rect x="27" y="22" width="26" height="4" rx="1" fill="var(--gold, #d4af37)" opacity="0.9" />

      {/* Head */}
      <circle cx="40" cy="44" r="14" fill="currentColor" opacity="0.9" />

      {/* Eyes */}
      <circle cx="35" cy="43" r="1.8" fill="var(--background, #0a0d14)" />
      <circle cx="45" cy="43" r="1.8" fill="var(--background, #0a0d14)" />

      {/* Monocle on right eye */}
      <circle cx="45" cy="43" r="4" fill="none" stroke="var(--gold, #d4af37)" strokeWidth="1.2" />
      <line x1="49" y1="44" x2="51" y2="47" stroke="var(--gold, #d4af37)" strokeWidth="1" />

      {/* Subtle smile */}
      <path
        d="M35 49 Q40 53 45 49"
        fill="none"
        stroke="var(--background, #0a0d14)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Collar / shirt */}
      <polygon points="35,59 40,68 37,59" fill="white" opacity="0.55" />
      <polygon points="45,59 40,68 43,59" fill="white" opacity="0.55" />

      {/* Bow tie — gold */}
      <polygon points="33,60 40,64 33,68" fill="var(--gold, #d4af37)" />
      <polygon points="47,60 40,64 47,68" fill="var(--gold, #d4af37)" />
      <circle cx="40" cy="64" r="2" fill="var(--gold, #d4af37)" />

      {/* Body (jacket) */}
      <rect x="25" y="62" width="30" height="32" rx="6" fill="currentColor" opacity="0.88" />

      {/* Jacket lapels */}
      <path d="M25,66 L35,78" stroke="var(--background, #0a0d14)" strokeWidth="1.5" opacity="0.5" />
      <path d="M55,66 L45,78" stroke="var(--background, #0a0d14)" strokeWidth="1.5" opacity="0.5" />

      {/* Left arm */}
      <rect x="9" y="63" width="16" height="9" rx="4.5" fill="currentColor" opacity="0.88" />
      {/* Right arm */}
      <rect x="55" y="63" width="16" height="9" rx="4.5" fill="currentColor" opacity="0.88" />

      {/* Gloves — white */}
      <circle cx="11" cy="75" r="6" fill="white" opacity="0.5" />
      <circle cx="69" cy="75" r="6" fill="white" opacity="0.5" />

      {/* Legs */}
      <rect x="27" y="92" width="11" height="10" rx="3" fill="currentColor" opacity="0.8" />
      <rect x="42" y="92" width="11" height="10" rx="3" fill="currentColor" opacity="0.8" />
    </svg>
  );
}
