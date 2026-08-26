import { AlertTriangle } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/**
 * Shared shell for the legal pages.
 *
 * The review banner is deliberately unmissable and part of the component rather
 * than the content, so it cannot be removed by editing prose. It should come
 * out only when a lawyer has actually signed these off.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="type-display type-title">{title}</h1>
        <p className="mt-2 text-sm text-steel-2">Last updated {updated}</p>

        <div
          role="note"
          className="mt-8 flex gap-3 rounded-panel border border-caution/30 bg-caution/5 px-5 py-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
          <p className="text-steel">
            <strong className="text-ink">Not yet reviewed by a lawyer.</strong> This is an
            accurate, plain-language description of what the product actually does, written from
            the code. It is not a substitute for legal advice and must be reviewed before launch.
          </p>
        </div>

        <div className="mt-10 space-y-8 text-[1.0625rem] leading-relaxed">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="type-display text-xl">{title}</h2>
      {children}
    </section>
  );
}
