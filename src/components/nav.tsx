"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/dashboard", label: "Schedule" },
  { href: "/swaps", label: "Swap requests" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="bg-slate-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <span className="font-semibold text-amber-400">Shift Swapper</span>
        <nav className="flex gap-5 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`border-b-2 pb-0.5 ${
                pathname === link.href
                  ? "border-amber-400 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button onClick={() => signOut()} className="ml-auto text-sm text-slate-400 hover:text-slate-200">
          Sign out
        </button>
      </div>
    </header>
  );
}
