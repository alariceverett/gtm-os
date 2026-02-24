export function PageCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <div className="text-sm text-slate-700">{children}</div>
    </section>
  );
}
