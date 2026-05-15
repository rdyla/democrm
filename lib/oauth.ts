import { getCloudflareContext } from "@opennextjs/cloudflare";

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

export const DEFAULT_SCOPE = "crm";
export const SUPPORTED_SCOPES = ["crm"] as const;

export type TokenEndpointAuthMethod =
  | "none"
  | "client_secret_basic"
  | "client_secret_post";

export interface OAuthClient {
  id: string;
  secret: string | null;
  redirectUris: string[];
  clientName: string;
  clientUri: string;
  scopes: string;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  createdAt: number;
}

interface OAuthClientRow {
  id: string;
  secret: string | null;
  redirect_uris: string;
  client_name: string;
  client_uri: string;
  scopes: string;
  token_endpoint_auth_method: string;
  created_at: number;
}

function rowToClient(r: OAuthClientRow): OAuthClient {
  let uris: string[] = [];
  try {
    const parsed = JSON.parse(r.redirect_uris) as unknown;
    if (Array.isArray(parsed)) {
      uris = parsed.filter((u): u is string => typeof u === "string");
    }
  } catch {
    uris = [];
  }
  return {
    id: r.id,
    secret: r.secret,
    redirectUris: uris,
    clientName: r.client_name,
    clientUri: r.client_uri,
    scopes: r.scopes,
    tokenEndpointAuthMethod:
      r.token_endpoint_auth_method as TokenEndpointAuthMethod,
    createdAt: r.created_at,
  };
}

export function originOf(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? url.host;
  const proto = (forwardedProto ?? url.protocol.replace(":", "")).toLowerCase();
  return `${proto}://${host}`;
}

export function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

export async function verifyPkce(
  verifier: string,
  challenge: string,
  method: string,
): Promise<boolean> {
  if (method !== "S256") return false;
  if (!verifier || !challenge) return false;
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(hash) === challenge;
}

export async function registerClient(input: {
  redirectUris: string[];
  clientName?: string;
  clientUri?: string;
  scopes?: string;
  tokenEndpointAuthMethod?: TokenEndpointAuthMethod;
}): Promise<OAuthClient> {
  const id = `mcp-${randomToken(12)}`;
  const method: TokenEndpointAuthMethod = input.tokenEndpointAuthMethod ?? "none";
  const secret = method === "none" ? null : randomToken(32);
  const scopes = input.scopes ?? DEFAULT_SCOPE;
  await db()
    .prepare(
      `INSERT INTO oauth_clients
         (id, secret, redirect_uris, client_name, client_uri, scopes, token_endpoint_auth_method)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      secret,
      JSON.stringify(input.redirectUris),
      input.clientName ?? "",
      input.clientUri ?? "",
      scopes,
      method,
    )
    .run();
  return {
    id,
    secret,
    redirectUris: input.redirectUris,
    clientName: input.clientName ?? "",
    clientUri: input.clientUri ?? "",
    scopes,
    tokenEndpointAuthMethod: method,
    createdAt: Date.now(),
  };
}

export async function getClient(id: string): Promise<OAuthClient | null> {
  const row = await db()
    .prepare("SELECT * FROM oauth_clients WHERE id = ?")
    .bind(id)
    .first<OAuthClientRow>();
  return row ? rowToClient(row) : null;
}

export async function issueCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
}): Promise<string> {
  const code = randomToken(32);
  const expiresAt = Date.now() + CODE_TTL_MS;
  await db()
    .prepare(
      `INSERT INTO oauth_codes
         (code, client_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      code,
      input.clientId,
      input.redirectUri,
      input.codeChallenge,
      input.codeChallengeMethod,
      input.scope,
      expiresAt,
    )
    .run();
  return code;
}

export interface AuthCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
}

interface OAuthCodeRow {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  expires_at: number;
  used: number;
}

export async function consumeCode(code: string): Promise<AuthCode | null> {
  const row = await db()
    .prepare("SELECT * FROM oauth_codes WHERE code = ?")
    .bind(code)
    .first<OAuthCodeRow>();
  if (!row) return null;
  if (row.used !== 0 || row.expires_at < Date.now()) return null;
  await db()
    .prepare("UPDATE oauth_codes SET used = 1 WHERE code = ?")
    .bind(code)
    .run();
  return {
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: row.code_challenge_method,
    scope: row.scope,
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

export async function issueTokenPair(input: {
  clientId: string;
  scope: string;
}): Promise<TokenPair> {
  const access = randomToken(32);
  const refresh = randomToken(32);
  const now = Date.now();
  await db()
    .prepare(
      `INSERT INTO oauth_tokens (token, kind, client_id, scope, expires_at)
       VALUES (?, 'access', ?, ?, ?)`,
    )
    .bind(access, input.clientId, input.scope, now + ACCESS_TOKEN_TTL_MS)
    .run();
  await db()
    .prepare(
      `INSERT INTO oauth_tokens (token, kind, client_id, scope, expires_at)
       VALUES (?, 'refresh', ?, ?, ?)`,
    )
    .bind(refresh, input.clientId, input.scope, now + REFRESH_TOKEN_TTL_MS)
    .run();
  return {
    accessToken: access,
    refreshToken: refresh,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: input.scope,
  };
}

interface OAuthTokenRow {
  token: string;
  kind: "access" | "refresh";
  client_id: string;
  scope: string;
  expires_at: number;
  revoked: number;
}

export interface AccessTokenInfo {
  clientId: string;
  scope: string;
  expiresAt: number;
}

export async function validateAccessToken(
  token: string,
): Promise<AccessTokenInfo | null> {
  const row = await db()
    .prepare("SELECT * FROM oauth_tokens WHERE token = ?")
    .bind(token)
    .first<OAuthTokenRow>();
  if (!row) return null;
  if (row.kind !== "access" || row.revoked !== 0 || row.expires_at < Date.now()) {
    return null;
  }
  return { clientId: row.client_id, scope: row.scope, expiresAt: row.expires_at };
}

export async function rotateRefreshToken(token: string): Promise<TokenPair | null> {
  const row = await db()
    .prepare("SELECT * FROM oauth_tokens WHERE token = ?")
    .bind(token)
    .first<OAuthTokenRow>();
  if (!row) return null;
  if (row.kind !== "refresh" || row.revoked !== 0 || row.expires_at < Date.now()) {
    return null;
  }
  await db()
    .prepare("UPDATE oauth_tokens SET revoked = 1 WHERE token = ?")
    .bind(token)
    .run();
  return await issueTokenPair({ clientId: row.client_id, scope: row.scope });
}

export const OAUTH_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
