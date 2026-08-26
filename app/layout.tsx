import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import { publicEnv } from '@/lib/public-env';
import { NativeShell } from '@/components/native-shell';
import './globals.css';

/**
 * Bricolage Grotesque — the display face.
 *
 * A grotesque with slightly irregular, hand-cut terminals: warm at large sizes
 * where a neutral sans would read as anonymous. The width axis is what lets
 * headlines set dense rather than airy — see `.type-display`.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
  axes: ['opsz', 'wdth'],
});

/** Figtree — body, interface, and every figure. Its tabular numerals are why
 *  the product needs no monospace at all. */
const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: 'Wayfare — itineraries worth sharing',
    template: '%s · Wayfare',
  },
  description:
    'Tell us where you are going. Get a real, day-by-day itinerary built from places that actually exist — then share it, and let other people make it theirs.',
  openGraph: {
    type: 'website',
    siteName: 'Wayfare',
    locale: 'en_AU',
  },
  twitter: { card: 'summary_large_image' },
  // Installable from a browser, for everyone the native shell will not reach.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Wayfare',
    statusBarStyle: 'default',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#141b34',
  width: 'device-width',
  initialScale: 1,
  // Required for env(safe-area-inset-*) to report real values inside the app.
  viewportFit: 'cover',
  // The app is a webview; a pinch-zoom there feels broken rather than helpful.
  // Left enabled on the web, where zoom is an accessibility affordance.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`}>
      <body className="min-h-dvh antialiased">
        <NativeShell />
        {children}
      </body>
    </html>
  );
}
