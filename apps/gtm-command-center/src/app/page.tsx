const cards = [
  { label: 'Open Orders', value: '18', delta: '+3 since 6pm' },
  { label: 'Avg Ticket', value: '$34.20', delta: '+$2.10' },
  { label: 'Kitchen Queue', value: '7', delta: '-2 last 10m' },
  { label: 'Table Turns', value: '2.4x', delta: '+0.3x' },
];

const prepQueue = [
  ['#1042', 'Table 8', '2x Smash Burger, Fries', 'Preparing'],
  ['#1043', 'Takeout', 'Chicken Bowl, Lemonade', 'Queued'],
  ['#1044', 'Table 3', 'Margherita Pizza, Salad', 'Ready'],
  ['#1045', 'Table 12', '2x Pasta Alfredo', 'Queued'],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-xl font-semibold">Restaurant Ops Command Center</h1>
        <p className="text-sm text-slate-400">MVP vertical slice — menu to kitchen execution</p>
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
          <h2 className="mb-3 text-lg font-semibold">Kitchen Board</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Order</th>
                  <th>Source</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prepQueue.map((r) => (
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
          <h2 className="mb-3 text-lg font-semibold">Next Build Steps</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>Connect Supabase menu_items and orders tables</li>
            <li>Add order submit form with server action</li>
            <li>Stream status changes to kitchen board</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Scope lock: ship one complete order lifecycle before adding reservations/payments.
          </p>
        </div>
      </section>
    </main>
  );
}
