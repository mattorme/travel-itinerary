'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Image as ImageIcon, MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recordShare } from '@/app/actions/trip-actions';
import { formatCurrency } from '@/lib/utils/format';
import type { Itinerary } from '@/domain/types/itinerary';

/**
 * Share sheet.
 *
 * Uses the native share sheet where it exists (which on a phone is the thing
 * people actually reach for) and falls back to explicit per-channel links.
 * Each share is attributed to a channel so we can see which ones move.
 */
export function ShareSheet({
  itinerary,
  onClose,
}: {
  itinerary: Itinerary;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Derived during render rather than set in an effect. This component only ever
  // mounts in response to a click, so `window` is available; the guard is there
  // so it stays safe if that ever changes.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = `${origin}/t/${itinerary.slug}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cost = itinerary.estimatedCost?.total;
  const message = [
    itinerary.title,
    `${itinerary.request.dates.durationDays} days`,
    cost !== undefined ? `~${formatCurrency(cost, itinerary.request.currency)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  async function nativeShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: itinerary.title, text: message, url });
      void recordShare(itinerary.id, 'native');
    } catch {
      // The user dismissed the sheet. Not an error.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      void recordShare(itinerary.id, 'copy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const channels = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}` },
    { id: 'x', label: 'X', icon: Send, href: `https://x.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share this trip"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-line bg-paper-raised p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl">Share this trip</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Anyone with the link can open it — no account needed.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-line bg-paper-sunk px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{url}</span>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button variant="primary" size="md" block onClick={nativeShare} className="col-span-2">
              Share…
            </Button>
          )}
          {channels.map((channel) => (
            <a
              key={channel.id}
              href={channel.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void recordShare(itinerary.id, channel.id)}
              className="flex items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm transition-colors hover:bg-paper-sunk"
            >
              <channel.icon className="size-4" />
              {channel.label}
            </a>
          ))}
          <a
            href={`/t/${itinerary.slug}/card`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void recordShare(itinerary.id, 'story_card')}
            className="col-span-2 flex items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm transition-colors hover:bg-paper-sunk"
          >
            <ImageIcon className="size-4" />
            Get a story graphic
          </a>
        </div>
      </div>
    </div>
  );
}
