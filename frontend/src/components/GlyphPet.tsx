import { useMemo } from "react";

/**
 * GlyphPet — 16x16 animated pixel creature that evolves through betting.
 *
 * 5 components: head, eyes, mouth, ears, penis — driven by genome.
 * Headwear unlocked by milestones: every 5 bets, every 5 wins, beer count.
 * Idle bounce animation via CSS.
 */

function hexAt(hash: string, i: number): number {
  return parseInt(hash[i % hash.length], 16);
}

const C = {
  // Skin tones
  skin: ["#ffcc99", "#f4a460", "#deb887", "#d2b48c", "#c68642", "#8d5524", "#ffdbac", "#e0ac69",
         "#f1c27d", "#ffd699", "#cc9966", "#bb8855", "#eebb88", "#ddaa77", "#cc8866", "#ffccaa"],
  // Feature colors
  feat: ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560", "#2d4059", "#222831", "#393e46",
         "#4a0e4e", "#150050", "#3f0071", "#610094", "#1b1a17", "#0f0e0e", "#2c2c2c", "#444444"],
  // Bright colors for accessories
  acc: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4",
        "#f43f5e", "#14b8a6", "#84cc16", "#a855f7", "#fb923c", "#d946ef", "#6366f1", "#2dd4bf"],
  // Headwear colors (increasingly cool)
  hat: ["#9ca3af", "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#f97316", "#ef4444", "#22d3ee",
        "#34d399", "#c084fc", "#fb7185", "#facc15", "#e879f9", "#38bdf8", "#4ade80", "#f59e0b"],
};

type Px = [number, number];

// HEADS — clear round/square faces occupying rows 2-8
const HEADS: { pixels: Px[]; faceY: number }[] = [
  { // round
    pixels: [[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
             [4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],
             [4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],
             [4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],
             [4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],
             [4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],
             [5,8],[6,8],[7,8],[8,8],[9,8],[10,8]],
    faceY: 4,
  },
  { // square
    pixels: [[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],
             [4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],
             [4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],
             [4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],
             [4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],
             [4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],
             [4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8]],
    faceY: 4,
  },
  { // tall oval
    pixels: [[6,1],[7,1],[8,1],[9,1],
             [5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
             [4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],
             [4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],
             [4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],
             [4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],
             [4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],
             [5,8],[6,8],[7,8],[8,8],[9,8],[10,8]],
    faceY: 4,
  },
  { // wide
    pixels: [[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],
             [3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[12,4],
             [3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],
             [3,6],[4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],[12,6],
             [4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],
             [5,8],[6,8],[7,8],[8,8],[9,8],[10,8]],
    faceY: 5,
  },
];

// EYES — relative to faceY (row 0 = faceY, row 1 = faceY+1)
const EYES: { pixels: Px[]; }[] = [
  { pixels: [[6,0],[9,0]] },                                          // dots
  { pixels: [[5,0],[6,0],[9,0],[10,0]] },                             // wide
  { pixels: [[6,-1],[6,0],[9,-1],[9,0]] },                            // tall
  { pixels: [[5,-1],[6,-1],[5,0],[6,0],[9,-1],[10,-1],[9,0],[10,0]] }, // big
  { pixels: [[5,0],[6,0],[7,0],[8,0],[9,0],[10,0]] },                 // visor
  { pixels: [[6,0],[9,0],[6,1],[9,1]] },                              // droopy
  { pixels: [[5,0],[6,0],[10,0],[11,0]] },                            // far apart
  { pixels: [[6,-1],[6,0],[6,1],[9,-1],[9,0],[9,1]] },                // vertical
];

// MOUTHS — relative to faceY+2
const MOUTHS: { pixels: Px[]; }[] = [
  { pixels: [[7,0],[8,0]] },                                // small
  { pixels: [[6,0],[7,0],[8,0],[9,0]] },                    // wide smile
  { pixels: [[7,0],[8,0],[6,1],[9,1]] },                    // frown
  { pixels: [[7,0],[8,0],[7,1],[8,1]] },                    // open
  { pixels: [[6,0],[7,0],[8,0],[9,0],[6,1],[9,1]] },        // grin
  { pixels: [[7,0]] },                                      // dot
  { pixels: [[6,0],[7,1],[8,0],[9,1]] },                    // wavy
  { pixels: [[6,0],[7,0],[8,0],[9,0],[7,1],[8,1]] },        // tongue
];

// EARS — absolute positions on sides of head
const EARS_L: Px[][] = [
  [[3,4],[3,5]],                   // round
  [[3,3],[3,4]],                   // pointy up
  [[3,5],[3,6],[3,7]],             // droopy
  [[2,3],[3,3],[2,4],[3,4]],       // wide
  [[3,2],[3,3]],                   // antenna
  [[2,4],[3,4],[2,5],[3,5]],       // flaps
  [[3,3],[2,4],[3,5]],             // curved
  [[2,3],[3,3],[3,4]],             // wing
];

// PENIS — below body, rows 9-13
const PENISES: Px[][] = [
  [[7,9],[8,9],[7,10],[8,10]],
  [[7,9],[8,9],[7,10],[8,10],[7,11],[8,11]],
  [[7,9],[8,9],[7,10],[8,10],[7,11],[8,11],[7,12],[8,12]],
  [[6,9],[7,9],[8,9],[9,9],[7,10],[8,10]],
  [[7,9],[8,9],[8,10],[9,10],[9,11],[10,11]],
  [[7,9],[8,9],[6,10],[7,10],[5,11],[6,11]],
  [[6,9],[7,9],[8,9],[9,9],[7,10],[8,10],[7,11],[8,11]],
  [[7,9],[8,9],[7,10],[8,10],[6,11],[7,11],[8,11],[9,11]],
];

// HEADWEAR — rows 0-2, unlocked by milestones
const HEADWEAR: { pixels: Px[]; minTier: number }[] = [
  // tier 0: nothing
  { pixels: [], minTier: 0 },
  // tier 1 (5 bets): simple cap
  { pixels: [[5,1],[6,1],[7,1],[8,1],[9,1],[10,1]], minTier: 1 },
  // tier 2 (10 bets): beanie
  { pixels: [[7,0],[8,0],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1]], minTier: 2 },
  // tier 3 (5 wins): crown
  { pixels: [[5,0],[7,0],[9,0],[11,0],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1]], minTier: 3 },
  // tier 4 (10 wins): tall crown
  { pixels: [[5,0],[8,0],[11,0],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1]], minTier: 4 },
  // tier 5 (15+ beers): halo
  { pixels: [[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[4,1],[11,1]], minTier: 5 },
  // tier 6 (20+ beers): flame crown
  { pixels: [[5,-1],[8,-1],[11,-1],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1]], minTier: 6 },
  // tier 7 (25+ beers): legendary aura
  { pixels: [[4,-1],[5,-1],[6,-1],[7,-1],[8,-1],[9,-1],[10,-1],[11,-1],[12,-1],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[13,0],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1]], minTier: 7 },
];

function computeHatTier(bets: number, wins: number, beers: number): number {
  let tier = 0;
  if (bets >= 5) tier = 1;
  if (bets >= 10) tier = 2;
  if (wins >= 5) tier = 3;
  if (wins >= 10) tier = 4;
  if (beers >= 15) tier = Math.max(tier, 5);
  if (beers >= 20) tier = Math.max(tier, 6);
  if (beers >= 25) tier = Math.max(tier, 7);
  return tier;
}

export interface PetStats {
  bets: number;
  wins: number;
  beers: number;
}

export default function GlyphPet({
  hash,
  seed = 0,
  genome,
  stats,
  size = 40,
  className = "",
}: {
  hash: string;
  seed?: number;
  genome?: string;
  stats?: PetStats;
  size?: number;
  className?: string;
}) {
  const pixels = useMemo(() => {
    // Use genome if available, otherwise hash
    const g = (genome || hash).replace(/[^a-f0-9]/gi, "").toLowerCase().padEnd(64, "0");
    // Mix in seed
    const s = seed;

    const headIdx = (hexAt(g, 0) + s) % HEADS.length;
    const skinColor = C.skin[(hexAt(g, 1) + s) % 16];
    const eyeIdx = (hexAt(g, 2) + s) % EYES.length;
    const eyeColor = C.feat[(hexAt(g, 3) + s) % 16];
    const mouthIdx = (hexAt(g, 4) + s) % MOUTHS.length;
    const mouthColor = C.feat[(hexAt(g, 5) + s) % 16];
    const earIdx = (hexAt(g, 6) + s) % EARS_L.length;
    const earColor = C.acc[(hexAt(g, 7) + s) % 16];
    const penisIdx = (hexAt(g, 8) + s) % PENISES.length;
    const penisColor = C.skin[(hexAt(g, 9) + s) % 16];

    const head = HEADS[headIdx];
    const faceY = head.faceY;

    const result: { x: number; y: number; color: string }[] = [];

    // Body/neck (rows 8-9, always present)
    for (const [x, y] of [[6,9],[7,9],[8,9],[9,9]] as Px[]) {
      result.push({ x, y, color: skinColor });
    }

    // Head
    for (const [x, y] of head.pixels) result.push({ x, y, color: skinColor });

    // Ears (mirrored)
    const earL = EARS_L[earIdx];
    for (const [x, y] of earL) result.push({ x, y, color: earColor });
    for (const [x, y] of earL) result.push({ x: 15 - x, y, color: earColor });

    // Penis
    for (const [x, y] of PENISES[penisIdx]) result.push({ x, y, color: penisColor });

    // Eyes (positioned relative to face)
    for (const [x, dy] of EYES[eyeIdx].pixels) {
      result.push({ x, y: faceY + dy, color: eyeColor });
    }

    // Mouth (positioned relative to face + 2)
    for (const [x, dy] of MOUTHS[mouthIdx].pixels) {
      result.push({ x, y: faceY + 2 + dy, color: mouthColor });
    }

    // Headwear
    const st = stats ?? { bets: 0, wins: 0, beers: 10 };
    const tier = computeHatTier(st.bets, st.wins, st.beers);
    if (tier > 0) {
      // Find best headwear for this tier
      const hat = [...HEADWEAR].reverse().find(h => h.minTier <= tier) ?? HEADWEAR[0];
      const hatColor = C.hat[(hexAt(g, 10) + tier) % 16];
      const hatAccent = C.hat[(hexAt(g, 11) + tier + 4) % 16];
      for (let i = 0; i < hat.pixels.length; i++) {
        const [x, y] = hat.pixels[i];
        result.push({ x, y, color: i % 3 === 0 ? hatAccent : hatColor });
      }
    }

    return result;
  }, [hash, seed, genome, stats]);

  // Animation: gentle bounce
  const animStyle = `
    @keyframes glyph-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-1px); }
    }
  `;

  return (
    <div
      className={`inline-block ${className}`}
      style={{ animation: "glyph-bounce 1.5s ease-in-out infinite", width: size, height: size }}
    >
      <style>{animStyle}</style>
      <svg
        width={size}
        height={size}
        viewBox="-1 -2 18 18"
        style={{ imageRendering: "pixelated" }}
        shapeRendering="crispEdges"
      >
        {pixels.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.color} />
        ))}
      </svg>
    </div>
  );
}
