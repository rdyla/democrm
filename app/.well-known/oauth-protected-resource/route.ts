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
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      scopes_supported: SUPPORTED_SCOPES,
      bearer_methods_supported: ["header"],
      resource_documentation: `${origin}/`,
    },
    { headers: OAUTH_CORS_HEADERS },
  );
}
