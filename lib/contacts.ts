import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Contact } from "./types";
import { normalizePhone } from "./phone";

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  industry: string;
  email: string;
  phone: string;
  mobile: string;
  city: string;
  state: string;
  tags: string;
  account_value: number;
  last_contacted: string;
  created_at: number;
  updated_at: number;
}

function rowToContact(r: ContactRow): Contact {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(r.tags) as unknown;
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === "string");
  } catch {
    tags = [];
  }
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    title: r.title,
    company: r.company,
    industry: r.industry,
    email: r.email,
    phone: r.phone,
    mobile: r.mobile,
    city: r.city,
    state: r.state,
    tags,
    accountValue: r.account_value,
    lastContacted: r.last_contacted,
  };
}

export async function listContacts(): Promise<Contact[]> {
  const rs = await db()
    .prepare("SELECT * FROM contacts ORDER BY last_name, first_name")
    .all<ContactRow>();
  return (rs.results ?? []).map(rowToContact);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const row = await db()
    .prepare("SELECT * FROM contacts WHERE id = ? LIMIT 1")
    .bind(id)
    .first<ContactRow>();
  return row ? rowToContact(row) : null;
}

export async function findContactByPhone(phone: string): Promise<Contact | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const rs = await db().prepare("SELECT * FROM contacts").all<ContactRow>();
  const all = (rs.results ?? []).map(rowToContact);
  return (
    all.find(
      (c) =>
        normalizePhone(c.phone) === normalized ||
        normalizePhone(c.mobile) === normalized,
    ) ?? null
  );
}

export type ContactInput = Omit<Contact, "id">;

export async function createContact(input: ContactInput): Promise<Contact> {
  const id = `c-${crypto.randomUUID().slice(0, 8)}`;
  const normalized: ContactInput = {
    ...input,
    phone: normalizePhone(input.phone) ?? "",
    mobile: normalizePhone(input.mobile) ?? "",
  };
  await db()
    .prepare(
      `INSERT INTO contacts (id, first_name, last_name, title, company, industry, email, phone, mobile, city, state, tags, account_value, last_contacted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      normalized.firstName,
      normalized.lastName,
      normalized.title,
      normalized.company,
      normalized.industry,
      normalized.email,
      normalized.phone,
      normalized.mobile,
      normalized.city,
      normalized.state,
      JSON.stringify(normalized.tags ?? []),
      normalized.accountValue,
      normalized.lastContacted,
    )
    .run();
  return { id, ...normalized };
}

export async function updateContact(
  id: string,
  patch: Partial<ContactInput>,
): Promise<Contact | null> {
  const existing = await getContactById(id);
  if (!existing) return null;
  const merged: ContactInput = {
    firstName: patch.firstName ?? existing.firstName,
    lastName: patch.lastName ?? existing.lastName,
    title: patch.title ?? existing.title,
    company: patch.company ?? existing.company,
    industry: patch.industry ?? existing.industry,
    email: patch.email ?? existing.email,
    phone: patch.phone !== undefined ? normalizePhone(patch.phone) ?? "" : existing.phone,
    mobile:
      patch.mobile !== undefined ? normalizePhone(patch.mobile) ?? "" : existing.mobile,
    city: patch.city ?? existing.city,
    state: patch.state ?? existing.state,
    tags: patch.tags ?? existing.tags,
    accountValue: patch.accountValue ?? existing.accountValue,
    lastContacted: patch.lastContacted ?? existing.lastContacted,
  };
  await db()
    .prepare(
      `UPDATE contacts SET
        first_name = ?, last_name = ?, title = ?, company = ?, industry = ?,
        email = ?, phone = ?, mobile = ?, city = ?, state = ?,
        tags = ?, account_value = ?, last_contacted = ?, updated_at = unixepoch() * 1000
       WHERE id = ?`,
    )
    .bind(
      merged.firstName,
      merged.lastName,
      merged.title,
      merged.company,
      merged.industry,
      merged.email,
      merged.phone,
      merged.mobile,
      merged.city,
      merged.state,
      JSON.stringify(merged.tags),
      merged.accountValue,
      merged.lastContacted,
      id,
    )
    .run();
  return { id, ...merged };
}

export async function deleteContact(id: string): Promise<boolean> {
  const result = await db()
    .prepare("DELETE FROM contacts WHERE id = ?")
    .bind(id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export function getInitials(contact: Pick<Contact, "firstName" | "lastName">): string {
  return `${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`.toUpperCase();
}

export function getAvatarColor(id: string): string {
  const palette = [
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-sky-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-fuchsia-500",
    "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
