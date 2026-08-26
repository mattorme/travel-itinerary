import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

export function SiteFooter() {
  return (
    <footer data-print-hide className="mt-24 border-t border-rule bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-steel">
            Day-by-day itineraries built from places that exist, and easy to pass on.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-10 gap-y-3">
          {[
            ['Explore', '/explore'],
            ['Destinations', '/destinations'],
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href as '/explore'}
              className="text-[0.875rem] font-medium text-steel transition-colors hover:text-signal"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-rule">
        <p className="mx-auto max-w-6xl px-4 py-5 text-[0.8125rem] text-steel-2 sm:px-6">
          © {new Date().getFullYear()} Wayfare
        </p>
      </div>
    </footer>
  );
}
