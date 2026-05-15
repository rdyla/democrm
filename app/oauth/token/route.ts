import type { NextRequest } from "next/server";
import {
  OAUTH_CORS_HEADERS,
  consumeCode,
  getClient,
  issueTokenPair,
  rotateRefreshToken,
  verifyPkce,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  ...OAUTH_CORS_HEADERS,
  "cache-control": "no-store",
  pragma: "no-cache",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await readForm(request);
  } catch {
    return tokenError("invalid_request", "could not read request body");
  }

  const grantType = String(form.get("grant_type") ?? "");
  const auth = await authenticateClient(request, form);
  if (auth.error) return auth.error;

  if (grantType === "authorization_code") {
    return await handleAuthorizationCode(form, auth.clientId);
  }
  if (grantType === "refresh_token") {
    return await handleRefreshToken(form, auth.clientId);
  }
  return tokenError("unsupported_grant_type", `grant_type '${grantType}' is not supported`);
}

async function readForm(request: NextRequest): Promise<FormData> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    return await request.formData();
  }
  if (ct.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) fd.set(k, String(v));
    }
    return fd;
  }
  return await request.formData();
}

interface ClientAuthResult {
  clientId: string;
  error: Response | null;
}

async function authenticateClient(
  request: NextRequest,
  form: FormData,
): Promise<ClientAuthResult> {
  // client_secret_basic via Authorization: Basic
  const authz = request.headers.get("authorization") ?? "";
  let basicId: string | undefined;
  let basicSecret: string | undefined;
  const basic = /^Basic\s+(.+)$/i.exec(authz);
  if (basic) {
    try {
      const decoded = atob(basic[1]);
      const idx = decoded.indexOf(":");
      if (idx >= 0) {
        basicId = decodeURIComponent(decoded.slice(0, idx));
        basicSecret = decodeURIComponent(decoded.slice(idx + 1));
      }
    } catch {
      return {
        clientId: "",
        error: tokenError("invalid_client", "malformed Basic credentials"),
      };
    }
  }

  const clientId = basicId ?? String(form.get("client_id") ?? "");
  const clientSecret =
    basicSecret ?? (form.get("client_secret") ? String(form.get("client_secret")) : null);

  if (!clientId) {
    return { clientId: "", error: tokenError("invalid_client", "missing client_id") };
  }
  const client = await getClient(clientId);
  if (!client) {
    return { clientId: "", error: tokenError("invalid_client", "unknown client_id") };
  }

  if (client.tokenEndpointAuthMethod === "none") {
    return { clientId, error: null };
  }
  if (!clientSecret || clientSecret !== client.secret) {
    return {
      clientId: "",
      error: tokenError("invalid_client", "invalid client credentials"),
    };
  }
  return { clientId, error: null };
}

async function handleAuthorizationCode(
  form: FormData,
  authedClientId: string,
): Promise<Response> {
  const code = String(form.get("code") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeVerifier = String(form.get("code_verifier") ?? "");

  if (!code || !redirectUri || !codeVerifier) {
    return tokenError("invalid_request", "code, redirect_uri, and code_verifier are required");
  }

  const stored = await consumeCode(code);
  if (!stored) {
    return tokenError("invalid_grant", "authorization code is invalid, expired, or already used");
  }
  if (stored.clientId !== authedClientId) {
    return tokenError("invalid_grant", "code was issued to a different client");
  }
  if (stored.redirectUri !== redirectUri) {
    return tokenError("invalid_grant", "redirect_uri does not match the original request");
  }

  const pkceOk = await verifyPkce(
    codeVerifier,
    stored.codeChallenge,
    stored.codeChallengeMethod,
  );
  if (!pkceOk) {
    return tokenError("invalid_grant", "PKCE verification failed");
  }

  const tokens = await issueTokenPair({
    clientId: authedClientId,
    scope: stored.scope,
  });
  return tokenResponse(tokens);
}

async function handleRefreshToken(
  form: FormData,
  authedClientId: string,
): Promise<Response> {
  const refresh = String(form.get("refresh_token") ?? "");
  if (!refresh) return tokenError("invalid_request", "refresh_token is required");
  const rotated = await rotateRefreshToken(refresh);
  if (!rotated) {
    return tokenError("invalid_grant", "refresh_token is invalid, expired, or already used");
  }
  void authedClientId; // client identity already verified
  return tokenResponse(rotated);
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

function tokenResponse(tokens: TokenPair): Response {
  return Response.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    },
    { headers: NO_STORE_HEADERS },
  );
}

function tokenError(error: string, description: string): Response {
  return Response.json(
    { error, error_description: description },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}
