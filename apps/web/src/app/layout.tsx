import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessaoProvider } from '@/lib/sessao';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Verissimo ERP',
  description: 'Gestão empresarial simples e completa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased">
        <SessaoProvider>{children}</SessaoProvider>
      </body>
    </html>
  );
}
