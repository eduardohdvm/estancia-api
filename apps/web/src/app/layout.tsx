import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessaoProvider } from '@/lib/sessao';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Estância Maciel',
  description: 'Painel da Estância Maciel — Culinária Caipira',
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
