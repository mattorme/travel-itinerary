import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The rules for using Wayfare.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="25 August 2026">
      <Section title="What this is">
        <p>
          Wayfare helps you plan trips. You tell us where you are going and how you like to
          travel; we build a day-by-day itinerary from real places and let you share it.
        </p>
      </Section>

      <Section title="Itineraries are suggestions, not guarantees">
        <p className="text-steel">
          Every itinerary is generated. The places are real and the opening hours and travel times
          come from Google, but they change, and a place that was open last week may not be open
          when you arrive. Check anything that matters, especially opening times, bookings and
          anything you are travelling a long way for.
        </p>
        <p className="text-steel">
          Every cost is an <em>estimate</em> produced by our own model, not a quoted price. It
          excludes flights. Treat it as a rough guide to whether a trip is in the right range, and
          nothing more.
        </p>
      </Section>

      <Section title="Your account">
        <p className="text-steel">
          You are responsible for what happens under your account. Tell us if you think someone
          else has access to it. You must be old enough to agree to these terms where you live.
        </p>
      </Section>

      <Section title="What you post">
        <p className="text-steel">
          Your trips and comments are yours. By making a trip public you allow other people to see
          it and to make their own copy of it, and you allow us to show it on the site. You keep
          the right to your own words.
        </p>
        <p className="text-steel">
          Do not post anything unlawful, hateful, harassing, deceptive, or that is not yours to
          post. Comments are checked before they appear publicly. We may remove anything that
          breaks these rules, and close accounts that do so repeatedly.
        </p>
      </Section>

      <Section title="Copying other people's trips">
        <p className="text-steel">
          Copying a public trip is a feature, not a breach. That is what the button is for. Your
          copy is independent and yours to edit, and it keeps a credit to the person who planned
          the original.
        </p>
      </Section>

      <Section title="Fair use">
        <p className="text-steel">
          Generating a trip costs us money, so there are limits on how many you can create in a
          day. Do not scrape the site, script it, or try to work around those limits.
        </p>
      </Section>

      <Section title="Place data and imagery">
        <p className="text-steel">
          Place information, opening hours and photographs of venues come from Google Maps and are
          subject to Google&rsquo;s terms. Destination photography comes from Unsplash and is
          credited to the photographer. Neither is ours to relicense.
        </p>
      </Section>

      <Section title="Availability">
        <p className="text-steel">
          We will try to keep the site up and your trips safe, but this is a young product and we
          cannot promise either. Keep your own copy of anything you depend on. Every trip can be
          printed or exported to your calendar.
        </p>
      </Section>

      <Section title="Changes">
        <p className="text-steel">
          We will update these terms as the product changes, and the date at the top will say
          when. The governing law and dispute process need to be settled with a lawyer before
          launch.
        </p>
      </Section>
    </LegalPage>
  );
}
