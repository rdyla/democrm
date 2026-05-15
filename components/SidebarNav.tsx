"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/contacts", label: "Contacts", icon: "◉" },
  { href: "/activity", label: "Call Activity", icon: "≡" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-3 py-4">
      <ul className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--foreground)] hover:bg-slate-100"
                }`}
              >
                <span
                  className={`text-base ${
                    active ? "text-white" : "text-[var(--muted)]"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
