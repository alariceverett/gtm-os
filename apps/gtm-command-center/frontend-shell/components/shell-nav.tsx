'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

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
  const pathname = usePathname();
  
  return (
    <nav className="flex flex-wrap gap-1">
      {routes.map(([label, href]) => {
        const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
        
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
              isActive
                ? 'bg-slate-100 text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
