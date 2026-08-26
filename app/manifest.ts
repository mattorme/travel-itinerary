import type { MetadataRoute } from 'next';
import { BRAND_FROM } from '@/lib/brand';

/**
 * Web app manifest.
 *
 * Makes the site installable from a browser, which matters for the people the
 * native shell will never reach — Android users who never open a store, desktop
 * users, and anyone who taps "Add to Home Screen" from a shared link.
 *
 * The shortcuts are the two things someone opens the app to do. They appear on
 * a long-press of the icon, and they are the cheapest possible retention
 * feature.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wayfare: itineraries worth sharing',
    short_name: 'Wayfare',
    description:
      'Day-by-day travel itineraries with the times filled in, and easy to share.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f7fb',
    theme_color: BRAND_FROM,
    categories: ['travel', 'lifestyle', 'navigation'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Plan a trip', short_name: 'Plan', url: '/plan' },
      { name: 'My trips', short_name: 'Trips', url: '/me' },
    ],
  };
}
