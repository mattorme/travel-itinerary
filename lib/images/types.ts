/**
 * Editorial imagery.
 *
 * Deliberately separate from Google Place Photos. Place photos are billed per
 * fetch and cannot be copied into our storage, so putting one behind a hero on a
 * page designed to be shared would mean paying per pageview. Heroes come from a
 * licensable source we can hotlink; place photos stay where they earn their
 * cost, on the activity card. See docs/ARCHITECTURE.md §3.3.
 */

export interface ImageCredit {
  readonly author: string;
  readonly authorUrl: string | null;
  readonly source: string;
  readonly sourceUrl: string | null;
}

export interface CoverImage {
  readonly url: string;
  readonly thumbUrl: string | null;
  readonly width: number;
  readonly height: number;
  /** Average colour, used as a placeholder while the image loads. */
  readonly colour: string | null;
  readonly altText: string | null;
  readonly credit: ImageCredit;
  readonly provider: string;
}

export interface ImageQuery {
  /** What the picture should show, in plain language. */
  readonly subject: string;
  /** Extra terms that narrow it — interests, season, style. */
  readonly hints?: readonly string[];
  readonly orientation?: 'landscape' | 'portrait' | 'squarish';
}

export interface ImageProvider {
  readonly name: string;
  search(query: ImageQuery): Promise<CoverImage | null>;
  /**
   * Some providers require a signal when an image is actually used, so the
   * photographer's view count is accurate. Fire-and-forget.
   */
  markUsed?(image: CoverImage): Promise<void>;
}
