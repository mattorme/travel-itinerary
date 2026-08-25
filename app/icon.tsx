import { ImageResponse } from 'next/og';

/**
 * The app icon, generated rather than a checked-in PNG.
 *
 * One source of truth with the rest of the brand: the same ink and accent as
 * the product, and the same irregular contour motif the generated trip covers
 * use — perfect circles read as a bullseye, which says nothing about travel.
 *
 * Everything sits inside the middle 80% because the manifest also declares this
 * maskable, and Android crops to a shape it chooses. Content outside the safe
 * zone is content you cannot rely on.
 */
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

const CENTRE = 256;

/** Same wobble as components/ui/cover-art.tsx, so the two read as one family. */
function contour(radius: number, phase: number): string {
  const points: string[] = [];
  for (let step = 0; step <= 64; step++) {
    const angle = (step / 64) * Math.PI * 2;
    const wobble =
      1 + Math.sin(angle * 3 + phase) * 0.1 + Math.sin(angle * 5 + phase * 1.6) * 0.05;
    const x = CENTRE + Math.cos(angle) * radius * wobble;
    const y = CENTRE + Math.sin(angle) * radius * wobble * 0.94;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export default function Icon() {
  // Outermost ring stays within the maskable safe zone.
  const rings = [190, 152, 114, 76, 40];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#17150f',
        }}
      >
        <svg width={512} height={512} viewBox="0 0 512 512">
          {rings.map((radius, i) => (
            <polyline
              key={radius}
              points={contour(radius, i * 0.9)}
              fill="none"
              stroke="#c2410c"
              strokeWidth={i === rings.length - 1 ? 16 : 8}
              strokeLinejoin="round"
              opacity={0.4 + i * 0.15}
            />
          ))}
          <circle cx={CENTRE} cy={CENTRE} r={20} fill="#fdfbf7" />
        </svg>
      </div>
    ),
    size,
  );
}
