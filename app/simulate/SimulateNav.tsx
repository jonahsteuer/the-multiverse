'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/simulate',         label: '🔭 Layer 1',   sub: 'Calendar Preview'   },
  { href: '/simulate/chat',    label: '💬 Layer 2',   sub: 'Onboarding Chat'    },
  { href: '/simulate/journey', label: '🗺️ Layer 3',   sub: 'User Journey'       },
];

export function SimulateNav() {
  const path = usePathname();
  return (
    <div className="border-b border-gray-800 bg-gray-900/90 px-6 py-0 flex items-stretch">
      <div className="flex items-center gap-1 mr-6 border-r border-gray-800 pr-6">
        <span className="text-yellow-400 text-sm font-bold">🧪 Simulate</span>
      </div>
      {TABS.map(t => {
        const active = t.href === '/simulate' ? path === '/simulate' : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-col justify-center px-4 py-3 border-b-2 transition-colors text-sm ${
              active
                ? 'border-yellow-400 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="font-semibold leading-tight">{t.label}</span>
            <span className="text-[11px] opacity-70 leading-tight">{t.sub}</span>
          </Link>
        );
      })}
      <a
        href="/"
        className="ml-auto self-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        ← App
      </a>
    </div>
  );
}
