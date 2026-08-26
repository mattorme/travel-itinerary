import type { Metadata, Viewport } from 'next';
import { Archivo, DM_Mono } from 'next/font/google';
import { publicEnv } from '@/lib/public-env';
import { NativeShell } from '@/components/native-shell';
import './globals.css';

/**
 * Archivo, with its width axis available.
 *
 * A grotesque rather than a serif, because the product's visual language is
 * transit signage. The width axis is what makes the display type read as a
 * station board instead of a generic sans — see `.type-display`.
 */
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
  axes: ['wdth'],
});

/** Timetable numerals: times, distances, prices. */
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-dm-mono',
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
  themeColor: '#111316',
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
    <html lang="en" className={`${archivo.variable} ${dmMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <NativeShell />
        {children}
      </body>
    </html>
  );
}
