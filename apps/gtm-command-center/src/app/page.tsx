const cards = [
  { label: 'Forecast Confidence', value: '81%', delta: '+4% WoW' },
  { label: 'Pipeline Coverage', value: '3.1x', delta: '+0.3x' },
  { label: 'At-Risk Deals', value: '12', delta: '-3' },
  { label: 'New Pipeline (Week)', value: '$1.8M', delta: '+12%' },
];

const risks = [
  'Enterprise Q2 renewal — legal delay',
  'Mid-market outbound conversion dip',
  'Top rep capacity near max',
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-xl font-semibold">AdZeta GTM Command Center</h1>
        <p className="text-sm text-slate-400">Vertical slice v1 — shell mode</p>
      </header>

      <section className="grid gap-4 p-6 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-2 text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-emerald-400">{c.delta}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 px-6 pb-8 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-semibold">Pipeline Health</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Stage</th>
                  <th>Count</th>
                  <th>Value</th>
                  <th>Avg Age</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Discovery', 22, '$3.2M', '9d'],
                  ['Evaluation', 14, '$2.6M', '17d'],
                  ['Proposal', 9, '$1.9M', '23d'],
                  ['Negotiation', 6, '$1.1M', '28d'],
                ].map((r) => (
                  <tr key={r[0]} className="border-t border-slate-800">
                    <td className="py-2">{r[0]}</td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                    <td>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-semibold">Weekly Brief Draft</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            {risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Next: wire live data from Supabase and export executive brief.
          </p>
        </div>
      </section>
    </main>
  );
}
