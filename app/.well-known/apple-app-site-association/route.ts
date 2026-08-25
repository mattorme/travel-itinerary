import { NextResponse } from 'next/server';

/**
 * Apple universal links.
 *
 * Served by the web app rather than uploaded as a static file, so that the
 * association travels with the same deploy as everything else — there is one
 * place to change the bundle id and one deploy to make it live.
 *
 * Apple requires this at the site root, over HTTPS, with no redirect, and with
 * an application/json content type. A trailing `.json` extension is NOT allowed.
 */
export const dynamic = 'force-static';

const APP_ID = process.env.APPLE_APP_ID ?? 'TEAMID.app.wayfare.mobile';

export function GET(): NextResponse {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [APP_ID],
            components: [
              // Shared trip links open the app; everything else stays in the
              // browser, including auth callbacks which must not be hijacked.
              { '/': '/t/*', comment: 'Shared trips' },
              { '/': '/u/*', comment: 'Creator profiles' },
              { '/': '/destinations/*', comment: 'Destination hubs' },
              { '/': '/auth/*', exclude: true, comment: 'Auth callbacks stay in the browser' },
            ],
          },
        ],
      },
    },
    { headers: { 'Content-Type': 'application/json' } },
  );
}
