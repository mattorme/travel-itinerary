import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer data-print-hide className="mt-20 bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="type-display text-[1.75rem] tracking-[-0.04em]">Wayfare</p>
          <p className="mt-2 max-w-xs text-[0.875rem] leading-relaxed text-white/55">
            Day-by-day itineraries built from places that exist, and easy to pass on.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            ['Explore', '/explore'],
            ['Destinations', '/destinations'],
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href as '/explore'}
              className="type-label text-white/60 transition-colors hover:text-paper"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-[0.75rem] text-white/55 sm:px-6">
          © {new Date().getFullYear()} Wayfare
        </p>
      </div>
    </footer>
  );
}
