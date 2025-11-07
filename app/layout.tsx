import './globals.css'; import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Cool Not Cool', description: 'Is it cool or not cool? One trending launch/coin post a day. Vote today, see results tomorrow.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>); }