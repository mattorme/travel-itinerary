import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';

export async function SiteHeader() {
  const user = await getSessionUser();
  // An anonymous session is a real auth user, but it is not "signed in" as far
  // as the traveller is concerned — the header must not claim otherwise.
  const signedIn = user !== null && !user.isAnonymous;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="font-display text-xl tracking-tight">
          Wayfare
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/explore" className="hidden px-3 py-2 text-sm text-ink-muted hover:text-ink sm:block">
            Explore
          </Link>
          {signedIn ? (
            <Link href="/me">
              <Button variant="outline" size="sm">My trips</Button>
            </Link>
          ) : (
            <Link href="/signin">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
          )}
          <Link href="/plan">
            <Button variant="primary" size="sm">Plan a trip</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
