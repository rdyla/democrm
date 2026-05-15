import Link from "next/link";
import { SidebarNav } from "./SidebarNav";

export function Sidebar() {
  return (
    <aside className="flex h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <Link
        href="/"
        className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
          A
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Acme CRM</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Demo workspace
          </span>
        </div>
      </Link>

      <SidebarNav />

      <div className="border-t border-[var(--border)] px-5 py-4 text-[11px] text-[var(--muted)]">
        <div className="font-medium text-[var(--foreground)]">Powered by</div>
        <div>Zoom Contact Center · Smart Embed</div>
      </div>
    </aside>
  );
}
