import { ImageResponse } from 'next/og';

/**
 * The app icon.
 *
 * The day arc, at its smallest useful size: three bars, morning through
 * evening, on the same indigo as the masthead. It is the product's one graphic
 * idea reduced until only the idea is left — and unlike a contour or a pin, it
 * is not something every other travel app already uses.
 *
 * Everything sits inside the middle 80% because the manifest also declares this
 * maskable, and Android crops to a shape it chooses. Content outside the safe
 * zone is content you cannot rely on.
 */
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** Widths in the same 3 : 2 : 2 proportion the wordmark's mark uses. */
const BARS = [
  { colour: '#f2a65a', flex: 3 },
  { colour: '#5fd0c4', flex: 2 },
  { colour: '#f2867a', flex: 2 },
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
          background: '#141b34',
        }}
      >
        <div style={{ display: 'flex', width: 320, height: 76, gap: 22 }}>
          {BARS.map((bar) => (
            <div
              key={bar.colour}
              style={{
                display: 'flex',
                flex: bar.flex,
                borderRadius: 38,
                background: bar.colour,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
