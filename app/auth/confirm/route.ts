import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/db/supabase/server';

/** Magic-link / email-change return leg. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  const next = safeNext(params.get('next'));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/signin?error=invalid_link', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(new URL('/signin?error=expired_link', request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}

function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/me';
  return next;
}
