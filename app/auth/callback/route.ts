import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/db/supabase/server';

/** OAuth return leg: exchange the code for a session cookie. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNext(request.nextUrl.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/signin?error=missing_code', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/signin?error=exchange_failed', request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}

/** Never redirect to an absolute URL supplied in a query string. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/me';
  return next;
}
