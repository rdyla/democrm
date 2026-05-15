import type { NextRequest } from "next/server";
import { findContactByPhone } from "@/lib/contacts";
import {
  insertCallActivity,
  listRecentActivity,
  updateCallActivityByEngagementId,
} from "@/lib/db";
import type {
  CallDirection,
  CallDisposition,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  const activity = await listRecentActivity(Number.isFinite(limit) ? limit : 25);
  return Response.json({ activity });
}

interface IncomingPayload {
  source?: string;
  payload?: unknown;
  direction?: CallDirection;
  phoneNumber?: string;
  contactId?: string;
  durationSeconds?: number;
  disposition?: CallDisposition;
  notes?: string;
  zoomEngagementId?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as IncomingPayload;

  const inferred = inferFromZoomMessage(body);
  const direction: CallDirection = body.direction ?? inferred.direction;
  const phoneNumber = body.phoneNumber ?? inferred.phoneNumber ?? "unknown";
  let contactId: string | null = body.contactId ?? inferred.contactId ?? null;
  if (!contactId && phoneNumber !== "unknown") {
    const match = await findContactByPhone(phoneNumber);
    contactId = match?.id ?? null;
  }
  const zoomEngagementId =
    body.zoomEngagementId ?? inferred.zoomEngagementId ?? null;

  if (zoomEngagementId) {
    // Only patch fields we actually resolved — never overwrite an
    // existing contact_id with null when a later event lacks contact data.
    const patch: Parameters<typeof updateCallActivityByEngagementId>[1] = {
      rawEvent: body.payload,
    };
    if (contactId) patch.contactId = contactId;
    const duration = body.durationSeconds ?? inferred.durationSeconds;
    if (duration !== undefined) patch.durationSeconds = duration;
    const disposition = body.disposition ?? inferred.disposition;
    if (disposition !== undefined) patch.disposition = disposition;
    const notes = body.notes ?? inferred.notes;
    if (notes !== undefined) patch.notes = notes;
    if (inferred.endedAt !== undefined) patch.endedAt = inferred.endedAt;

    const updated = await updateCallActivityByEngagementId(zoomEngagementId, patch);
    if (updated) return Response.json({ activity: updated, updated: true });
  }

  const activity = await insertCallActivity({
    contactId,
    direction,
    phoneNumber,
    durationSeconds: body.durationSeconds ?? inferred.durationSeconds,
    disposition: body.disposition ?? inferred.disposition,
    notes: body.notes ?? inferred.notes,
    endedAt: inferred.endedAt,
    startedAt: inferred.startedAt,
    zoomEngagementId,
    rawEvent: body.payload ?? body,
  });
  return Response.json({ activity, inserted: true });
}

interface ZccCallLog {
  objectRecord?: {
    callType?: string;
    from?: string;
    to?: string;
    callDuration?: number;
    callStartTime?: number | string;
    callEndTime?: number | string;
    notes?: string;
    dispositionCode?: string;
    dispositionId?: string;
    type?: string;
  };
  engagementId?: string;
  user?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    entity?: string;
  };
}

function inferFromZoomMessage(body: IncomingPayload): {
  direction: CallDirection;
  phoneNumber: string | null;
  durationSeconds: number | undefined;
  disposition: CallDisposition | undefined;
  notes: string | undefined;
  endedAt: number | undefined;
  startedAt: number | undefined;
  zoomEngagementId: string | undefined;
  contactId: string | undefined;
} {
  const payload = (body.payload ?? {}) as Record<string, unknown> & ZccCallLog;
  const source = body.source ?? "";
  const obj = payload.objectRecord;

  // Direction: prefer the explicit callType inside objectRecord; otherwise
  // infer from the source event name.
  const callType = obj?.callType?.toLowerCase();
  let direction: CallDirection = "outbound";
  if (callType) {
    direction = callType.includes("inbound") ? "inbound" : "outbound";
  } else if (/incoming|ringing|screen-pop/i.test(source)) {
    direction = "inbound";
  }

  // Phone number: use objectRecord.from/to per direction (zcc-phone-call-log
  // shape), falling back to flat keys (other events).
  let phoneNumber: string | null = null;
  if (obj) {
    phoneNumber = direction === "inbound" ? obj.from ?? null : obj.to ?? null;
  }
  if (!phoneNumber) {
    phoneNumber = pickString(payload, [
      "phoneNumber",
      "phone",
      "callerNumber",
      "ani",
      "from",
      "to",
      "incomingPhoneNumber",
    ]) ?? null;
  }

  // Contact id: the embed echoes back the id we previously sent via
  // onclicktoact / contact-search-response under `user.id`. This is the
  // most reliable signal.
  const contactId = payload.user?.id;

  const durationSeconds =
    obj?.callDuration ?? pickNumber(payload, ["duration", "durationSeconds"]);
  const disposition = (obj?.dispositionCode ??
    obj?.dispositionId ??
    pickString(payload, [
      "disposition",
      "outcome",
      "callOutcome",
    ])) as CallDisposition | undefined;
  const notes = obj?.notes ?? pickString(payload, ["notes", "summary", "comments"]);
  const startedAt = toMs(obj?.callStartTime);
  const endedAt =
    toMs(obj?.callEndTime) ?? pickNumber(payload, ["endedAt", "endTime", "completeTs"]);
  const zoomEngagementId = pickString(payload, [
    "engagementId",
    "callId",
    "interactionId",
  ]);

  return {
    direction,
    phoneNumber,
    durationSeconds,
    disposition,
    notes,
    startedAt,
    endedAt,
    zoomEngagementId,
    contactId: typeof contactId === "string" && contactId.length > 0 ? contactId : undefined,
  };
}

function toMs(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickNumber(
  obj: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}
