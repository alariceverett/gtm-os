import { PageCard } from '@/components/page-card';

export default function HomePage() {
  return (
    <div className="grid gap-4">
      <PageCard title="Migration status">
        Legacy server-rendered app remains source of truth. This Next.js shell is additive and non-breaking.
      </PageCard>
      <PageCard title="Phase-1 scope">
        App shell, shared nav/layout, route placeholders, and first API integration pattern.
      </PageCard>
    </div>
  );
}
