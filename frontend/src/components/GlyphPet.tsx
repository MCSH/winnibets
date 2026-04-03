import { useState, useMemo } from "react";

/**
 * GlyphPet — a procedurally generated animated creature from a hex hash.
 *
 * Every digit of the hash drives a visual trait: body shape, color, eyes,
 * mouth, limbs, and animation personality. Hover to excite, click to pet.
 */

// --- Hash helpers ---

function hexAt(hash: string, i: number): number {
  return parseInt(hash[i % hash.length], 16);
}

function hexPair(hash: string, i: number): number {
  return hexAt(hash, i) * 16 + hexAt(hash, i + 1);
}

// --- Color palette ---

const PALETTES = [
  ["#f472b6", "#ec4899", "#db2777"], // pink
  ["#fb923c", "#f97316", "#ea580c"], // orange
  ["#facc15", "#eab308", "#ca8a04"], // yellow
  ["#4ade80", "#22c55e", "#16a34a"], // green
  ["#60a5fa", "#3b82f6", "#2563eb"], // blue
  ["#a78bfa", "#8b5cf6", "#7c3aed"], // purple
  ["#f87171", "#ef4444", "#dc2626"], // red
  ["#2dd4bf", "#14b8a6", "#0d9488"], // teal
  ["#34d399", "#10b981", "#059669"], // emerald
  ["#c084fc", "#a855f7", "#9333ea"], // violet
  ["#fb7185", "#f43f5e", "#e11d48"], // rose
  ["#38bdf8", "#0ea5e9", "#0284c7"], // sky
  ["#818cf8", "#6366f1", "#4f46e5"], // indigo
  ["#fbbf24", "#f59e0b", "#d97706"], // amber
  ["#a3e635", "#84cc16", "#65a30d"], // lime
  ["#e879f9", "#d946ef", "#c026d3"], // fuchsia
];

// --- Body paths (viewBox 0 0 100 100) ---

const BODIES = [
  // blob
  (w: number) => {
    const r = 38 + w * 2;
    return `M50,${50 - r} C${50 + r},${50 - r} ${50 + r},${50 + r} 50,${50 + r} C${50 - r},${50 + r} ${50 - r},${50 - r} 50,${50 - r}Z`;
  },
  // rounded square
  (_w: number) =>
    "M25,18 Q50,8 75,18 Q90,50 75,82 Q50,92 25,82 Q10,50 25,18Z",
  // egg
  (_w: number) =>
    "M50,10 C78,10 88,35 88,55 C88,78 72,92 50,92 C28,92 12,78 12,55 C12,35 22,10 50,10Z",
  // ghost
  (_w: number) =>
    "M50,8 C78,8 90,30 90,55 L90,90 L75,80 L60,90 L50,80 L40,90 L25,80 L10,90 L10,55 C10,30 22,8 50,8Z",
  // diamond
  (_w: number) =>
    "M50,8 C65,8 85,30 88,50 C85,70 65,92 50,92 C35,92 15,70 12,50 C15,30 35,8 50,8Z",
  // bean
  (_w: number) =>
    "M35,15 C60,5 85,20 85,45 C85,65 70,90 50,90 C30,90 10,75 15,50 C18,30 20,20 35,15Z",
  // chubby star
  (_w: number) =>
    "M50,8 L58,38 L90,38 L64,58 L74,88 L50,70 L26,88 L36,58 L10,38 L42,38Z",
  // mushroom
  (_w: number) =>
    "M50,12 C80,12 95,35 85,55 C80,62 68,65 62,68 L62,88 L38,88 L38,68 C32,65 20,62 15,55 C5,35 20,12 50,12Z",
];

// --- Eye styles ---

interface EyeProps {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  variant: number;
  color: string;
  excited: boolean;
}

function Eyes({ lx, ly, rx, ry, variant, color, excited }: EyeProps) {
  const s = excited ? 1.3 : 1;
  const v = variant % 6;

  switch (v) {
    case 0: // dots
      return (
        <>
          <circle cx={lx} cy={ly} r={4 * s} fill="white" />
          <circle cx={lx + 1} cy={ly} r={2 * s} fill={color} />
          <circle cx={rx} cy={ry} r={4 * s} fill="white" />
          <circle cx={rx + 1} cy={ry} r={2 * s} fill={color} />
        </>
      );
    case 1: // big sparkle
      return (
        <>
          <circle cx={lx} cy={ly} r={6 * s} fill="white" />
          <circle cx={lx + 1} cy={ly - 1} r={3 * s} fill={color} />
          <circle cx={lx + 3} cy={ly - 3} r={1.5} fill="white" />
          <circle cx={rx} cy={ry} r={6 * s} fill="white" />
          <circle cx={rx + 1} cy={ry - 1} r={3 * s} fill={color} />
          <circle cx={rx + 3} cy={ry - 3} r={1.5} fill="white" />
        </>
      );
    case 2: // lines (closed / happy)
      return (
        <>
          <path
            d={`M${lx - 5},${ly} Q${lx},${ly - 4 * s} ${lx + 5},${ly}`}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${rx - 5},${ry} Q${rx},${ry - 4 * s} ${rx + 5},${ry}`}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case 3: // X eyes
      return (
        <>
          <path
            d={`M${lx - 3},${ly - 3} L${lx + 3},${ly + 3} M${lx + 3},${ly - 3} L${lx - 3},${ly + 3}`}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M${rx - 3},${ry - 3} L${rx + 3},${ry + 3} M${rx + 3},${ry - 3} L${rx - 3},${ry + 3}`}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
    case 4: // wide ovals
      return (
        <>
          <ellipse cx={lx} cy={ly} rx={5 * s} ry={6 * s} fill="white" />
          <circle cx={lx} cy={ly + 1} r={2.5 * s} fill={color} />
          <ellipse cx={rx} cy={ry} rx={5 * s} ry={6 * s} fill="white" />
          <circle cx={rx} cy={ry + 1} r={2.5 * s} fill={color} />
        </>
      );
    default: // simple dots
      return (
        <>
          <circle cx={lx} cy={ly} r={3 * s} fill={color} />
          <circle cx={rx} cy={ry} r={3 * s} fill={color} />
        </>
      );
  }
}

// --- Mouth styles ---

function Mouth({
  cx,
  cy,
  variant,
  color,
  excited,
}: {
  cx: number;
  cy: number;
  variant: number;
  color: string;
  excited: boolean;
}) {
  const v = variant % 5;
  const w = excited ? 1.3 : 1;

  switch (v) {
    case 0: // smile
      return (
        <path
          d={`M${cx - 6 * w},${cy} Q${cx},${cy + 8 * w} ${cx + 6 * w},${cy}`}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 1: // open mouth
      return (
        <ellipse
          cx={cx}
          cy={cy + 2}
          rx={4 * w}
          ry={5 * w}
          fill={color}
          opacity={0.3}
        />
      );
    case 2: // cat mouth
      return (
        <path
          d={`M${cx - 8},${cy} L${cx},${cy + 4 * w} L${cx + 8},${cy}`}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 3: // tongue out
      return (
        <>
          <path
            d={`M${cx - 5},${cy} Q${cx},${cy + 5 * w} ${cx + 5},${cy}`}
            stroke={color}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx={cx} cy={cy + 6} rx={2.5} ry={3} fill="#f472b6" />
        </>
      );
    default: // dot
      return <circle cx={cx} cy={cy + 2} r={2} fill={color} />;
  }
}

// --- Limbs ---

function Limbs({
  count,
  color,
  variant,
  excited,
}: {
  count: number;
  color: string;
  variant: number;
  excited: boolean;
}) {
  const limbs: React.ReactNode[] = [];
  const v = variant % 3;
  const n = Math.max(2, count);

  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const yBase = 55 + Math.floor(i / 2) * 18;
    const xBase = side > 0 ? 85 : 15;
    const wiggle = excited ? 8 : 3;
    const animDelay = i * 0.15;

    if (v === 0) {
      // stubs
      limbs.push(
        <line
          key={i}
          x1={xBase}
          y1={yBase}
          x2={xBase + side * 12}
          y2={yBase - 3}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${xBase} ${yBase};${side * wiggle} ${xBase} ${yBase};0 ${xBase} ${yBase};${-side * wiggle} ${xBase} ${yBase};0 ${xBase} ${yBase}`}
            dur={`${1.2 + animDelay}s`}
            repeatCount="indefinite"
          />
        </line>,
      );
    } else if (v === 1) {
      // tentacles
      limbs.push(
        <path
          key={i}
          d={`M${xBase},${yBase} Q${xBase + side * 15},${yBase + 5} ${xBase + side * 10},${yBase + 15}`}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${xBase} ${yBase};${side * wiggle * 1.5} ${xBase} ${yBase};0 ${xBase} ${yBase};${-side * wiggle} ${xBase} ${yBase};0 ${xBase} ${yBase}`}
            dur={`${1.5 + animDelay}s`}
            repeatCount="indefinite"
          />
        </path>,
      );
    } else {
      // dots on sticks
      limbs.push(
        <g key={i}>
          <line
            x1={xBase}
            y1={yBase}
            x2={xBase + side * 10}
            y2={yBase}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle
            cx={xBase + side * 12}
            cy={yBase}
            r={3}
            fill={color}
          />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${xBase} ${yBase};${side * wiggle} ${xBase} ${yBase};0 ${xBase} ${yBase}`}
            dur={`${1 + animDelay}s`}
            repeatCount="indefinite"
          />
        </g>,
      );
    }
  }

  return <>{limbs}</>;
}

// --- Accessories ---

function Accessory({
  variant,
  color,
}: {
  variant: number;
  color: string;
}) {
  const v = variant % 6;

  switch (v) {
    case 0: // blush spots
      return (
        <>
          <circle cx={28} cy={52} r={5} fill={color} opacity={0.2} />
          <circle cx={72} cy={52} r={5} fill={color} opacity={0.2} />
        </>
      );
    case 1: // halo
      return (
        <ellipse
          cx={50}
          cy={10}
          rx={14}
          ry={4}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          opacity={0.7}
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0;0,-2;0,0"
            dur="2s"
            repeatCount="indefinite"
          />
        </ellipse>
      );
    case 2: // antenna
      return (
        <g>
          <line
            x1={50}
            y1={12}
            x2={50}
            y2={0}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={50} cy={-2} r={3} fill={color}>
            <animate
              attributeName="r"
              values="3;4;3"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      );
    case 3: // horns
      return (
        <>
          <path
            d="M35,15 L28,2"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d="M65,15 L72,2"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </>
      );
    case 4: // sparkles
      return (
        <>
          <circle cx={20} cy={20} r={1.5} fill="#fbbf24" opacity={0.8}>
            <animate
              attributeName="opacity"
              values="0.8;0.2;0.8"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={82} cy={28} r={1.5} fill="#fbbf24" opacity={0.6}>
            <animate
              attributeName="opacity"
              values="0.6;0.1;0.6"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={75} cy={12} r={1} fill="#fbbf24" opacity={0.7}>
            <animate
              attributeName="opacity"
              values="0.7;0.15;0.7"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      );
    default: // nothing
      return null;
  }
}

// --- Main component ---

export default function GlyphPet({
  hash,
  size = 40,
  className = "",
}: {
  hash: string;
  size?: number;
  className?: string;
}) {
  const [excited, setExcited] = useState(false);
  const [petted, setPetted] = useState(false);

  const traits = useMemo(() => {
    const h = hash.replace(/[^a-f0-9]/gi, "").toLowerCase().padEnd(64, "0");

    const paletteIdx = hexPair(h, 0) % PALETTES.length;
    const palette = PALETTES[paletteIdx];
    const bodyIdx = hexAt(h, 2) % BODIES.length;
    const bodyWidth = hexAt(h, 3) % 4;
    const eyeVariant = hexAt(h, 4);
    const mouthVariant = hexAt(h, 5);
    const limbCount = 2 + (hexAt(h, 6) % 4);
    const limbVariant = hexAt(h, 7);
    const accessoryVariant = hexAt(h, 8);
    const bounceSpeed = 1.5 + (hexAt(h, 9) % 6) * 0.3;
    const wobbleAmount = 1 + (hexAt(h, 10) % 4);

    return {
      palette,
      bodyIdx,
      bodyWidth,
      eyeVariant,
      mouthVariant,
      limbCount,
      limbVariant,
      accessoryVariant,
      bounceSpeed,
      wobbleAmount,
    };
  }, [hash]);

  const {
    palette,
    bodyIdx,
    bodyWidth,
    eyeVariant,
    mouthVariant,
    limbCount,
    limbVariant,
    accessoryVariant,
    bounceSpeed,
    wobbleAmount,
  } = traits;

  const bodyPath = BODIES[bodyIdx](bodyWidth);
  const [primary, secondary, dark] = palette;

  const handleClick = () => {
    setPetted(true);
    setTimeout(() => setPetted(false), 600);
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="-5 -10 110 115"
      className={`cursor-pointer select-none ${className}`}
      onMouseEnter={() => setExcited(true)}
      onMouseLeave={() => setExcited(false)}
      onClick={handleClick}
      style={{ overflow: "visible" }}
    >
      {/* Bounce animation on the whole pet */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`0,0;0,${excited ? -4 : -wobbleAmount};0,0`}
          dur={`${excited ? bounceSpeed * 0.5 : bounceSpeed}s`}
          repeatCount="indefinite"
        />

        {/* Pet reaction */}
        {petted && (
          <g>
            {/* Hearts */}
            <text x={-5} y={5} fontSize={12} opacity={0.9}>
              <animate
                attributeName="y"
                values="5;-15"
                dur="0.6s"
                fill="freeze"
              />
              <animate
                attributeName="opacity"
                values="0.9;0"
                dur="0.6s"
                fill="freeze"
              />
              &#x2764;
            </text>
            <text x={80} y={10} fontSize={10} opacity={0.7}>
              <animate
                attributeName="y"
                values="10;-10"
                dur="0.6s"
                fill="freeze"
              />
              <animate
                attributeName="opacity"
                values="0.7;0"
                dur="0.6s"
                fill="freeze"
              />
              &#x2764;
            </text>
          </g>
        )}

        {/* Shadow */}
        <ellipse cx={50} cy={95} rx={20} ry={4} fill="black" opacity={0.15}>
          <animate
            attributeName="rx"
            values={`20;${excited ? 16 : 18};20`}
            dur={`${excited ? bounceSpeed * 0.5 : bounceSpeed}s`}
            repeatCount="indefinite"
          />
        </ellipse>

        {/* Limbs (behind body) */}
        <Limbs
          count={limbCount}
          color={dark}
          variant={limbVariant}
          excited={excited}
        />

        {/* Body */}
        <path d={bodyPath} fill={primary}>
          {/* Wobble */}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 50 50;${excited ? wobbleAmount * 2 : wobbleAmount} 50 50;0 50 50;${excited ? -wobbleAmount * 2 : -wobbleAmount} 50 50;0 50 50`}
            dur={`${excited ? 0.4 : 1.2}s`}
            repeatCount="indefinite"
          />
        </path>

        {/* Body highlight */}
        <ellipse
          cx={42}
          cy={35}
          rx={12}
          ry={8}
          fill="white"
          opacity={0.15}
          transform="rotate(-20 42 35)"
        />

        {/* Eyes */}
        <Eyes
          lx={38}
          ly={42}
          rx={62}
          ry={42}
          variant={eyeVariant}
          color={dark}
          excited={excited}
        />

        {/* Mouth */}
        <Mouth
          cx={50}
          cy={58}
          variant={mouthVariant}
          color={dark}
          excited={excited || petted}
        />

        {/* Accessory */}
        <Accessory variant={accessoryVariant} color={secondary} />

        {/* Squish on pet */}
        {petted && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1.1 0.9;0.95 1.05;1 1"
            dur="0.3s"
            additive="sum"
          />
        )}
      </g>
    </svg>
  );
}
