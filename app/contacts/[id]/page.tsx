import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getContactById,
  getAvatarColor,
  getInitials,
} from "@/lib/contacts";
import { formatPhone } from "@/lib/phone";
import { listActivityForContact } from "@/lib/db";
import { CallButton } from "@/components/CallButton";
import { ActivityRow } from "@/components/ActivityRow";
import { ScreenPopBanner } from "@/components/ScreenPopBanner";

export default async function ContactDetailPage(
  props: PageProps<"/contacts/[id]">,
) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const viaScreenPop = search.via === "screenpop";

  const contact = await getContactById(id);
  if (!contact) notFound();

  let activity: Awaited<ReturnType<typeof listActivityForContact>> = [];
  try {
    activity = await listActivityForContact(contact.id, 25);
  } catch {
    activity = [];
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      {viaScreenPop && <ScreenPopBanner />}

      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/contacts"
          className="text-xs text-[var(--muted)] hover:underline"
        >
          ← All contacts
        </Link>
        <Link
          href={`/contacts/${contact.id}/edit`}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-slate-50"
        >
          Edit contact
        </Link>
      </div>

      <header className="mb-6 flex items-start gap-5">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white ${getAvatarColor(contact.id)}`}
        >
          {getInitials(contact)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {contact.firstName} {contact.lastName}
          </h1>
          <div className="text-sm text-[var(--muted)]">
            {contact.title} · {contact.company} · {contact.city}, {contact.state}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {contact.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Account value
          </div>
          <div className="mt-1 text-xl font-semibold">
            ${contact.accountValue.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            Last contacted {contact.lastContacted}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Industry
          </div>
          <div className="mt-1 text-xl font-semibold">{contact.industry}</div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            {contact.email}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Phone
        </h2>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <PhoneRow
            label="Work"
            number={contact.phone}
            contactId={contact.id}
            name={`${contact.firstName} ${contact.lastName}`}
            email={contact.email}
          />
          <PhoneRow
            label="Mobile"
            number={contact.mobile}
            contactId={contact.id}
            name={`${contact.firstName} ${contact.lastName}`}
            email={contact.email}
            isLast
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Call activity ({activity.length})
        </h2>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {activity.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No calls logged for this contact yet. Place a call via the Zoom embed
              to see disposition write-back appear here.
            </div>
          ) : (
            activity.map((a, i) => (
              <ActivityRow
                key={a.id}
                activity={a}
                isFirst={i === 0}
                contactNameById={{
                  [contact.id]: `${contact.firstName} ${contact.lastName}`,
                }}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PhoneRow({
  label,
  number,
  contactId,
  name,
  email,
  isLast = false,
}: {
  label: string;
  number: string;
  contactId: string;
  name: string;
  email: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 ${
        isLast ? "" : "border-b border-[var(--border)]"
      }`}
    >
      <div className="w-16 text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="flex-1 font-mono text-sm">{formatPhone(number)}</div>
      <CallButton
        phoneNumber={number}
        contactId={contactId}
        name={name}
        email={email}
      />
    </div>
  );
}
