import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer data-print-hide className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Wayfare</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/explore" className="hover:text-ink">Explore</Link>
          <Link href="/destinations" className="hover:text-ink">Destinations</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
