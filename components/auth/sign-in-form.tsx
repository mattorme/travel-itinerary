'use client';

import { useState } from 'react';
import { Check, Loader2, Mail } from 'lucide-react';
import { createClient } from '@/lib/db/supabase/browser';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

/**
 * Email OTP and Google OAuth. No password field — fewer support tickets, fewer
 * breach vectors, better conversion.
 *
 * The important detail is the anonymous branch: attaching an email or linking an
 * identity upgrades the existing anonymous account in place rather than creating
 * a second one, so trips planned before signing up are already owned by the
 * account that ends up existing. No claim tokens, no orphan rows.
 */
export function SignInForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: authError } = user?.is_anonymous
      ? await supabase.auth.updateUser({ email })
      : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });

    if (authError) {
      setError(
        authError.message.toLowerCase().includes('rate')
          ? 'Too many attempts. Please wait a minute and try again.'
          : 'We could not send that email. Check the address and try again.',
      );
      setState('idle');
      return;
    }

    setState('sent');
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.is_anonymous) {
      await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      return;
    }
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  if (state === 'sent') {
    return (
      <div className="mt-8 rounded-panel border border-rule bg-surface p-6 text-center">
        <Check className="mx-auto size-6 text-positive" />
        <p className="mt-3 type-display text-lg">Check your email</p>
        <p className="mt-2 text-sm text-steel">
          We sent a link to {email}. Open it on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <form onSubmit={sendMagicLink} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" block disabled={state === 'sending'}>
          {state === 'sending' ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Email me a link
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 text-sm text-steel-2">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>

      <Button variant="outline" size="lg" block onClick={signInWithGoogle}>
        Continue with Google
      </Button>
    </div>
  );
}
