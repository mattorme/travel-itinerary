import { NextResponse, type NextRequest } from 'next/server';
import { autocompleteDestination } from '@/lib/google/places/client';
import { recordApiUsage } from '@/lib/observability/usage';
import { checkLimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/utils/request';

export const runtime = 'nodejs';

/**
 * Server-side proxy for Places Autocomplete.
 *
 * The Maps key never reaches the browser, and the session token means a whole
 * typing session bills as one lookup rather than one per keystroke.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const session = request.nextUrl.searchParams.get('session') ?? '';

  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const limit = await checkLimit('autocomplete', clientIp(request));
  if (!limit.allowed) {
    return NextResponse.json({ suggestions: [] }, { status: 429 });
  }

  try {
    const suggestions = await autocompleteDestination(query, session);
    await recordApiUsage({ provider: 'google_places', sku: 'places.autocomplete', units: 1 });
    return NextResponse.json({ suggestions });
  } catch (error) {
    // A dead autocomplete must not block the wizard — the user can type freehand.
    console.warn('[autocomplete] failed', error);
    return NextResponse.json({ suggestions: [] });
  }
}
