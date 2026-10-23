import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import { PAID_PLANS, planAmountPaise } from "src/lib/plans";
import {
  activateAgencyPayment,
  createAgencyPaymentLink,
  loginDetailsMessage,
  paymentLinkMessage,
  refreshAgencyLink,
  setTemporaryPassword,
  whatsAppUrl,
} from "src/lib/agency";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const actionSchema = z.discriminatedUnion("action", [
  // New Razorpay link; amountRupees defaults to the plan price.
  z.object({ action: z.literal("payment_link"), plan: z.enum(PAID_PLANS).default("connect"), amountRupees: z.number().int().min(1).max(100000).optional() }),
  // Ask Razorpay whether the link was paid (in case the webhook did not arrive).
  z.object({ action: z.literal("check_payment") }),
  // Payment taken outside the link (UPI to the admin, cash).
  z.object({ action: z.literal("mark_paid"), plan: z.enum(PAID_PLANS).default("connect"), amountRupees: z.number().int().min(0).max(100000), reference: z.string().trim().max(120).optional() }),
  // WhatsApp message with the login details; new temporary password for accounts created here.
  z.object({ action: z.literal("login_details"), newPassword: z.boolean().default(true) }),
  z.object({ action: z.literal("note"), note: z.string().trim().max(1000) }),
]);

const CLIENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true, currentCity: true, plan: true, planExpiresAt: true, onboardingCompleted: true } },
} as const;

/** POST /api/admin/agency/:id { action, ... } : payment link, payment check, manual payment, login details. */
export async function POST(req: NextRequest, context: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const adminId = authResult.auth.user.id;
    const { id } = await context.params;
    const body = actionSchema.parse(await req.json());

    const client = await prisma.agencyClient.findUnique({ where: { id }, include: CLIENT_INCLUDE });
    if (!client) return fail("Candidate not found", 404, "NOT_FOUND");
    const { user } = client;

    if (body.action === "payment_link") {
      const amountPaise = body.amountRupees ? body.amountRupees * 100 : planAmountPaise(body.plan);
      const updated = await createAgencyPaymentLink(client.id, body.plan, amountPaise);
      await writeAuditLog({
        actorUserId: adminId,
        action: "admin.agency_link_created",
        targetType: "user",
        targetId: user.id,
        metadataJson: { linkId: updated.linkId, plan: body.plan, amountPaise },
      }).catch(() => null);
      const message = paymentLinkMessage(user.name, body.plan, amountPaise, updated.linkUrl || "");
      return ok("Payment link created", { linkUrl: updated.linkUrl, message, whatsappUrl: whatsAppUrl(user.phone, message) });
    }

    if (body.action === "check_payment") {
      const result = await refreshAgencyLink(client.id);
      return ok(result.activated ? "Payment found: plan activated" : `Link status: ${result.status}`, result);
    }

    if (body.action === "mark_paid") {
      const paymentId = `manual_${client.id}_${Date.now().toString(36)}`;
      const result = await activateAgencyPayment({
        userId: user.id,
        plan: body.plan,
        paymentId,
        amountPaise: body.amountRupees * 100,
        manual: true,
        actorUserId: adminId,
      });
      if (client.linkId && client.linkStatus === "created") {
        await prisma.agencyClient.update({ where: { id: client.id }, data: { linkStatus: "cancelled" } });
      }
      await writeAuditLog({
        actorUserId: adminId,
        action: "admin.agency_marked_paid",
        targetType: "user",
        targetId: user.id,
        metadataJson: { paymentId, plan: body.plan, amountRupees: body.amountRupees, reference: body.reference || null },
      }).catch(() => null);
      return ok("Payment recorded: plan activated", { planExpiresAt: result.planExpiresAt });
    }

    if (body.action === "login_details") {
      // Only accounts created here get a password from the admin; others keep the one they chose.
      const password = client.createdAccount && body.newPassword ? await setTemporaryPassword(user.id) : null;
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, planExpiresAt: true } });
      const message = loginDetailsMessage({ name: user.name, email: user.email, password, plan: fresh?.plan || user.plan, planExpiresAt: fresh?.planExpiresAt });
      await writeAuditLog({
        actorUserId: adminId,
        action: "admin.agency_login_details",
        targetType: "user",
        targetId: user.id,
        metadataJson: { newPassword: Boolean(password) },
      }).catch(() => null);
      return ok("Login details ready", { message, whatsappUrl: whatsAppUrl(user.phone, message), password });
    }

    const updated = await prisma.agencyClient.update({ where: { id: client.id }, data: { note: body.note }, include: CLIENT_INCLUDE });
    return ok("Note saved", { client: updated });
  } catch (error) {
    // Razorpay errors are plain objects; show their reason (e.g. an invalid phone number) to the admin.
    const razorpayReason = (error as { error?: { description?: string } } | null)?.error?.description;
    if (razorpayReason) return fail(`Razorpay: ${razorpayReason}`, 502, "RAZORPAY_ERROR");
    return handleApiError(error, "Agency action failed");
  }
}

/** DELETE /api/admin/agency/:id : removes the candidate from the Agency list. The account itself stays. */
export async function DELETE(_req: NextRequest, context: RouteParams) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  const removed = await prisma.agencyClient.deleteMany({ where: { id } });
  if (!removed.count) return fail("Candidate not found", 404, "NOT_FOUND");
  return ok("Removed from Agency list");
}
