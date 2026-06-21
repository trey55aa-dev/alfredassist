/**
 * Animated SVG face for the 7-point mood scale.
 *
 * Level 1 – Very Unpleasant : deep-blue face, steep frown, raised inner brows, tears
 * Level 2 – Unpleasant      : indigo, frown, worried brows
 * Level 3 – Slightly Unpl.  : purple, slight frown
 * Level 4 – Neutral         : steel-blue, flat mouth, neutral brows
 * Level 5 – Slightly Pleas. : teal, slight smile, rosy cheeks begin
 * Level 6 – Pleasant        : green, full smile, cheeks
 * Level 7 – Very Pleasant   : gold, big open smile, full cheeks, sparkles
 *
 * Animated elements (all via CSS transition):
 *   – face fill color
 *   – mouth path (CSS `d` property — Chrome/Safari/FF modern)
 *   – eyebrow rotation (CSS transform)
 *   – eye scaleY (CSS transform → squint effect)
 *   – cheek opacity
 *   – outer glow (filter drop-shadow)
 */

import { useEffect, useRef } from "react";

interface MoodFaceProps {
  value: number; // 1–7
  size?: number;
}

interface FaceState {
  fill: string;
  glow: string;
  /** SVG path for mouth — all use `M x1,y Q cx,cy x2,y` so CSS `d` can interpolate */
  mouth: string;
  /** eyebrow rotation in degrees — left brow; right brow mirrors */
  browRot: number;
  /** Y translation of both brows (negative = higher) */
  browY: number;
  /** Eye scaleY 0–1 (1 = round, 0.45 = happy squint) */
  eyeScale: number;
  /** Cheek opacity 0–1 */
  cheek: number;
  /** Show tear drops */
  tear: boolean;
  /** Show sparkles */
  sparkle: boolean;
}

const STATES: (FaceState | null)[] = [
  null, // 0 – unused
  // 1 – Very Unpleasant
  {
    fill: "#3648C2", glow: "#4A6CF7",
    mouth:   "M 30,70 Q 50,52 70,70",
    browRot: -18, browY: 0,
    eyeScale: 1, cheek: 0, tear: true, sparkle: false,
  },
  // 2 – Unpleasant
  {
    fill: "#5046C8", glow: "#7060F0",
    mouth:   "M 32,68 Q 50,55 68,68",
    browRot: -11, browY: 0,
    eyeScale: 0.9, cheek: 0, tear: false, sparkle: false,
  },
  // 3 – Slightly Unpleasant
  {
    fill: "#7244BC", glow: "#9C5ED6",
    mouth:   "M 34,67 Q 50,59 66,67",
    browRot: -5, browY: 0,
    eyeScale: 0.9, cheek: 0, tear: false, sparkle: false,
  },
  // 4 – Neutral
  {
    fill: "#2E7FB0", glow: "#4AA8DC",
    mouth:   "M 35,66 Q 50,66 65,66",
    browRot: 0, browY: 0,
    eyeScale: 0.9, cheek: 0, tear: false, sparkle: false,
  },
  // 5 – Slightly Pleasant
  {
    fill: "#169898", glow: "#2BB5B5",
    mouth:   "M 35,65 Q 50,74 65,65",
    browRot: 4, browY: -1,
    eyeScale: 0.75, cheek: 0.35, tear: false, sparkle: false,
  },
  // 6 – Pleasant
  {
    fill: "#1A9050", glow: "#2DB574",
    mouth:   "M 32,63 Q 50,80 68,63",
    browRot: 7, browY: -2,
    eyeScale: 0.6, cheek: 0.65, tear: false, sparkle: false,
  },
  // 7 – Very Pleasant
  {
    fill: "#B8920A", glow: "#D4AF37",
    mouth:   "M 28,61 Q 50,84 72,61",
    browRot: 11, browY: -4,
    eyeScale: 0.45, cheek: 0.9, tear: false, sparkle: true,
  },
];

const TRANS = "0.4s cubic-bezier(0.22, 1, 0.36, 1)";

export function MoodFace({ value, size = 130 }: MoodFaceProps) {
  const idx = Math.min(7, Math.max(1, Math.round(value)));
  const s = STATES[idx]!;

  // Trigger face-pop animation whenever value changes
  const faceRef = useRef<HTMLDivElement>(null);
  const prevIdx = useRef(idx);
  useEffect(() => {
    if (prevIdx.current === idx) return;
    prevIdx.current = idx;
    const el = faceRef.current;
    if (!el) return;
    el.classList.remove("face-pop");
    void el.offsetWidth; // reflow
    el.classList.add("face-pop");
  }, [idx]);

  // Brow transform strings
  const browLT = `translateY(${s.browY}px) rotate(${s.browRot}deg)`;
  const browRT = `translateY(${s.browY}px) rotate(${-s.browRot}deg)`;

  return (
    <div
      ref={faceRef}
      className="face-breathe"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 ${size * 0.14}px ${s.glow}99)`,
        transition: `filter ${TRANS}`,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
        aria-hidden
      >
        {/* ── Face circle ── */}
        <circle
          cx="50" cy="50" r="46"
          fill={s.fill}
          style={{ transition: `fill ${TRANS}` }}
        />

        {/* Inner gloss highlight */}
        <ellipse cx="38" cy="32" rx="14" ry="10"
          fill="rgba(255,255,255,0.09)"
          style={{ transition: `fill ${TRANS}` }}
        />

        {/* ── Cheeks ── */}
        <ellipse cx="20" cy="63" rx="11" ry="7"
          fill="#FF8FA0"
          style={{ opacity: s.cheek, transition: `opacity ${TRANS}` }}
        />
        <ellipse cx="80" cy="63" rx="11" ry="7"
          fill="#FF8FA0"
          style={{ opacity: s.cheek, transition: `opacity ${TRANS}` }}
        />

        {/* ── Left eyebrow ── */}
        <g transform="translate(34, 33)"
          style={{ transform: `translate(34px, 33px)`, transition: `transform ${TRANS}` }}>
          <g style={{ transform: browLT, transformOrigin: "0 0", transition: `transform ${TRANS}` }}>
            <line x1="-9" y1="0" x2="9" y2="0"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* ── Right eyebrow ── */}
        <g transform="translate(66, 33)"
          style={{ transform: `translate(66px, 33px)`, transition: `transform ${TRANS}` }}>
          <g style={{ transform: browRT, transformOrigin: "0 0", transition: `transform ${TRANS}` }}>
            <line x1="-9" y1="0" x2="9" y2="0"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* ── Left eye ── */}
        <g transform="translate(34, 45)">
          <g style={{ transform: `scaleY(${s.eyeScale})`, transformOrigin: "0 0", transition: `transform ${TRANS}` }}>
            <ellipse cx="0" cy="0" rx="6.5" ry="6.5" fill="rgba(255,255,255,0.92)" />
            <circle  cx="1"  cy="1"  r="3.2" fill={s.fill}
              style={{ transition: `fill ${TRANS}` }} />
            <circle  cx="3.5" cy="-2" r="1.6" fill="rgba(255,255,255,0.95)" />
          </g>
        </g>

        {/* ── Right eye ── */}
        <g transform="translate(66, 45)">
          <g style={{ transform: `scaleY(${s.eyeScale})`, transformOrigin: "0 0", transition: `transform ${TRANS}` }}>
            <ellipse cx="0" cy="0" rx="6.5" ry="6.5" fill="rgba(255,255,255,0.92)" />
            <circle  cx="1"  cy="1"  r="3.2" fill={s.fill}
              style={{ transition: `fill ${TRANS}` }} />
            <circle  cx="3.5" cy="-2" r="1.6" fill="rgba(255,255,255,0.95)" />
          </g>
        </g>

        {/* ── Mouth ── */}
        <path
          d={s.mouth}
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="3.8"
          strokeLinecap="round"
          // CSS `d` property allows smooth path interpolation in modern browsers
          style={{
            ...({ d: `path("${s.mouth}")` } as object),
            transition: `d ${TRANS}`,
          }}
        />

        {/* ── Tears (level 1 only) ── */}
        {s.tear && (
          <>
            <ellipse cx="28" cy="55" rx="2.2" ry="4"
              fill="rgba(180,210,255,0.8)"
              style={{ animation: "tear-fall 1.6s ease-in infinite" }}
            />
            <ellipse cx="60" cy="57" rx="2.2" ry="4"
              fill="rgba(180,210,255,0.8)"
              style={{ animation: "tear-fall 1.6s ease-in 0.75s infinite" }}
            />
          </>
        )}

        {/* ── Sparkles (level 7 only) ── */}
        {s.sparkle && (
          <>
            <text x="4"  y="22" fontSize="13" className="sparkle-a" style={{ userSelect: "none" }}>✨</text>
            <text x="78" y="18" fontSize="10" className="sparkle-b" style={{ userSelect: "none" }}>⭐</text>
            <text x="72" y="88" fontSize="9"  className="sparkle-a" style={{ userSelect: "none", animationDelay: "0.3s" }}>✨</text>
          </>
        )}
      </svg>
    </div>
  );
}
