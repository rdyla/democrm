import type { NextRequest } from "next/server";
import { findContactByPhone } from "@/lib/contacts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) {
    return Response.json({ error: "missing phone" }, { status: 400 });
  }
  const contact = await findContactByPhone(phone);
  if (!contact) return Response.json({ contactId: null }, { status: 200 });
  return Response.json({
    contactId: contact.id,
    name: `${contact.firstName} ${contact.lastName}`,
    company: contact.company,
  });
}
