import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Wayfare collects, why, and who else sees it.',
};

/**
 * Written from the schema rather than from a template, so it describes what the
 * code actually does. If you change what is stored, change this too — the
 * tables named here are real.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="25 August 2026">
      <Section title="The short version">
        <p>
          We store the trips you plan, and enough about you to let you come back to them. We do
          not sell anything about you, we do not run advertising, and we do not build a profile of
          you across other websites.
        </p>
      </Section>

      <Section title="What we store">
        <ul className="list-disc space-y-2 pl-5 text-steel">
          <li>
            <strong className="text-ink">Your account.</strong> An email address, and a username
            and display name you choose. If you sign in with Google we receive your name and
            profile picture. We never store a password — signing in is a link sent to your email.
          </li>
          <li>
            <strong className="text-ink">Your trips.</strong> Everything you enter in the planner,
            including the free-text notes about how you like to travel, plus the itineraries we
            generate and any edits you make.
          </li>
          <li>
            <strong className="text-ink">What you do here.</strong> Trips you like, save, copy or
            comment on.
          </li>
          <li>
            <strong className="text-ink">Anonymous sessions.</strong> You can plan and copy a trip
            without an account. That still creates an account behind the scenes so the trip has an
            owner — it just has no email attached. If you sign up later, it becomes your account
            and your trips come with you.
          </li>
        </ul>
      </Section>

      <Section title="What we deliberately do not store">
        <p className="text-steel">
          We record that a trip was viewed, but not who viewed it. The identifier attached to a
          view is a one-way hash of your IP address, browser and the day, salted per trip. It
          cannot be reversed into an IP address, and it cannot be used to link your visits across
          different trips or across days. It exists only so that refreshing a page does not count
          as ten views.
        </p>
        <p className="text-steel">
          We do not store raw IP addresses, precise location, or payment details.
        </p>
      </Section>

      <Section title="Who else sees it">
        <ul className="list-disc space-y-2 pl-5 text-steel">
          <li>
            <strong className="text-ink">Google Maps Platform</strong> — we send the destination
            and the kinds of places you are interested in so we can find real venues, opening
            hours and travel times. We do not send your name, email or notes.
          </li>
          <li>
            <strong className="text-ink">OpenAI</strong> — we send your trip preferences,
            including your free-text notes, so a model can shape the itinerary. We do not send
            your name or email.
          </li>
          <li>
            <strong className="text-ink">Unsplash</strong> — we request a photograph for the
            destination. Images are loaded from Unsplash directly, so they see the request.
          </li>
          <li>
            <strong className="text-ink">Cloudflare Turnstile</strong> — a bot check shown before
            generating a trip without an account.
          </li>
          <li>
            <strong className="text-ink">Supabase and Vercel</strong> — our database and hosting.
          </li>
        </ul>
      </Section>

      <Section title="What other people see">
        <p className="text-steel">
          A trip is private when you create it. Sharing makes it reachable by anyone with the
          link, and only a further, deliberate choice makes it public and listed. On a shared or
          public trip, other people see the itinerary, your username and your avatar — never your
          email.
        </p>
        <p className="text-steel">
          Your free-text notes shape the itinerary but are not shown on the trip page.
        </p>
      </Section>

      <Section title="Copies of your trip">
        <p className="text-steel">
          When someone copies a public trip they get their own independent copy, taken at that
          moment. Editing your original afterwards does not change their copy, and deleting yours
          does not remove theirs — their copy keeps a credit to your username. If you make a trip
          private again, copies people already made remain theirs.
        </p>
      </Section>

      <Section title="Deleting things">
        <p className="text-steel">
          Deleting a trip removes it from the site immediately. Deleting your account removes your
          profile and your trips. Copies other people already made are theirs and stay with them,
          as above.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-steel">
          For anything about your data, email us. This section needs a real address before launch.
        </p>
      </Section>
    </LegalPage>
  );
}
