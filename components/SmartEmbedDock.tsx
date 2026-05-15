"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ZOOM_EMBED_BASE =
  process.env.NEXT_PUBLIC_ZOOM_EMBED_URL ?? "https://zoom.us/cci/callbar/crm/";
const ZOOM_ORIGIN = "https://zoom.us";
const ENTITY_TYPE = "Contact";

interface ZoomMessage {
  type: string;
  data?: unknown;
}

interface LogEntry {
  ts: number;
  type: string;
  data: unknown;
  direction: "in" | "out";
}

interface DialDetail {
  phoneNumber: string;
  contactId: string;
  name?: string;
  email?: string;
}

declare global {
  interface WindowEventMap {
    "democrm:dial": CustomEvent<DialDetail>;
  }
}

export function SmartEmbedDock() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const router = useRouter();
  const [debugOpen, setDebugOpen] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    // Derive ?origin= from the parent's actual location (client-only) so the
    // same code works on localhost, workers.dev, and the custom domain.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(`${ZOOM_EMBED_BASE}?origin=${encodeURIComponent(window.location.origin)}`);
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== ZOOM_ORIGIN) return;
      const msg = e.data as ZoomMessage | undefined;
      if (!msg || typeof msg.type !== "string") return;

      setLog((prev) =>
        [
          { ts: Date.now(), type: msg.type, data: msg.data, direction: "in" as const },
          ...prev,
        ].slice(0, 80),
      );

      handleEmbedMessage(msg, { router, iframeRef });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    function onDial(e: Event) {
      const detail = (e as CustomEvent<DialDetail>).detail;
      if (!detail?.phoneNumber) return;
      // Per the official ZCC docs, host-initiated click-to-dial uses `onclicktoact`.
      const message: ZoomMessage = {
        type: "onclicktoact",
        data: {
          id: detail.contactId,
          name: detail.name ?? "",
          phone: detail.phoneNumber,
          email: detail.email ?? "",
          userEntity: ENTITY_TYPE,
        },
      };
      postToEmbed(iframeRef.current, message);
      setLog((prev) =>
        [
          {
            ts: Date.now(),
            type: message.type,
            data: message.data,
            direction: "out" as const,
          },
          ...prev,
        ].slice(0, 80),
      );
    }
    window.addEventListener("democrm:dial", onDial);
    return () => window.removeEventListener("democrm:dial", onDial);
  }, []);

  return (
    <aside className="flex h-screen flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-semibold">Agent Workspace</span>
        </div>
        <button
          type="button"
          onClick={() => setDebugOpen((v) => !v)}
          className="rounded border border-[var(--border)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--muted)] hover:bg-slate-50"
        >
          {debugOpen ? "Hide log" : "Event log"}
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        {src && (
          <iframe
            ref={iframeRef}
            id="zoom-embeddable-phone-iframe"
            src={src}
            title="Zoom Contact Center Smart Embed"
            onLoad={() => setReady(true)}
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin allow-downloads"
            allow=";autoplay;microphone;camera;display-capture;midi;encrypted-media;clipboard-write;"
            className="h-full w-full border-0"
          />
        )}
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/80 text-xs text-slate-300">
            Loading Zoom Contact Center…
          </div>
        )}
      </div>

      {debugOpen && (
        <div className="max-h-80 overflow-y-auto border-t border-[var(--border)] bg-slate-950 p-3 font-mono text-[10px] text-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-slate-400">
              postMessage log (origin {ZOOM_ORIGIN})
            </span>
            <button
              type="button"
              onClick={() => setLog([])}
              className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
            >
              clear
            </button>
          </div>
          {log.length === 0 ? (
            <div className="text-slate-500">
              No events yet. Have the embed sign in, then place a call.
            </div>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="mb-1 break-all">
                <span
                  className={
                    entry.direction === "in"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                >
                  {entry.direction === "in" ? "←" : "→"} {entry.type}
                </span>{" "}
                <span className="text-slate-500">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
                <pre className="mt-0.5 whitespace-pre-wrap text-slate-300">
                  {safeStringify(entry.data)}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}

function postToEmbed(iframe: HTMLIFrameElement | null, message: ZoomMessage) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(message, ZOOM_ORIGIN);
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function handleEmbedMessage(
  msg: ZoomMessage,
  ctx: {
    router: ReturnType<typeof useRouter>;
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
  },
) {
  switch (msg.type) {
    case "zcc-init-config-request":
      postToEmbed(ctx.iframeRef.current, {
        type: "zcc-init-config-response",
        data: { phone: { screenPopEvent: "RINGING" } },
      });
      return;

    case "zcc-contact-search-event": {
      // Embed asks us to resolve a phone number or email; respond with a
      // single matched contact (or empty match).
      const query = extractQuery(msg.data);
      if (query) void respondContactSearch(query, ctx.iframeRef);
      return;
    }

    case "zcc-incomingPhone-request": {
      // Embed received an inbound voice or SMS engagement; respond with an
      // ARRAY of matched contacts. The agent picks one which then triggers
      // a `zcc-screen-pop` with that contact's id.
      const phone = extractIncomingPhone(msg.data);
      if (phone) void respondIncomingPhone(phone, ctx.iframeRef);
      return;
    }

    case "zcc-screen-pop": {
      // Agent has selected a contact from the multi-match list; payload is
      // { id } — navigate directly, no phone re-lookup needed.
      const id = extractId(msg.data);
      if (id) ctx.router.push(`/contacts/${id}?via=screenpop`);
      return;
    }

    case "zcc-call-ringing":
    case "zcc-call-connected": {
      // Pop based on the `from` field of the engagement.
      const phone = extractPhone(msg.data);
      if (phone) void phoneScreenPop(phone, ctx.router);
      return;
    }

    case "zcc-call-ended":
    case "zcc-phone-call-log":
    case "zcc-call-recording":
    case "zcc-engagement-log-url":
      void writeBackActivity(msg);
      return;
  }
}

function extractQuery(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const q = d.query;
  if (typeof q === "string" && q.length > 0) return q;
  // Fall back to phone if query missing (defensive).
  return extractPhone(data);
}

function extractId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const v = d.id;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function extractIncomingPhone(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const v = d.incomingPhoneNumber;
  return typeof v === "string" && v.length > 0 ? v : extractPhone(data);
}

function extractPhone(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  for (const key of ["from", "phoneNumber", "phone", "to", "callerNumber", "number"]) {
    const v = d[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

interface ContactLookup {
  contactId: string | null;
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
}

async function lookupContact(phoneOrQuery: string): Promise<ContactLookup | null> {
  try {
    const r = await fetch(
      `/api/contacts/lookup?phone=${encodeURIComponent(phoneOrQuery)}`,
    );
    if (!r.ok) return null;
    return (await r.json()) as ContactLookup;
  } catch {
    return null;
  }
}

async function respondContactSearch(
  query: string,
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  const res = await lookupContact(query);
  postToEmbed(iframeRef.current, {
    type: "zcc-contact-search-response",
    data: res?.contactId
      ? {
          id: res.contactId,
          name: res.name ?? "",
          phone: res.phone ?? query,
          email: res.email ?? "",
          entity: ENTITY_TYPE,
        }
      : {},
  });
}

async function respondIncomingPhone(
  phone: string,
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  const res = await lookupContact(phone);
  postToEmbed(iframeRef.current, {
    type: "zcc-incomingPhone-response",
    data: res?.contactId
      ? [
          {
            id: res.contactId,
            name: res.name ?? "",
            phone: res.phone ?? phone,
            email: res.email ?? "",
            entity: ENTITY_TYPE,
          },
        ]
      : [],
  });
}

async function phoneScreenPop(
  phone: string,
  router: ReturnType<typeof useRouter>,
) {
  const res = await lookupContact(phone);
  if (res?.contactId) router.push(`/contacts/${res.contactId}?via=screenpop`);
}

async function writeBackActivity(msg: ZoomMessage) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: msg.type, payload: msg.data }),
    });
  } catch {
    // ignore — UI continues
  }
}
