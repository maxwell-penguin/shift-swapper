"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { NotificationBell } from "@/components/notification-bell";

const LINKS = [
  { href: "/dashboard", label: "Schedule" },
  { href: "/swaps", label: "Swap requests" },
  { href: "/market", label: "Swap Market" },
  { href: "/team", label: "Team" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="bg-ink-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <span className="text-title font-semibold text-accent-300">Shift Swapper</span>
        <nav className="flex gap-5 text-label">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`border-b-2 pb-0.5 transition-colors ${
                pathname === link.href
                  ? "border-accent-500 text-white"
                  : "border-transparent text-ink-400 hover:text-ink-200"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />
          <button onClick={() => signOut()} className="text-label text-ink-400 transition-colors hover:text-ink-200">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
