import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from './components/theme-provider';
import { AnnouncementProvider } from './components/accessibility';
import { SkipLink } from './components/accessibility';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'GTM Command Center',
  description: 'Your GTM motion, visualized and actionable',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ 
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <ThemeProvider>
          <AnnouncementProvider>
            {/* Skip links for accessibility */}
            <SkipLink href="#main-content">
              Skip to main content
            </SkipLink>
            <SkipLink href="#main-navigation">
              Skip to navigation
            </SkipLink>
            
            {children}
          </AnnouncementProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
