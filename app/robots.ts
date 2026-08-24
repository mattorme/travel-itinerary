import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/public-env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /t/ is not blanket-disallowed: individual pages carry their own
        // noindex until they earn indexability, and blocking the path would
        // stop a crawler ever seeing that they had.
        disallow: ['/api/', '/trips/', '/me', '/signin', '/auth/', '/plan'],
      },
    ],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
