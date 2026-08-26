import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';

/**
 * The masthead.
 *
 * Dark, edge to edge, like a departure board above a concourse. It is the one
 * piece of full-strength ink on most pages, which is what stops a
 * predominantly white product reading as a blank document.
 */
export async function SiteHeader() {
  const user = await getSessionUser();
  // An anonymous session is a real auth user, but it is not "signed in" as far
  // as the traveller is concerned — the header must not claim otherwise.
  const signedIn = user !== null && !user.isAnonymous;

  return (
    <header data-print-hide className="sticky top-0 z-40 bg-ink text-paper">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="type-display text-[1.375rem] tracking-[-0.04em]">Wayfare</span>
          <span className="type-label hidden text-[0.5625rem] text-white/60 sm:inline">
            Itineraries
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/explore"
            className="type-label hidden px-3 py-2 text-white/70 transition-colors hover:text-paper sm:block"
          >
            Explore
          </Link>
          <Link
            href="/destinations"
            className="type-label hidden px-3 py-2 text-white/70 transition-colors hover:text-paper md:block"
          >
            Destinations
          </Link>

          {signedIn ? (
            <Link
              href="/me"
              className="type-label px-3 py-2 text-white/70 transition-colors hover:text-paper"
            >
              My trips
            </Link>
          ) : (
            <Link
              href="/signin"
              className="type-label px-3 py-2 text-white/70 transition-colors hover:text-paper"
            >
              Sign in
            </Link>
          )}

          <Link href="/plan" className="ml-1">
            <Button variant="signal" size="sm">
              Plan a trip
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
