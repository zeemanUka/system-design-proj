import type { Metadata } from 'next';
import { Public_Sans, Space_Grotesk } from 'next/font/google';
import { PerformanceMonitor } from '@/components/performance-monitor';
import './globals.css';

const bodyFont = Public_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap'
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'System Design Coach',
  description: 'Interactive practice platform for system design interviews.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <PerformanceMonitor />
        {children}
      </body>
    </html>
  );
}
