# democrm — Zoom Contact Center reference CRM

A small Next.js app demonstrating two Zoom Contact Center integration paths, end-to-end, against real protocols:

1. **Smart Embed** — Zoom's agent call-bar iframe with `postMessage` integration: screen-pop, contact search, click-to-dial, and call-log write-back.
2. **MCP server** — exposes the CRM over [Model Context Protocol](https://modelcontextprotocol.io) (Streamable HTTP, OAuth 2.1 + PKCE + Dynamic Client Registration) so Zoom AI Companion (or any MCP client) can read/write CRM data on behalf of the agent.

The data is mock, but the integration code is the real shape — both surfaces follow the public Zoom + MCP specs. If you're debugging a similar integration, this repo is meant to be a working reference you can diff your own code against.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind v4
- Cloudflare Workers via `@opennextjs/cloudflare`
- D1 (SQLite) for persistence
- TypeScript strict

## Setup

Prerequisites: Node 20+, a Cloudflare account, and `wrangler` access to it. For the Smart Embed half you also need a Zoom Contact Center account with the embed feature enabled, and for the MCP half a Zoom OAuth app (Marketplace).

```bash
git clone <repo>
cd democrm
npm install
npx wrangler login
```

At the OAuth consent screen, make sure D1:Edit scope is approved for the account you'll deploy under — older logins don't have it and migrations will 401 with Cloudflare error 10000. If you have multiple accounts, ensure both are selected.

### Configure your account + database

In `wrangler.toml` replace:

- `account_id` with your Cloudflare account id (`npx wrangler whoami`)
- `database_id` and `database_name` under `[[d1_databases]]` with a database you've created (`npx wrangler d1 create democrm-db`)
- Optionally uncomment the `[[routes]]` block for a custom domain

### Apply migrations

```bash
npm run d1:migrate:remote   # production D1
npm run d1:migrate:local    # local dev D1 (uses $TMPDIR)
```

There are four migrations: `0001_init` (call_activity), `0002_contacts`, `0003_seed_contacts`, `0004_oauth` (OAuth tables).

### Dev / deploy

```bash
npm run dev      # http://localhost:3000
npm run deploy   # opennext build + wrangler deploy
```

Note: stop the dev server before running `deploy` — both spin up miniflare against the same local D1 file and will SQLITE_BUSY each other.

## Smart Embed integration

Mounted in `components/SmartEmbedDock.tsx`, rendered in the root layout so the call bar stays visible while the agent navigates the CRM.

### iframe

```tsx
src="https://zoom.us/cci/callbar/crm/?origin=<parent-origin>"
sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin allow-downloads"
allow=";autoplay;microphone;camera;display-capture;midi;encrypted-media;clipboard-write;"
```

- `?origin=` is derived from `window.location.origin` at runtime so the same code works on localhost, `*.workers.dev`, and your custom domain. Zoom rejects messages whose parent origin doesn't match what was passed at load.
- Drop `allow-same-origin` and Zoom's auth cookies don't apply — embed never signs in.
- Drop `microphone` from `allow` and the agent has no audio path. This is the most common "the embed loads but calls don't work" report.

### postMessage protocol

All messages are `{ type: string, data: any }`. **Always validate `event.origin === "https://zoom.us"` before touching the payload** — failing to do so is a real XSS vector.

**From the embed → CRM (handle these):**

| `type` | When | What you must do |
|---|---|---|
| `zcc-init-config-request` | Embed boots | Reply `zcc-init-config-response` with `{ phone: { screenPopEvent: "RINGING" } }` (or `"CONNECTED"`) |
| `zcc-contact-search-event` | Agent typed in the embed's search box | Reply `zcc-contact-search-response` with `{ id, name, phone, email, entity: "Contact" }` or `{}` |
| `zcc-incomingPhone-request` | Inbound voice/SMS engagement arrives | Reply `zcc-incomingPhone-response` with an **array** of matches (lets agent pick one) |
| `zcc-screen-pop` | Agent selected a contact from the multi-match list | Navigate to that contact's record |
| `zcc-call-ringing`, `zcc-call-connected` | Inbound call states | Trigger screen-pop based on `from` |
| `zcc-call-ended`, `zcc-phone-call-log`, `zcc-call-recording`, `zcc-engagement-log-url` | Call wrap-up + disposition | Persist to CRM activity log |

**From CRM → embed (you send these):**

| `type` | When | Payload |
|---|---|---|
| `onclicktoact` | User clicked a Call button | `{ id, name, phone, email, userEntity: "Contact" }` |

Gotchas worth memorizing:

- `onclicktoact` is the exact wire name. Not `clickToDial`, not `click_to_dial`. The embed silently drops anything else.
- Outbound uses `userEntity`; the embed echoes it back as `entity` inside `objectRecord` on write-back. Mismatched names are a common cause of "the call goes through but no log appears."
- `zcc-incomingPhone-response` expects an array, even with a single match. Agent selection triggers `zcc-screen-pop`.

### Call-log write-back shape

The `zcc-phone-call-log` event carries an `objectRecord`:

```json
{
  "objectRecord": {
    "callType": "inbound|outbound",
    "from": "+1...",
    "to": "+1...",
    "callDuration": 180,
    "callStartTime": 1747280000000,
    "callEndTime": 1747280180000,
    "notes": "...",
    "dispositionCode": "completed"
  },
  "engagementId": "abc123",
  "user": { "id": "c-001", "name": "...", "phone": "...", "email": "..." }
}
```

`user.id` is whatever id you previously returned in `zcc-contact-search-response` or sent in `onclicktoact` — that's the reliable way to associate the call back to your CRM record, more reliable than re-doing phone-number lookup. Field-by-field normalization lives in `app/api/activity/route.ts`.

## MCP server

Endpoint: `https://<your-host>/mcp`

Streamable HTTP transport (single endpoint, JSON-RPC 2.0). Auth follows the MCP authorization spec: OAuth 2.1 + PKCE + RFC 7591 Dynamic Client Registration. No static tokens, no API keys baked in — the MCP client (Zoom, Claude Desktop, claude.ai connector, the Anthropic API `mcp_servers` param, etc.) discovers the OAuth metadata, registers itself, walks the consent flow, and from then on calls `/mcp` with a real bearer.

### Tools

| Name | Purpose |
|---|---|
| `search_contacts` | Free-text over name/company/title/email |
| `get_contact` | Full record by id |
| `find_contact_by_phone` | E.164-normalized phone lookup |
| `list_recent_activity` | Recent ZCC call activity, optional `contactId` filter |
| `create_contact` | Create (firstName/lastName/phone required) |
| `update_contact` | Partial update by id |
| `log_call_note` | Append a note to a logged call by activity id |

### Resources

- `crm://contacts` — full contact list as JSON
- `crm://contact/{id}` — single contact (URI template)

### Discovery + auth flow

When any MCP client points at `/mcp`:

1. **Discovery probe** — unauthenticated request → `401` with
   ```
   WWW-Authenticate: Bearer realm="democrm-mcp",
     resource_metadata="https://<host>/.well-known/oauth-protected-resource",
     error="invalid_token", error_description="..."
   ```
   (RFC 6750 format — `Bearer` scheme, **space**, then comma-separated params. Strict clients reject malformed `Bearer, realm=...`.)
2. **Protected resource metadata** (RFC 9728) — `GET /.well-known/oauth-protected-resource` returns the resource URL, the authorization server(s), and supported scopes.
3. **Authorization server metadata** (RFC 8414) — `GET /.well-known/oauth-authorization-server` returns the authorize/token/register endpoints, supported grant types, and PKCE methods. S256 only.
4. **Dynamic Client Registration** (RFC 7591) — client `POST`s to `/oauth/register` with `redirect_uris`; server mints a `client_id` (and a `client_secret` if `token_endpoint_auth_method` requests confidential auth).
5. **Authorization** — user is redirected to `/oauth/authorize?response_type=code&client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...&scope=crm`. A consent page renders; on Approve, a single-use code (10 min TTL) is minted, bound to the PKCE challenge, and the user is redirected back.
6. **Token exchange** — client `POST`s to `/oauth/token` with `grant_type=authorization_code`, the code, `code_verifier`, and `redirect_uri`. Server verifies PKCE and mints a 1-hour access token + 30-day refresh token. Both are opaque, D1-backed, individually revocable. Supports `client_secret_basic` / `client_secret_post` / public-client PKCE.
7. **Refresh** — `grant_type=refresh_token` rotates the refresh (single-use; the old refresh is revoked).
8. **MCP calls** — every request to `/mcp` carries `Authorization: Bearer <access>`, validated against D1.

### Registering with a Zoom OAuth app

In your Zoom OAuth app's MCP Server section: paste `https://<your-host>/mcp` as the URL, give it a name/description, and click **Check**. Zoom walks steps 1–4 above. When a Zoom user later connects in AI Companion, steps 5–8 fire interactively.

### Testing manually

Sanity-check the discovery chain:

```bash
curl -i https://<host>/mcp
curl -s https://<host>/.well-known/oauth-protected-resource | jq
curl -s https://<host>/.well-known/oauth-authorization-server | jq
```

End-to-end as a public client:

```bash
# 1. Register
CLIENT_ID=$(curl -s -X POST https://<host>/oauth/register \
  -H "content-type: application/json" \
  -d '{"redirect_uris":["http://localhost:9999/cb"],"client_name":"curl test"}' \
  | jq -r '.client_id')

# 2. Mint a PKCE verifier/challenge
VERIFIER=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary | base64 | tr '+/' '-_' | tr -d '=')

# 3. Open this in a browser and click Authorize:
echo "https://<host>/oauth/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=http://localhost:9999/cb&code_challenge=$CHALLENGE&code_challenge_method=S256&state=xyz&scope=crm"

# 4. Grab ?code=... from the redirect, then:
ACCESS=$(curl -s -X POST https://<host>/oauth/token \
  -d grant_type=authorization_code -d code=<paste> \
  -d redirect_uri=http://localhost:9999/cb -d code_verifier=$VERIFIER \
  -d client_id=$CLIENT_ID | jq -r '.access_token')

# 5. Call MCP
curl -X POST https://<host>/mcp \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq
```

## File map

```
app/
  layout.tsx                # 3-col shell: sidebar | main | embed dock
  page.tsx                  # Dashboard
  contacts/                 # List, detail, new, edit
  activity/page.tsx         # Call activity log
  api/
    contacts/lookup/        # Phone → contact (used by SmartEmbedDock)
    activity/               # Call activity write-back endpoint
  mcp/route.ts              # MCP server (Streamable HTTP, JSON-RPC 2.0)
  oauth/
    register/               # RFC 7591 DCR
    authorize/              # Consent page + auth code issuance
    token/                  # PKCE + refresh-token grants
  .well-known/
    oauth-protected-resource/   # RFC 9728
    oauth-authorization-server/ # RFC 8414

components/
  SmartEmbedDock.tsx        # Zoom iframe + postMessage bridge
  CallButton.tsx            # Click-to-dial trigger
  ScreenPopBanner.tsx
  Sidebar.tsx, SidebarNav.tsx, ActivityRow.tsx,
  ContactForm.tsx, DeleteContactButton.tsx

lib/
  contacts.ts               # Contact CRUD (D1)
  db.ts                     # Call activity CRUD (D1)
  oauth.ts                  # PKCE, token issuance/validation, DCR
  phone.ts                  # E.164 normalize + display
  types.ts

migrations/
  0001_init.sql             # call_activity
  0002_contacts.sql         # contacts
  0003_seed_contacts.sql    # 12 seed contacts
  0004_oauth.sql            # oauth_clients / oauth_codes / oauth_tokens
```

## Known limitations

- The OAuth consent page auto-trusts whoever's loading it — there is no CRM user model. In production you'd gate `/oauth/authorize` behind real CRM auth so consent is tied to a known user identity.
- Access tokens are opaque random strings, validated against D1 on every MCP call. Fine at moderate RPS; at very high traffic you'd want JWT-style stateless tokens or an edge cache.
- The seed data is intentionally cartoonish — replace `migrations/0003_seed_contacts.sql` (or skip it) before connecting to real Zoom Contact Center traffic.
- The included Smart Embed event handlers cover the standard call lifecycle but don't yet handle SMS-only engagements, transfer events, or warm-transfer mid-call. The pattern is the same — add cases to `handleEmbedMessage` in `components/SmartEmbedDock.tsx`.
