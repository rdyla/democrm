import type { NextRequest } from "next/server";
import { getClient, issueCode, DEFAULT_SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";

interface AuthorizeParams {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
}

function readParams(src: URLSearchParams | FormData): AuthorizeParams {
  const get = (k: string): string => {
    const v = src.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    responseType: get("response_type"),
    clientId: get("client_id"),
    redirectUri: get("redirect_uri"),
    codeChallenge: get("code_challenge"),
    codeChallengeMethod: get("code_challenge_method") || "S256",
    state: get("state"),
    scope: get("scope") || DEFAULT_SCOPE,
  };
}

export async function GET(request: NextRequest) {
  const params = readParams(request.nextUrl.searchParams);
  const validation = await validate(params);
  if (!validation.ok) return validation.response;
  return renderConsentPage(validation.clientName, params);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = readParams(form);
  const decision = String(form.get("decision") ?? "");
  const validation = await validate(params);
  if (!validation.ok) return validation.response;

  if (decision !== "approve") {
    return redirectWithError(
      params.redirectUri,
      "access_denied",
      "user denied authorization",
      params.state,
    );
  }

  const code = await issueCode({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    scope: params.scope,
  });

  const url = new URL(params.redirectUri);
  url.searchParams.set("code", code);
  if (params.state) url.searchParams.set("state", params.state);
  return Response.redirect(url.toString(), 302);
}

type ValidationResult =
  | { ok: true; clientName: string }
  | { ok: false; response: Response };

async function validate(params: AuthorizeParams): Promise<ValidationResult> {
  if (params.responseType !== "code") {
    return {
      ok: false,
      response: renderError("Unsupported response_type — only 'code' is supported."),
    };
  }
  if (params.codeChallengeMethod !== "S256") {
    return {
      ok: false,
      response: renderError(
        "Unsupported code_challenge_method — only S256 is supported.",
      ),
    };
  }
  if (!params.codeChallenge) {
    return {
      ok: false,
      response: renderError("Missing PKCE code_challenge."),
    };
  }
  if (!params.clientId) {
    return { ok: false, response: renderError("Missing client_id.") };
  }
  const client = await getClient(params.clientId);
  if (!client) {
    return { ok: false, response: renderError("Unknown client_id.") };
  }
  if (!client.redirectUris.includes(params.redirectUri)) {
    return {
      ok: false,
      response: renderError(
        "redirect_uri is not registered for this client. Re-run dynamic client registration with the correct URI.",
      ),
    };
  }
  return { ok: true, clientName: client.clientName || client.id };
}

function renderConsentPage(clientName: string, params: AuthorizeParams) {
  const safe = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Authorize ${safe(clientName)} — Acme CRM</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #f8fafc;
    color: #0f172a;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    padding: 28px 32px;
    width: 100%;
    max-width: 440px;
  }
  .logo {
    display: inline-flex; align-items: center; gap: 8px;
    font-weight: 600; font-size: 13px; color: #475569;
    margin-bottom: 18px;
  }
  .logo .badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 6px;
    background: #2563eb; color: #fff; font-size: 12px; font-weight: 700;
  }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .sub { color: #64748b; font-size: 14px; margin: 0 0 18px; }
  .panel {
    background: #f1f5f9; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;
    font-size: 13px; color: #334155;
  }
  .panel strong { color: #0f172a; }
  ul { margin: 8px 0 0 18px; padding: 0; }
  ul li { margin: 4px 0; }
  .actions { display: flex; gap: 10px; }
  button {
    flex: 1; padding: 10px 14px; border-radius: 8px;
    font-size: 14px; font-weight: 500; cursor: pointer;
    border: 1px solid transparent;
  }
  .approve { background: #2563eb; color: #fff; }
  .approve:hover { background: #1d4ed8; }
  .deny { background: #fff; color: #0f172a; border-color: #cbd5e1; }
  .deny:hover { background: #f1f5f9; }
  .meta { margin-top: 16px; font-size: 11px; color: #94a3b8; word-break: break-all; }
</style>
</head>
<body>
  <form class="card" method="post" action="/oauth/authorize">
    <div class="logo"><span class="badge">A</span> Acme CRM</div>
    <h1>Authorize ${safe(clientName)}</h1>
    <p class="sub">This MCP client is requesting access to the Acme CRM demo data.</p>
    <div class="panel">
      <strong>It will be able to:</strong>
      <ul>
        <li>Read and search contacts</li>
        <li>Read recent Zoom Contact Center call activity</li>
        <li>Create and update contacts</li>
        <li>Append notes to logged calls</li>
      </ul>
    </div>
    <input type="hidden" name="response_type" value="${safe(params.responseType)}" />
    <input type="hidden" name="client_id" value="${safe(params.clientId)}" />
    <input type="hidden" name="redirect_uri" value="${safe(params.redirectUri)}" />
    <input type="hidden" name="code_challenge" value="${safe(params.codeChallenge)}" />
    <input type="hidden" name="code_challenge_method" value="${safe(params.codeChallengeMethod)}" />
    <input type="hidden" name="state" value="${safe(params.state)}" />
    <input type="hidden" name="scope" value="${safe(params.scope)}" />
    <div class="actions">
      <button class="deny" type="submit" name="decision" value="deny">Cancel</button>
      <button class="approve" type="submit" name="decision" value="approve">Authorize</button>
    </div>
    <div class="meta">redirect: ${safe(params.redirectUri)}</div>
  </form>
</body>
</html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function renderError(message: string) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Authorization error</title>
<style>body{font-family:system-ui;max-width:480px;margin:60px auto;padding:0 24px;color:#0f172a;}
.card{border:1px solid #fecaca;background:#fef2f2;border-radius:10px;padding:20px;}
h1{font-size:18px;margin:0 0 8px;color:#991b1b;}
p{margin:0;color:#7f1d1d;font-size:14px;}</style></head>
<body><div class="card"><h1>Cannot authorize</h1><p>${message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p></div></body></html>`;
  return new Response(html, {
    status: 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function redirectWithError(
  redirectUri: string,
  error: string,
  description: string,
  state: string,
) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url.toString(), 302);
}
