/**
 * Cute, child-friendly animated SVG face for the 7-point mood scale.
 *
 * Design goals: big shiny blinking eyes, no harsh eyebrows, soft rounded
 * mouths, always-present rosy cheeks, bright candy colors, gentle rocking
 * bob + springy pop on change. Sad levels get cute puppy-eyes + teardrops;
 * happy levels get closed ^^ eyes, sparkles, and floating hearts.
 *
 *   1 Very Unpleasant   – periwinkle, frown, big watery eyes, teardrops
 *   2 Unpleasant        – soft indigo, small frown, big eyes
 *   3 Slightly Unpl.    – lavender, tiny frown
 *   4 Neutral           – sky blue, tiny flat mouth
 *   5 Slightly Pleasant – mint, small smile, rosy cheeks
 *   6 Pleasant          – green, happy ^^ eyes, smile, cheeks
 *   7 Very Pleasant     – sunny yellow, big smile, sparkles + hearts
 */

import { useEffect, useRef } from "react";

interface MoodFaceProps {
  value: number; // 1–7
  size?: number;
}

type EyeStyle = "round" | "happy";

interface FaceState {
  fill: string;
  glow: string;
  /** mouth path — all "M x1,y1 Q cx,cy x2,y2" so CSS `d` can interpolate */
  mouth: string;
  eyes: EyeStyle;
  /** cheek opacity 0–1 */
  cheek: number;
  /** larger cheeks for the happiest faces */
  cheekBig?: boolean;
  tear?: boolean;
  sparkle?: boolean;
  hearts?: boolean;
}

const FEAT = "#46405E";   // soft dark indigo for eyes + mouth (warmer than black)
const SHINE = "#FFFFFF";
const CHEEK = "#FF9CB0";
const TEAR  = "#A7D8FF";

const STATES: (FaceState | null)[] = [
  null, // 0 unused
  // 1 – Very Unpleasant
  { fill: "#6E86E0", glow: "#9DB0F2", mouth: "M 38,71 Q 50,62 62,71", eyes: "round", cheek: 0.4, tear: true },
  // 2 – Unpleasant
  { fill: "#8A82DD", glow: "#ADA6EC", mouth: "M 39,70 Q 50,64 61,70", eyes: "round", cheek: 0.4 },
  // 3 – Slightly Unpleasant
  { fill: "#A985D8", glow: "#C4A6E8", mouth: "M 41,68 Q 50,65 59,68", eyes: "round", cheek: 0.45 },
  // 4 – Neutral
  { fill: "#5BB0E4", glow: "#86C9F1", mouth: "M 42,67 Q 50,67 58,67", eyes: "round", cheek: 0.45 },
  // 5 – Slightly Pleasant
  { fill: "#46C7B4", glow: "#71DBCB", mouth: "M 41,66 Q 50,72 59,66", eyes: "round", cheek: 0.7 },
  // 6 – Pleasant
  { fill: "#62C96E", glow: "#8ADB94", mouth: "M 38,65 Q 50,76 62,65", eyes: "happy", cheek: 0.85, cheekBig: true },
  // 7 – Very Pleasant
  { fill: "#F5C24B", glow: "#FFD873", mouth: "M 35,64 Q 50,80 65,64", eyes: "happy", cheek: 1, cheekBig: true, sparkle: true, hearts: true },
];

const TRANS = "0.42s cubic-bezier(0.34, 1.56, 0.64, 1)";

/** One big shiny round eye, centred at (cx, cy). Blinks on a timer. */
function RoundEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <g className="eye-blink">
        <ellipse cx="0" cy="0" rx="7" ry="8.6" fill={FEAT} />
        {/* big top-left shine + small bottom-right shine = sparkly cute eye */}
        <circle cx="-2.4" cy="-3.2" r="2.8" fill={SHINE} />
        <circle cx="2.6" cy="3" r="1.4" fill={SHINE} opacity="0.85" />
      </g>
    </g>
  );
}

/** Closed happy ^^ eye (upward arch), centred at (cx, cy). */
function HappyEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M ${cx - 6.5},${cy + 2} Q ${cx},${cy - 4.5} ${cx + 6.5},${cy + 2}`}
      fill="none"
      stroke={FEAT}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
  );
}

export function MoodFace({ value, size = 130 }: MoodFaceProps) {
  const idx = Math.min(7, Math.max(1, Math.round(value)));
  const s = STATES[idx]!;

  // springy pop whenever the level changes
  const popRef = useRef<HTMLDivElement>(null);
  const prevIdx = useRef(idx);
  useEffect(() => {
    if (prevIdx.current === idx) return;
    prevIdx.current = idx;
    const el = popRef.current;
    if (!el) return;
    el.classList.remove("face-pop");
    void el.offsetWidth; // reflow to restart animation
    el.classList.add("face-pop");
  }, [idx]);

  const eyeCy = 49;

  return (
    <div
      className="face-bob"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 4px ${size * 0.1}px ${s.glow}aa)`,
        transition: `filter ${TRANS}`,
      }}
    >
      <div ref={popRef} style={{ width: "100%", height: "100%" }}>
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          xmlns="http://www.w3.org/2000/svg"
          overflow="visible"
          aria-hidden
        >
          {/* Face */}
          <circle cx="50" cy="50" r="46" fill={s.fill} style={{ transition: `fill ${TRANS}` }} />

          {/* Rosy cheeks — always present, bigger when happy */}
          <ellipse
            cx="22" cy="59"
            rx={s.cheekBig ? 11 : 9} ry={s.cheekBig ? 7.5 : 6}
            fill={CHEEK}
            style={{ opacity: s.cheek, transition: `opacity ${TRANS}, rx ${TRANS}, ry ${TRANS}` }}
          />
          <ellipse
            cx="78" cy="59"
            rx={s.cheekBig ? 11 : 9} ry={s.cheekBig ? 7.5 : 6}
            fill={CHEEK}
            style={{ opacity: s.cheek, transition: `opacity ${TRANS}, rx ${TRANS}, ry ${TRANS}` }}
          />

          {/* Eyes */}
          {s.eyes === "happy" ? (
            <>
              <HappyEye cx={36} cy={eyeCy} />
              <HappyEye cx={64} cy={eyeCy} />
            </>
          ) : (
            <>
              <RoundEye cx={36} cy={eyeCy} />
              <RoundEye cx={64} cy={eyeCy} />
            </>
          )}

          {/* Teardrops (very unpleasant) */}
          {s.tear && (
            <>
              <path
                d="M 30,58 q -2.6,4 0,6.2 q 2.6,-2.2 0,-6.2 z"
                fill={TEAR}
                style={{ animation: "tear-fall 1.9s ease-in 0.2s infinite", transformOrigin: "30px 58px" }}
              />
              <path
                d="M 70,58 q -2.6,4 0,6.2 q 2.6,-2.2 0,-6.2 z"
                fill={TEAR}
                style={{ animation: "tear-fall 1.9s ease-in 1s infinite", transformOrigin: "70px 58px" }}
              />
            </>
          )}

          {/* Mouth */}
          <path
            d={s.mouth}
            fill="none"
            stroke={FEAT}
            strokeWidth="4"
            strokeLinecap="round"
            style={{ ...({ d: `path("${s.mouth}")` } as object), transition: `d ${TRANS}` }}
          />

          {/* Sparkles + hearts (very pleasant) */}
          {s.sparkle && (
            <>
              <text x="4"  y="24" fontSize="13" className="sparkle-a" style={{ userSelect: "none" }}>✨</text>
              <text x="80" y="20" fontSize="11" className="sparkle-b" style={{ userSelect: "none" }}>⭐</text>
            </>
          )}
          {s.hearts && (
            <>
              <text x="-2" y="58" fontSize="11" className="sparkle-c" style={{ userSelect: "none" }}>💛</text>
              <text x="88" y="66" fontSize="10" className="sparkle-a" style={{ userSelect: "none" }}>💛</text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
