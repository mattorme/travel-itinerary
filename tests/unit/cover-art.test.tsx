import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoverArt } from '@/components/ui/cover-art';
import { dayColour, DAY_COLOURS } from '@/components/trip/map/types';

/**
 * Cover art has to be deterministic. A trip that changes appearance between
 * renders looks broken, and server and client markup that disagree is a
 * hydration error.
 */
describe('CoverArt', () => {
  it('renders identically for the same seed', () => {
    const a = renderToStaticMarkup(<CoverArt seed="tokyo-jp" label="Tokyo" />);
    const b = renderToStaticMarkup(<CoverArt seed="tokyo-jp" label="Tokyo" />);
    expect(a).toBe(b);
  });

  it('renders differently for different seeds', () => {
    const tokyo = renderToStaticMarkup(<CoverArt seed="tokyo-jp" label="Tokyo" />);
    const lisbon = renderToStaticMarkup(<CoverArt seed="lisbon-pt" label="Lisbon" />);
    expect(tokyo).not.toBe(lisbon);
  });

  it('is labelled for screen readers', () => {
    const markup = renderToStaticMarkup(<CoverArt seed="x" label="Mexico City" />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('<title');
    expect(markup).toContain('Mexico City');
  });

  it('shows the destination name only when asked', () => {
    const plain = renderToStaticMarkup(<CoverArt seed="x" label="Rome" />);
    const labelled = renderToStaticMarkup(<CoverArt seed="x" label="Rome" showLabel />);
    expect(plain).not.toContain('<text');
    expect(labelled).toContain('<text');
  });

  it('never emits NaN coordinates, whatever the seed', () => {
    // A malformed path silently renders nothing, which would look like a bug
    // only on certain destinations.
    for (const seed of ['', 'a', 'a very long destination name indeed', '東京', '123']) {
      const markup = renderToStaticMarkup(<CoverArt seed={seed} label={seed || 'x'} />);
      expect(markup).not.toContain('NaN');
    }
  });

  it('keeps the route inside the frame', () => {
    const markup = renderToStaticMarkup(<CoverArt seed="frame-check" label="x" />);
    const circles = [...markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)];
    expect(circles.length).toBeGreaterThan(0);
    for (const [, cx, cy] of circles) {
      expect(Number(cx)).toBeGreaterThan(0);
      expect(Number(cx)).toBeLessThan(800);
      expect(Number(cy)).toBeGreaterThan(0);
      expect(Number(cy)).toBeLessThan(500);
    }
  });
});

describe('day colours', () => {
  it('gives each day in a normal trip a distinct colour', () => {
    const colours = Array.from({ length: 8 }, (_, i) => dayColour(i + 1));
    expect(new Set(colours).size).toBe(8);
  });

  it('cycles rather than running out on a long trip', () => {
    expect(dayColour(9)).toBe(dayColour(1));
    expect(dayColour(30)).toBe(DAY_COLOURS[(30 - 1) % DAY_COLOURS.length]);
  });
});
