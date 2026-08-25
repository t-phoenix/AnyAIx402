import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from './nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'AnyX — developer portal',
  description: 'Pay any x402-gated API with any token.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-name">AnyX</span>
              <span className="brand-tag">x402 adapter</span>
            </div>
            <Nav />
            <div className="sidebar-foot">
              Pay with any token.
              <br />
              Settle on x402.
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
