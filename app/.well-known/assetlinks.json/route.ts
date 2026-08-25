import { NextResponse } from 'next/server';

/**
 * Android app links.
 *
 * The SHA-256 fingerprint is of the signing certificate that actually ships the
 * app — Play App Signing gives you a different one from your upload key, and
 * using the wrong one is the usual reason app links silently fall back to the
 * browser.
 */
export const dynamic = 'force-static';

const PACKAGE = process.env.ANDROID_PACKAGE ?? 'app.wayfare.mobile';
const FINGERPRINT = process.env.ANDROID_CERT_SHA256 ?? '';

export function GET(): NextResponse {
  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: PACKAGE,
          sha256_cert_fingerprints: FINGERPRINT ? [FINGERPRINT] : [],
        },
      },
    ],
    { headers: { 'Content-Type': 'application/json' } },
  );
}
