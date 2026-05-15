import { listContacts } from "@/lib/contacts";
import { listRecentActivity } from "@/lib/db";
import { ActivityRow } from "@/components/ActivityRow";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  let contacts: Awaited<ReturnType<typeof listContacts>> = [];
  let activity: Awaited<ReturnType<typeof listRecentActivity>> = [];
  try {
    [contacts, activity] = await Promise.all([
      listContacts(),
      listRecentActivity(100),
    ]);
  } catch {
    contacts = [];
    activity = [];
  }

  const nameById = Object.fromEntries(
    contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`]),
  );

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Call Activity</h1>
        <p className="text-sm text-[var(--muted)]">
          Calls logged via Zoom Contact Center disposition write-back.
        </p>
      </header>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        {activity.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No activity yet. Calls placed or received via the Zoom embed will
            land here.
          </div>
        ) : (
          activity.map((a, i) => (
            <ActivityRow
              key={a.id}
              activity={a}
              isFirst={i === 0}
              contactNameById={nameById}
            />
          ))
        )}
      </div>
    </div>
  );
}
