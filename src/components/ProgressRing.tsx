interface ProgressRingProps {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  pct,
  size = 100,
  stroke = 9,
  color = "hsl(42 55% 62%)",
  trackColor = "hsl(220 25% 16%)",
  label,
  sublabel,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const cx = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {/* Track */}
        <circle cx={cx} cy={cx} r={r} stroke={trackColor} strokeWidth={stroke} />
        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
          filter={`drop-shadow(0 0 6px ${color}88)`}
        />
      </svg>
      {(label !== undefined || sublabel !== undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {label !== undefined && (
            <span className="font-display leading-none" style={{ fontSize: size * 0.28, color }}>
              {label}
            </span>
          )}
          {sublabel !== undefined && (
            <span
              className="font-mono uppercase tracking-wider text-muted-foreground leading-none"
              style={{ fontSize: size * 0.09 }}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
