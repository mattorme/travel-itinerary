import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SignInForm } from '@/components/auth/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-5 py-12">
        <h1 className="type-display type-title">Save your trips</h1>
        <p className="mt-3 text-steel">
          No password. We&apos;ll email you a link. Anything you&apos;ve already planned comes
          with you.
        </p>
        <SignInForm nextPath={typeof next === 'string' ? next : '/me'} />
      </main>
    </>
  );
}
