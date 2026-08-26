import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

/**
 * The masthead.
 *
 * White and translucent over whatever scrolls beneath it, held down by a
 * hairline rather than a border. The only saturated thing in it is the mark and
 * the one button worth pressing.
 */
export async function SiteHeader() {
  const user = await getSessionUser();
  // An anonymous session is a real auth user, but it is not "signed in" as far
  // as the traveller is concerned — the header must not claim otherwise.
  const signedIn = user !== null && !user.isAnonymous;

  return (
    <header
      data-print-hide
      className="sticky top-0 z-40 border-b border-rule/70 bg-surface/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-18 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/explore"
            className="hidden rounded-edge px-3 py-2 text-[0.875rem] font-medium text-steel transition-colors hover:bg-signal-wash hover:text-signal sm:block"
          >
            Explore
          </Link>
          <Link
            href="/destinations"
            className="hidden rounded-edge px-3 py-2 text-[0.875rem] font-medium text-steel transition-colors hover:bg-signal-wash hover:text-signal md:block"
          >
            Destinations
          </Link>
          <Link
            href={signedIn ? '/me' : '/signin'}
            className="rounded-edge px-3 py-2 text-[0.875rem] font-medium text-steel transition-colors hover:bg-signal-wash hover:text-signal"
          >
            {signedIn ? 'My trips' : 'Sign in'}
          </Link>

          <Link href="/plan" className="ml-2">
            <Button variant="signal" size="sm">
              Plan a trip
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
