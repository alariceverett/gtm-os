import { PageCard } from '@/components/page-card';
import { fetchJson } from '@/lib/backend';

type MetricsSnapshot = {
  generated_at?: string;
  [key: string]: unknown;
};

export default async function OpsPage() {
  let snapshot: MetricsSnapshot | null = null;
  let error: string | null = null;

  try {
    snapshot = await fetchJson<MetricsSnapshot>('/api/metrics/snapshot');
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unable to load metrics snapshot';
  }

  return (
    <div className="grid gap-4">
      <PageCard title="Ops route scaffold">
        This page will migrate /ops UI from server templates to composable React modules.
      </PageCard>
      <PageCard title="Legacy API bridge · /api/metrics/snapshot">
        {error ? <p className="text-rose-700">{error}</p> : <pre className="overflow-x-auto text-xs">{JSON.stringify(snapshot, null, 2)}</pre>}
      </PageCard>
    </div>
  );
}
