import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import FloatingThemeToggle from '../components/FloatingThemeToggle';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SplitEase — Expense Split Calculator',
  description:
    'Track expenses and split bills fairly with friends, roommates, and travel groups.',
  keywords: 'expense split, bill splitting, group expenses, settle debts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Inline script prevents dark→light flash on load */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('splitease-theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <FloatingThemeToggle />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
