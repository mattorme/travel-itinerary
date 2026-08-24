import type { Metadata } from 'next';
import { Wizard } from '@/components/wizard/wizard';

export const metadata: Metadata = {
  title: 'Plan a trip',
  description: 'Tell us where you are going and how you like to travel.',
  robots: { index: false },
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <Wizard initialQuery={q ?? null} />;
}
