import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';

/**
 * The masthead.
 *
 * Indigo, edge to edge — the same indigo as the last band of the day, so the
 * chrome belongs to the arc rather than sitting on top of it. It is the one
 * piece of full-strength colour on most pages, which is what stops a
 * predominantly white product reading as a blank document.
 */
export async function SiteHeader() {
  const user = await getSessionUser();
  // An anonymous session is a real auth user, but it is not "signed in" as far
  // as the traveller is concerned — the header must not claim otherwise.
  const signedIn = user !== null && !user.isAnonymous;

  return (
    <header data-print-hide className="sticky top-0 z-40 bg-ink text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap">
          {/* The arc, three hours wide: the product's mark is its diagram. */}
          <span aria-hidden className="flex h-3 w-6 items-center gap-[3px]">
            <span className="h-1.5 flex-[3] rounded-full bg-morning" />
            <span className="h-1.5 flex-[2] rounded-full bg-afternoon" />
            <span className="h-1.5 flex-[2] rounded-full bg-evening" />
          </span>
          <span className="type-display text-[1.4375rem]">Wayfare</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/explore"
            className="type-label hidden px-3 py-2 text-white/70 transition-colors hover:text-white sm:block"
          >
            Explore
          </Link>
          <Link
            href="/destinations"
            className="type-label hidden px-3 py-2 text-white/70 transition-colors hover:text-white md:block"
          >
            Destinations
          </Link>

          {signedIn ? (
            <Link
              href="/me"
              className="type-label px-3 py-2 text-white/70 transition-colors hover:text-white"
            >
              My trips
            </Link>
          ) : (
            <Link
              href="/signin"
              className="type-label px-3 py-2 text-white/70 transition-colors hover:text-white"
            >
              Sign in
            </Link>
          )}

          <Link href="/plan" className="ml-1.5">
            <Button variant="signal" size="sm">
              Plan a trip
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
