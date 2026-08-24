import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="font-display text-display-sm">Terms</h1>
        {/* TEMPORARY: placeholder. This is linked from the footer of every page
            and must be written before any public launch. */}
        <p className="mt-6 text-ink-muted">This page has not been written yet.</p>
      </main>
      <SiteFooter />
    </>
  );
}
