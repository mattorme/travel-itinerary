import type { CSSProperties } from 'react';

/**
 * Position in a staggered entrance.
 *
 * The `.rise` and `.arc-draw` animations in app/globals.css both read `--i` to
 * work out their delay. Setting a custom property from React needs a cast on
 * every call site, which is four lines of noise for one number — this is that
 * cast, named once.
 */
export function stagger(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
