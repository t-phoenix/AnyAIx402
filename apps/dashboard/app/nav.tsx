'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/payments', label: 'Payments' },
  { href: '/tokens', label: 'Tokens' },
  { href: '/keys', label: 'API keys' },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link"
          data-active={pathname === link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
