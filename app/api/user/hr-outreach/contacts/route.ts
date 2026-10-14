import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/hr-outreach/contacts
 * The signed-in user's own saved HR contacts. Shared recruiter contacts live in HR Contacts
 * (/api/user/hr-contacts, Pro Connect), never here.
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const contacts = await prisma.hROutreachContact.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return NextResponse.json({ contacts, isGlobal: false, total: contacts.length });
  } catch (err) {
    console.error("GET /hr-outreach/contacts error:", err);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

/**
 * POST /api/user/hr-outreach/contacts
 * Saves contacts the user collected to their own list (other users never see them here).
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const body = (await req.json()) as { contacts?: any[] };
    const incoming = Array.isArray(body.contacts) ? body.contacts.slice(0, 200) : [];

    if (incoming.length > 0) {
      const validContacts = incoming
        .filter((c) => Boolean(c.email || c.company || c.name))
        .map((c) => ({
          userId,
          name: c.name || "Hiring Manager",
          title: c.title || "Technical Recruiter",
          company: c.company || "Hiring Company",
          email: c.email || "",
          phone: c.phone || "",
          linkedinUrl: c.linkedinUrl || "",
          source: c.source || "extension",
          jobType: c.jobType || "Remote / Hybrid",
          searchKeyword: c.searchKeyword || "",
          searchDate: c.searchDate || new Date().toISOString(),
          notes: c.notes || "",
        }));

      if (validContacts.length > 0) {
        await prisma.hROutreachContact.createMany({
          data: validContacts,
          skipDuplicates: true,
        });
      }
    }

    // Return the user's updated list
    const allContacts = await prisma.hROutreachContact.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ success: true, count: allContacts.length, contacts: allContacts });
  } catch (err) {
    console.error("POST /hr-outreach/contacts error:", err);
    return NextResponse.json({ error: "Failed to save contacts" }, { status: 500 });
  }
}

