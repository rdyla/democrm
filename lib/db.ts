import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CallActivity, CallActivityInput } from "./types";

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

interface CallActivityRow {
  id: string;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  phone_number: string;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number | null;
  disposition: string | null;
  notes: string | null;
  zoom_engagement_id: string | null;
  raw_event: string | null;
  created_at: number;
}

function rowToActivity(r: CallActivityRow): CallActivity {
  return {
    id: r.id,
    contactId: r.contact_id,
    direction: r.direction,
    phoneNumber: r.phone_number,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSeconds: r.duration_seconds,
    disposition: (r.disposition as CallActivity["disposition"]) ?? null,
    notes: r.notes,
    zoomEngagementId: r.zoom_engagement_id,
    rawEvent: r.raw_event,
    createdAt: r.created_at,
  };
}

export async function insertCallActivity(input: CallActivityInput): Promise<CallActivity> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const startedAt = input.startedAt ?? now;
  const raw = input.rawEvent === undefined ? null : JSON.stringify(input.rawEvent);

  await db()
    .prepare(
      `INSERT INTO call_activity
        (id, contact_id, direction, phone_number, started_at, ended_at, duration_seconds, disposition, notes, zoom_engagement_id, raw_event, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.contactId ?? null,
      input.direction,
      input.phoneNumber,
      startedAt,
      input.endedAt ?? null,
      input.durationSeconds ?? null,
      input.disposition ?? null,
      input.notes ?? null,
      input.zoomEngagementId ?? null,
      raw,
      now,
    )
    .run();

  return {
    id,
    contactId: input.contactId ?? null,
    direction: input.direction,
    phoneNumber: input.phoneNumber,
    startedAt,
    endedAt: input.endedAt ?? null,
    durationSeconds: input.durationSeconds ?? null,
    disposition: input.disposition ?? null,
    notes: input.notes ?? null,
    zoomEngagementId: input.zoomEngagementId ?? null,
    rawEvent: raw,
    createdAt: now,
  };
}

export async function updateCallActivityByEngagementId(
  zoomEngagementId: string,
  patch: Partial<Omit<CallActivityInput, "zoomEngagementId">>,
): Promise<CallActivity | null> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (patch.contactId !== undefined) {
    sets.push("contact_id = ?");
    values.push(patch.contactId);
  }
  if (patch.endedAt !== undefined) {
    sets.push("ended_at = ?");
    values.push(patch.endedAt);
  }
  if (patch.durationSeconds !== undefined) {
    sets.push("duration_seconds = ?");
    values.push(patch.durationSeconds);
  }
  if (patch.disposition !== undefined) {
    sets.push("disposition = ?");
    values.push(patch.disposition);
  }
  if (patch.notes !== undefined) {
    sets.push("notes = ?");
    values.push(patch.notes);
  }
  if (patch.rawEvent !== undefined) {
    sets.push("raw_event = ?");
    values.push(JSON.stringify(patch.rawEvent));
  }

  if (sets.length === 0) {
    const existing = await db()
      .prepare(`SELECT * FROM call_activity WHERE zoom_engagement_id = ? LIMIT 1`)
      .bind(zoomEngagementId)
      .first<CallActivityRow>();
    return existing ? rowToActivity(existing) : null;
  }

  values.push(zoomEngagementId);
  await db()
    .prepare(`UPDATE call_activity SET ${sets.join(", ")} WHERE zoom_engagement_id = ?`)
    .bind(...values)
    .run();

  const updated = await db()
    .prepare(`SELECT * FROM call_activity WHERE zoom_engagement_id = ? LIMIT 1`)
    .bind(zoomEngagementId)
    .first<CallActivityRow>();
  return updated ? rowToActivity(updated) : null;
}

export async function listActivityForContact(
  contactId: string,
  limit = 50,
): Promise<CallActivity[]> {
  const rs = await db()
    .prepare(
      `SELECT * FROM call_activity WHERE contact_id = ? ORDER BY started_at DESC LIMIT ?`,
    )
    .bind(contactId, limit)
    .all<CallActivityRow>();
  return (rs.results ?? []).map(rowToActivity);
}

export async function countCallsInLast24h(): Promise<number> {
  const row = await db()
    .prepare(
      `SELECT COUNT(*) AS n FROM call_activity WHERE started_at >= (unixepoch() - 86400) * 1000`,
    )
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listRecentActivity(limit = 25): Promise<CallActivity[]> {
  const rs = await db()
    .prepare(`SELECT * FROM call_activity ORDER BY started_at DESC LIMIT ?`)
    .bind(limit)
    .all<CallActivityRow>();
  return (rs.results ?? []).map(rowToActivity);
}
