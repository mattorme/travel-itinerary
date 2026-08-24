import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { publicEnv } from '@/lib/public-env';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#fdfbf7',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
