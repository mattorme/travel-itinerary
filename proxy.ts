import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/db/supabase/middleware';

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Public trip pages are
     * included on purpose: a logged-out visitor who clones needs a session
     * cookie to already be rotating.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
