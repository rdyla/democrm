import type { NextRequest } from "next/server";
import { OAUTH_CORS_HEADERS, originOf, SUPPORTED_SCOPES } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const origin = originOf(request);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: [
        "none",
        "client_secret_basic",
        "client_secret_post",
      ],
      scopes_supported: SUPPORTED_SCOPES,
      service_documentation: `${origin}/`,
    },
    { headers: OAUTH_CORS_HEADERS },
  );
}
