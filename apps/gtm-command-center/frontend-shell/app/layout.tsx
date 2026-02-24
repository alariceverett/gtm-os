import './globals.css';
import { ShellNav } from '@/components/shell-nav';

export const metadata = {
  title: 'GTM Command Center · Frontend Shell',
  description: 'Modern app-shell migration starter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-6xl space-y-6 p-6">
          <header className="space-y-3">
            <h1 className="text-2xl font-bold">GTM Command Center · Frontend Shell</h1>
            <p className="text-sm text-slate-600">Phase-1 bootstrap running side-by-side with legacy Node-rendered app.</p>
            <ShellNav />
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
