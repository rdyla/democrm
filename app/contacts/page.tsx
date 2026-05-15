import Link from "next/link";
import { listContacts, getAvatarColor, getInitials } from "@/lib/contacts";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await listContacts();
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-[var(--muted)]">
            {contacts.length} contacts. Inbound calls will screen-pop the matched record.
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <span aria-hidden>+</span>
          <span>New contact</span>
        </Link>
      </header>

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Industry</th>
              <th className="px-4 py-3 text-right font-medium">Account value</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr
                key={c.id}
                className="border-t border-[var(--border)] hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/contacts/${c.id}`}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ${getAvatarColor(c.id)}`}
                    >
                      {getInitials(c)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{c.title}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--foreground)]">{c.company}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {formatPhone(c.phone)}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.industry}</td>
                <td className="px-4 py-3 text-right font-medium">
                  ${c.accountValue.toLocaleString()}
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-[var(--muted)]"
                >
                  No contacts yet. Click &ldquo;New contact&rdquo; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
