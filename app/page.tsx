import Link from "next/link";
import { listContacts, getAvatarColor, getInitials } from "@/lib/contacts";
import { countCallsInLast24h, listRecentActivity } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { ActivityRow } from "@/components/ActivityRow";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let contacts: Awaited<ReturnType<typeof listContacts>> = [];
  let recentActivity: Awaited<ReturnType<typeof listRecentActivity>> = [];
  let callsToday = 0;
  try {
    [contacts, recentActivity, callsToday] = await Promise.all([
      listContacts(),
      listRecentActivity(8),
      countCallsInLast24h(),
    ]);
  } catch {
    contacts = [];
    recentActivity = [];
    callsToday = 0;
  }

  const totalValue = contacts.reduce((s, c) => s + c.accountValue, 0);

  const recentContacts = [...contacts]
    .sort((a, b) => (a.lastContacted < b.lastContacted ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--muted)]">
          Mock CRM for demonstrating Zoom Contact Center Smart Embed.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="Active contacts" value={contacts.length.toString()} />
        <StatCard label="Calls in last 24h" value={callsToday.toString()} />
        <StatCard
          label="Pipeline value"
          value={`$${(totalValue / 1000).toFixed(0)}K`}
        />
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Recently contacted
          </h2>
          <Link
            href="/contacts"
            className="text-xs text-[var(--accent)] hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {recentContacts.map((c, i) => (
            <Link
              key={c.id}
              href={`/contacts/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 ${
                i > 0 ? "border-t border-[var(--border)]" : ""
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white ${getAvatarColor(c.id)}`}
              >
                {getInitials(c)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {c.firstName} {c.lastName}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {c.title} · {c.company}
                </div>
              </div>
              <div className="text-xs text-[var(--muted)]">
                {formatPhone(c.phone)}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Recent call activity
          </h2>
          <Link
            href="/activity"
            className="text-xs text-[var(--accent)] hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {recentActivity.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No call activity yet. Calls placed via the Zoom embed will appear here.
            </div>
          ) : (
            recentActivity.map((a, i) => (
              <ActivityRow
                key={a.id}
                activity={a}
                isFirst={i === 0}
                contactNameById={Object.fromEntries(
                  contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`]),
                )}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
