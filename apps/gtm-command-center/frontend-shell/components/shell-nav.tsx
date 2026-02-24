import Link from 'next/link';

const routes = [
  ['Home', '/'],
  ['Ops', '/ops'],
  ['Targeting', '/targeting'],
  ['Actions', '/actions'],
  ['Relationships', '/relationships'],
  ['Comms', '/comms'],
  ['Pilot', '/pilot'],
  ['Research', '/research'],
  ['Strategy', '/strategy'],
] as const;

export function ShellNav() {
  return (
    <nav className="flex flex-wrap gap-2">
      {routes.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:border-slate-400">
          {label}
        </Link>
      ))}
    </nav>
  );
}
