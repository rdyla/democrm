import type { NextRequest } from "next/server";
import {
  OAUTH_CORS_HEADERS,
  registerClient,
  type TokenEndpointAuthMethod,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

interface RegistrationRequest {
  redirect_uris?: unknown;
  client_name?: unknown;
  client_uri?: unknown;
  scope?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
}

export async function POST(request: NextRequest) {
  let body: RegistrationRequest;
  try {
    body = (await request.json()) as RegistrationRequest;
  } catch {
    return errorResponse("invalid_client_metadata", "request body is not valid JSON");
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u),
      )
    : [];
  if (redirectUris.length === 0) {
    return errorResponse(
      "invalid_redirect_uri",
      "redirect_uris is required and must contain at least one http(s) URL",
    );
  }

  const method = pickAuthMethod(body.token_endpoint_auth_method);

  const client = await registerClient({
    redirectUris,
    clientName: typeof body.client_name === "string" ? body.client_name : "",
    clientUri: typeof body.client_uri === "string" ? body.client_uri : "",
    scopes: typeof body.scope === "string" ? body.scope : undefined,
    tokenEndpointAuthMethod: method,
  });

  return Response.json(
    {
      client_id: client.id,
      client_secret: client.secret ?? undefined,
      client_id_issued_at: Math.floor(client.createdAt / 1000),
      redirect_uris: client.redirectUris,
      client_name: client.clientName,
      client_uri: client.clientUri,
      scope: client.scopes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: OAUTH_CORS_HEADERS },
  );
}

function pickAuthMethod(v: unknown): TokenEndpointAuthMethod {
  if (
    v === "none" ||
    v === "client_secret_basic" ||
    v === "client_secret_post"
  ) {
    return v;
  }
  return "none";
}

function errorResponse(error: string, description: string) {
  return Response.json(
    { error, error_description: description },
    { status: 400, headers: OAUTH_CORS_HEADERS },
  );
}
