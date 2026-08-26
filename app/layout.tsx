import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import { publicEnv } from '@/lib/public-env';
import { BRAND_FROM } from '@/lib/brand';
import { NativeShell } from '@/components/native-shell';
import './globals.css';

/**
 * Plus Jakarta Sans — the display face.
 *
 * A geometric sans with slightly humanist proportions: confident at 800 without
 * turning severe, which is the exact register this product wants. Set tight —
 * see `.type-display`.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

/** Inter — interface, body, and every figure. Its tabular numerals are why the
 *  product needs no monospace at all. */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: 'Wayfare: itineraries worth sharing',
    template: '%s · Wayfare',
  },
  description:
    'Say where you are going and how you like to travel. Get a day-by-day itinerary with the times already on it, then share it and let other people make it theirs.',
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
  themeColor: BRAND_FROM,
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
    <html lang="en" className={`${jakarta.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">
        <NativeShell />
        {children}
      </body>
    </html>
  );
}
