import type { NextRequest } from "next/server";
import {
  listContacts,
  getContactById,
  findContactByPhone,
  searchContacts,
  createContact,
  updateContact,
  type ContactInput,
} from "@/lib/contacts";
import {
  listRecentActivity,
  listActivityForContact,
  appendNoteToActivity,
} from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { originOf, validateAccessToken } from "@/lib/oauth";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "democrm-mcp", version: "0.1.0" } as const;
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
]);

// ---------- JSON-RPC ----------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

function ok(id: string | number | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}
function rpcErr(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

// ---------- Tools ----------

interface ToolDef {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function summarize(c: Contact) {
  return {
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    title: c.title,
    company: c.company,
    phone: c.phone,
    email: c.email,
  };
}

const TOOLS: Record<string, ToolDef> = {
  search_contacts: {
    description:
      "Search the CRM for contacts by name, company, title, or email. Returns summaries; use get_contact for the full record.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text search across first/last name, company, title, email.",
        },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const query = String(args.query ?? "").trim();
      const limit =
        typeof args.limit === "number"
          ? Math.min(Math.max(Math.floor(args.limit), 1), 100)
          : 20;
      if (!query) return { count: 0, contacts: [] };
      const results = await searchContacts(query, limit);
      return { count: results.length, contacts: results.map(summarize) };
    },
  },

  get_contact: {
    description: "Fetch the full record for a single contact by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Contact id (e.g. c-001)." } },
      required: ["id"],
    },
    handler: async (args) => {
      const id = String(args.id ?? "");
      const contact = await getContactById(id);
      if (!contact) return { error: "not_found", id };
      return contact;
    },
  },

  find_contact_by_phone: {
    description:
      "Look up a contact by phone number. Accepts any format; normalised to E.164 before matching against both work and mobile numbers.",
    inputSchema: {
      type: "object",
      properties: {
        phone: { type: "string", description: "e.g. 415-555-0110 or +14155550110" },
      },
      required: ["phone"],
    },
    handler: async (args) => {
      const phone = String(args.phone ?? "");
      const contact = await findContactByPhone(phone);
      if (!contact) return { error: "not_found", phone };
      return contact;
    },
  },

  list_recent_activity: {
    description:
      "List recent call activity from Zoom Contact Center, newest first. Optionally filter by contactId.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
        contactId: { type: "string", description: "If set, only return calls for this contact." },
      },
    },
    handler: async (args) => {
      const limit =
        typeof args.limit === "number"
          ? Math.min(Math.max(Math.floor(args.limit), 1), 200)
          : 25;
      const contactId =
        typeof args.contactId === "string" && args.contactId ? args.contactId : null;
      const activity = contactId
        ? await listActivityForContact(contactId, limit)
        : await listRecentActivity(limit);
      return { count: activity.length, activity };
    },
  },

  create_contact: {
    description: "Create a new CRM contact. Only firstName, lastName, phone are required.",
    inputSchema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        title: { type: "string" },
        company: { type: "string" },
        industry: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        mobile: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        accountValue: { type: "number" },
      },
      required: ["firstName", "lastName", "phone"],
    },
    handler: async (args) => {
      const today = new Date().toISOString().slice(0, 10);
      const tags = Array.isArray(args.tags)
        ? (args.tags as unknown[]).filter((t): t is string => typeof t === "string")
        : [];
      const input: ContactInput = {
        firstName: String(args.firstName ?? ""),
        lastName: String(args.lastName ?? ""),
        title: String(args.title ?? ""),
        company: String(args.company ?? ""),
        industry: String(args.industry ?? ""),
        email: String(args.email ?? ""),
        phone: String(args.phone ?? ""),
        mobile: String(args.mobile ?? ""),
        city: String(args.city ?? ""),
        state: String(args.state ?? ""),
        tags,
        accountValue:
          typeof args.accountValue === "number" ? args.accountValue : 0,
        lastContacted: today,
      };
      return await createContact(input);
    },
  },

  update_contact: {
    description: "Update fields on an existing contact. Only fields you pass are changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        title: { type: "string" },
        company: { type: "string" },
        industry: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        mobile: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        accountValue: { type: "number" },
        lastContacted: { type: "string", description: "ISO date (YYYY-MM-DD)." },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const id = String(args.id ?? "");
      const patch: Partial<ContactInput> = {};
      const stringKeys: (keyof ContactInput)[] = [
        "firstName",
        "lastName",
        "title",
        "company",
        "industry",
        "email",
        "phone",
        "mobile",
        "city",
        "state",
        "lastContacted",
      ];
      for (const key of stringKeys) {
        const v = args[key];
        if (typeof v === "string") patch[key] = v as never;
      }
      if (typeof args.accountValue === "number") patch.accountValue = args.accountValue;
      if (Array.isArray(args.tags)) {
        patch.tags = (args.tags as unknown[]).filter(
          (t): t is string => typeof t === "string",
        );
      }
      const updated = await updateContact(id, patch);
      if (!updated) return { error: "not_found", id };
      return updated;
    },
  },

  log_call_note: {
    description:
      "Append a note to a logged call activity (by call_activity id). Useful for adding agent context after a Zoom call.",
    inputSchema: {
      type: "object",
      properties: {
        activityId: { type: "string" },
        note: { type: "string" },
      },
      required: ["activityId", "note"],
    },
    handler: async (args) => {
      const id = String(args.activityId ?? "");
      const note = String(args.note ?? "");
      const updated = await appendNoteToActivity(id, note);
      if (!updated) return { error: "not_found", activityId: id };
      return updated;
    },
  },
};

// ---------- Resources ----------

async function listResources() {
  const all = await listContacts();
  return [
    {
      uri: "crm://contacts",
      name: "All contacts",
      description: "Complete contact list as JSON.",
      mimeType: "application/json",
    },
    ...all.map((c) => ({
      uri: `crm://contact/${c.id}`,
      name: `${c.firstName} ${c.lastName} — ${c.company}`,
      description: `${c.title} · ${formatPhone(c.phone)}`,
      mimeType: "application/json",
    })),
  ];
}

async function readResource(uri: string) {
  if (uri === "crm://contacts") {
    const all = await listContacts();
    return {
      contents: [
        { uri, mimeType: "application/json", text: JSON.stringify(all, null, 2) },
      ],
    };
  }
  const m = /^crm:\/\/contact\/(.+)$/.exec(uri);
  if (m) {
    const c = await getContactById(m[1]);
    if (!c) throw new Error(`resource not found: ${uri}`);
    return {
      contents: [
        { uri, mimeType: "application/json", text: JSON.stringify(c, null, 2) },
      ],
    };
  }
  throw new Error(`unknown resource: ${uri}`);
}

// ---------- Dispatch ----------

async function dispatch(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;
  const isNotification = req.id === undefined;

  try {
    switch (req.method) {
      case "initialize": {
        const requested = (req.params as { protocolVersion?: string } | undefined)
          ?.protocolVersion;
        const protocolVersion =
          requested && SUPPORTED_PROTOCOL_VERSIONS.has(requested)
            ? requested
            : DEFAULT_PROTOCOL_VERSION;
        return ok(id, {
          protocolVersion,
          serverInfo: SERVER_INFO,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          instructions:
            "Acme CRM, exposed over MCP. Use search_contacts to find people, get_contact / find_contact_by_phone for the full record, list_recent_activity to review Zoom Contact Center calls, and the crm:// resources to attach contact records as context.",
        });
      }

      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/roots/list_changed":
        return null;

      case "ping":
        return ok(id, {});

      case "tools/list":
        return ok(id, {
          tools: Object.entries(TOOLS).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: def.inputSchema,
          })),
        });

      case "tools/call": {
        const params = req.params as
          | { name?: string; arguments?: Record<string, unknown> }
          | undefined;
        const name = params?.name ?? "";
        const tool = TOOLS[name];
        if (!tool) {
          return ok(id, {
            content: [{ type: "text", text: `unknown tool: ${name}` }],
            isError: true,
          });
        }
        try {
          const result = await tool.handler(params?.arguments ?? {});
          return ok(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
        } catch (e) {
          return ok(id, {
            content: [
              {
                type: "text",
                text: `error: ${e instanceof Error ? e.message : String(e)}`,
              },
            ],
            isError: true,
          });
        }
      }

      case "resources/list":
        return ok(id, { resources: await listResources() });

      case "resources/templates/list":
        return ok(id, {
          resourceTemplates: [
            {
              uriTemplate: "crm://contact/{id}",
              name: "Contact",
              description: "A single contact record by id.",
              mimeType: "application/json",
            },
          ],
        });

      case "resources/read": {
        const params = req.params as { uri?: string } | undefined;
        const uri = params?.uri ?? "";
        return ok(id, await readResource(uri));
      }

      case "prompts/list":
        return ok(id, { prompts: [] });

      default:
        if (isNotification) return null;
        return rpcErr(id, -32601, `method not found: ${req.method}`);
    }
  } catch (e) {
    if (isNotification) return null;
    return rpcErr(id, -32603, e instanceof Error ? e.message : "internal error");
  }
}

// ---------- HTTP plumbing ----------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function unauthorized(request: NextRequest, description: string): Response {
  const origin = originOf(request);
  const params = [
    `realm="democrm-mcp"`,
    `resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    `error="invalid_token"`,
    `error_description="${description.replace(/"/g, "'")}"`,
  ].join(", ");
  const wwwAuth = `Bearer ${params}`;
  return Response.json(rpcErr(null, -32001, "unauthorized"), {
    status: 401,
    headers: { ...CORS_HEADERS, "WWW-Authenticate": wwwAuth },
  });
}

async function checkAuth(request: NextRequest): Promise<Response | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return unauthorized(request, "missing bearer token");
  }
  const info = await validateAccessToken(match[1]);
  if (!info) {
    return unauthorized(request, "access token invalid or expired");
  }
  return null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const denied = await checkAuth(request);
  if (denied) return denied;
  return new Response(
    "Method Not Allowed: this server does not push server-initiated messages.",
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } },
  );
}

export async function POST(request: NextRequest) {
  const denied = await checkAuth(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcErr(null, -32700, "parse error"), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const isBatch = Array.isArray(body);
  const messages = isBatch ? (body as unknown[]) : [body];

  const responses: JsonRpcResponse[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object" || (m as { jsonrpc?: unknown }).jsonrpc !== "2.0") {
      responses.push(rpcErr(null, -32600, "invalid request"));
      continue;
    }
    const r = await dispatch(m as JsonRpcRequest);
    if (r) responses.push(r);
  }

  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  return Response.json(isBatch ? responses : responses[0], {
    status: 200,
    headers: CORS_HEADERS,
  });
}
