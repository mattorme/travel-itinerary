import { ImageResponse } from 'next/og';

/**
 * The app icon.
 *
 * The same mark as the masthead: three bars of the day arc on the brand
 * gradient. It is the product's one graphic idea reduced until only the idea is
 * left — and unlike a pin or a globe, it is not what every other travel app
 * already uses.
 *
 * Everything sits inside the middle 80% because the manifest also declares this
 * maskable, and Android crops to a shape it chooses. Content outside the safe
 * zone is content you cannot rely on.
 */
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

const BARS = [
  { height: 224, opacity: 0.95 },
  { height: 150, opacity: 0.7 },
  { height: 280, opacity: 0.95 },
];

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 26,
          backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        }}
      >
        {BARS.map((bar, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              width: 46,
              height: bar.height,
              borderRadius: 23,
              background: `rgba(255,255,255,${bar.opacity})`,
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
