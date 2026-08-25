import { cn } from '@/lib/utils/cn';

/**
 * Generated cover art.
 *
 * Shown when there is no photograph — no Unsplash key, a search that found
 * nothing, or a destination nobody has curated yet. A grey box would make the
 * product look broken on exactly the page that has to make a good first
 * impression, so this draws something instead.
 *
 * Deterministic: the same destination always gets the same artwork, so a trip
 * does not change appearance between renders. Pure SVG — no network, no cost,
 * no layout shift, and it renders before JavaScript.
 *
 * The contour motif is a topographic map, which is thematically right and
 * happens to be legible at both card and hero sizes.
 */

/** FNV-1a. Small, fast, and stable across runtimes — which matters here. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10_000) / 10_000;
  };
}

/**
 * Warm, low-saturation pairs. Constrained on purpose: a random hue would
 * eventually produce something that clashes with the accent, and the covers
 * need to look like a set when six of them sit in a grid.
 */
const PALETTES: readonly { bg: string; line: string; wash: string; route: string }[] = [
  { bg: '#EFE4D2', line: '#A8471A', wash: '#DFCBAA', route: '#7A2E0E' },
  { bg: '#E3E8DC', line: '#2F5A45', wash: '#CBD6C0', route: '#1E3B2C' },
  { bg: '#EDDFD8', line: '#7E3A2E', wash: '#DCC2B6', route: '#552218' },
  { bg: '#DFE6EE', line: '#274465', wash: '#C4D2E1', route: '#17293E' },
  { bg: '#EDE5CE', line: '#6B561A', wash: '#DCCFA6', route: '#463710' },
  { bg: '#E8DFE8', line: '#513457', wash: '#D3C2D5', route: '#332037' },
];

export function CoverArt({
  seed,
  label,
  className,
  showLabel = false,
}: {
  /** Anything stable — a destination name or a trip slug. */
  seed: string;
  /** Rendered into the SVG title for screen readers. */
  label: string;
  className?: string;
  showLabel?: boolean;
}) {
  const h = hash(seed);
  const random = makeRandom(h);
  const palette = PALETTES[h % PALETTES.length] as (typeof PALETTES)[number];

  const width = 800;
  const height = 500;

  // Nested contour rings around an off-centre focal point, each one nudged so
  // the set reads as terrain rather than as a target.
  const focusX = width * (0.28 + random() * 0.44);
  const focusY = height * (0.34 + random() * 0.36);
  const rings = 9;

  const paths: string[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const radius = 34 + ring * 34;
    const points: string[] = [];
    const steps = 44;
    for (let step = 0; step <= steps; step++) {
      const angle = (step / steps) * Math.PI * 2;
      // Two out-of-phase harmonics give an organic outline without noise.
      const wobble =
        1 +
        Math.sin(angle * 3 + ring * 0.7) * 0.11 +
        Math.sin(angle * 5 + ring * 1.3) * 0.06;
      const x = focusX + Math.cos(angle) * radius * wobble * 1.35;
      const y = focusY + Math.sin(angle) * radius * wobble;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    paths.push(points.join(' '));
  }

  // Three stops wandering left to right, jittered by the same seed so the route
  // differs per destination but never doubles back or leaves the frame.
  const route = [0.18, 0.5, 0.82].map((t, index) => ({
    x: width * (t + (random() - 0.5) * 0.06),
    y: height * (0.3 + random() * 0.42 + (index % 2 === 0 ? -0.04 : 0.04)),
  }));

  const titleId = `cover-${h.toString(36)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-labelledby={titleId}
      className={cn('h-full w-full', className)}
    >
      <title id={titleId}>{label}</title>
      <rect width={width} height={height} fill={palette.bg} />

      {/* A soft wash behind the contours so the flat fill does not read as a
          placeholder. */}
      <ellipse
        cx={focusX}
        cy={focusY}
        rx={width * 0.58}
        ry={height * 0.54}
        fill={palette.wash}
        opacity="0.9"
      />

      <g fill="none" stroke={palette.line} strokeLinejoin="round">
        {paths.map((points, index) => (
          <polyline
            key={index}
            points={points}
            strokeWidth={index === 0 ? 2.6 : 1.5}
            opacity={0.72 - index * 0.055}
          />
        ))}
      </g>

      {/* A route across the terrain: three stops joined by a dashed line, which
          is the same visual language the itinerary map uses. Without it the
          contours read as wood grain rather than as travel. */}
      <g>
        <polyline
          points={route.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke={palette.route}
          strokeWidth="2.6"
          strokeDasharray="1 11"
          strokeLinecap="round"
          opacity="0.85"
        />
        {route.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === 0 ? 8 : 6}
            fill={palette.route}
            stroke={palette.bg}
            strokeWidth="3"
          />
        ))}
      </g>

      {showLabel && (
        <text
          x="40"
          y={height - 40}
          fill={palette.route}
          opacity="0.85"
          fontSize="34"
          fontFamily="Georgia, serif"
          letterSpacing="1"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
