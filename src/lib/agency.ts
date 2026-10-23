import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma, UserPlan } from "@prisma/client";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { getRazorpayClient } from "src/lib/billing";
import { activatePurchasedPlan, PLAN_PERIOD_DAYS } from "src/lib/plan-access";
import { PLAN_LABEL, type PaidPlan } from "src/lib/plans";

/**
 * Admin > Agency. The admin adds a candidate, sends them a Razorpay Payment Link on WhatsApp, and the
 * payment activates the plan for PLAN_PERIOD_DAYS, the same as a one-time purchase on the Billing page.
 *
 *   createAgencyPaymentLink   new link for the candidate (an unpaid older link is cancelled)
 *   activateAgencyPayment     after a paid link (webhook, "Check payment") or a payment taken by hand
 *   refreshAgencyLink         reads the link from Razorpay, for when the webhook did not arrive
 *   setTemporaryPassword      login details to send on WhatsApp (only the hash is stored)
 */

const LINK_VALID_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function siteUrl() {
  return String(process.env.APP_SITE_URL || "https://www.autoapplycv.in").replace(/\/+$/, "");
}

/** Digits for wa.me and Razorpay: a 10-digit Indian number gets the 91 country code. */
export function phoneDigits(raw: string | null | undefined) {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function whatsAppUrl(phone: string | null | undefined, text: string) {
  const digits = phoneDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function createAgencyPaymentLink(clientId: string, plan: PaidPlan, amountPaise: number) {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!client) throw new Error("Agency client not found");

  const razorpay = await getRazorpayClient();
  if (client.linkId && client.linkStatus === "created") {
    // One open link per candidate, so an old link cannot be paid after a new one is sent.
    await razorpay.paymentLink.cancel(client.linkId).catch(() => null);
  }

  const contact = phoneDigits(client.user.phone);
  const link = await razorpay.paymentLink.create({
    amount: amountPaise,
    currency: "INR",
    description: `AutoApply CV ${PLAN_LABEL[plan]} - ${PLAN_PERIOD_DAYS} days`,
    reference_id: `ag_${client.id}_${Date.now().toString(36)}`.slice(0, 40),
    expire_by: Math.floor((Date.now() + LINK_VALID_DAYS * DAY_MS) / 1000),
    customer: {
      name: client.user.name,
      email: client.user.email,
      ...(contact.length >= 10 ? { contact: `+${contact}` } : {}),
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { source: "agency", userId: client.user.id, clientId: client.id, plan },
  });

  return prisma.agencyClient.update({
    where: { id: client.id },
    data: {
      linkId: link.id,
      linkUrl: link.short_url,
      linkPlan: plan,
      linkAmountPaise: amountPaise,
      linkStatus: "created",
      linkCreatedAt: new Date(),
    },
  });
}

/**
 * A received payment: the plan for PLAN_PERIOD_DAYS (extends an active period of the same plan) and a
 * purchase record that Revenue and Billing history read. Safe to call twice for the same payment id.
 */
export async function activateAgencyPayment(input: {
  userId: string;
  plan: PaidPlan;
  paymentId: string;
  amountPaise: number;
  linkId?: string | null;
  manual?: boolean;
  actorUserId?: string | null;
}) {
  const now = new Date();
  const finalRupees = Math.max(0, Math.round(input.amountPaise / 100));

  const activation = await prisma.$transaction(async (tx) => {
    const seen = await tx.paymentEvent.findUnique({ where: { eventId: input.paymentId } });
    if (seen) return null;
    await tx.paymentEvent.create({
      data: {
        provider: input.manual ? "manual" : "razorpay",
        eventId: input.paymentId,
        eventType: "order.paid",
        payload: {
          paymentId: input.paymentId,
          paymentLinkId: input.linkId || null,
          plan: input.plan,
          baseRupees: finalRupees,
          discountRupees: 0,
          finalRupees,
          discountCode: null,
          source: input.manual ? "agency_manual" : "agency_link",
        } as Prisma.InputJsonValue,
        processedAt: now,
      },
    });
    const activated = await activatePurchasedPlan(tx, input.userId, input.plan, now);
    const periodEnd = activated.planExpiresAt || new Date(now.getTime() + PLAN_PERIOD_DAYS * DAY_MS);
    const subscription = {
      provider: "razorpay",
      providerPlanId: `one_time_${input.plan}`,
      status: "active" as const,
      plan: input.plan as UserPlan,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
    };
    await tx.subscription.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, ...subscription },
      update: subscription,
    });
    await tx.agencyClient.updateMany({
      where: { userId: input.userId },
      data: {
        paidAt: now,
        paymentId: input.paymentId,
        ...(input.linkId ? { linkStatus: "paid" } : {}),
      },
    });
    return activated;
  });

  if (activation) {
    await writeAuditLog({
      actorUserId: input.userId,
      action: "billing.plan_purchased",
      targetType: "payment",
      targetId: input.paymentId,
      metadataJson: {
        plan: input.plan,
        finalRupees,
        discountCode: null,
        expiresAt: activation.planExpiresAt?.toISOString() || null,
        source: input.manual ? "agency_manual" : "agency_link",
        recordedBy: input.actorUserId || null,
      },
    }).catch(() => null);
  }
  return { alreadyDone: !activation, planExpiresAt: activation?.planExpiresAt || null };
}

/** Reads the candidate's link from Razorpay: activates the plan if it was paid, else updates its status. */
export async function refreshAgencyLink(clientId: string) {
  const client = await prisma.agencyClient.findUnique({ where: { id: clientId } });
  if (!client?.linkId) return { status: client?.linkStatus || "none", activated: false };

  const razorpay = await getRazorpayClient();
  const link = (await razorpay.paymentLink.fetch(client.linkId)) as unknown as {
    status: string;
    amount_paid: number;
    notes?: Record<string, string>;
    payments?: Array<{ payment_id: string; amount: number; status: string }> | null;
  };

  if (link.status === "paid") {
    const payment = (Array.isArray(link.payments) ? link.payments : []).find((p) => p.status === "captured") || link.payments?.[0];
    if (payment?.payment_id) {
      const result = await activateAgencyPayment({
        userId: client.userId,
        plan: (client.linkPlan || "connect") as PaidPlan,
        paymentId: payment.payment_id,
        amountPaise: Number(payment.amount) || Number(link.amount_paid) || client.linkAmountPaise || 0,
        linkId: client.linkId,
      });
      return { status: "paid", activated: !result.alreadyDone };
    }
  }

  const status = ["created", "paid", "expired", "cancelled"].includes(link.status) ? link.status : client.linkStatus;
  if (status !== client.linkStatus) await prisma.agencyClient.update({ where: { id: client.id }, data: { linkStatus: status } });
  return { status, activated: false };
}

// No 0/O or 1/l/I, so the password reads the same when typed from a phone screen.
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** A new temporary password for the account. The plain text is returned once and never stored. */
export async function setTemporaryPassword(userId: string) {
  const password = Array.from({ length: 10 }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join("");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return password;
}

export function paymentLinkMessage(name: string, plan: PaidPlan, amountPaise: number, linkUrl: string) {
  const firstName = name.split(/\s+/)[0] || "there";
  return [
    `Hi ${firstName},`,
    "",
    `Here is your payment link for AutoApply CV ${PLAN_LABEL[plan]} (₹${Math.round(amountPaise / 100)} for ${PLAN_PERIOD_DAYS} days):`,
    linkUrl,
    "",
    "Your plan is switched on automatically as soon as the payment goes through.",
    "",
    "AutoApply CV",
  ].join("\n");
}

export function loginDetailsMessage(input: { name: string; email: string; password?: string | null; plan: string; planExpiresAt?: Date | null }) {
  const firstName = input.name.split(/\s+/)[0] || "there";
  const planLine =
    input.plan !== "free"
      ? `Your ${PLAN_LABEL[input.plan as PaidPlan] || input.plan} plan is active${input.planExpiresAt ? ` until ${input.planExpiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.`
      : "";
  return [
    `Hi ${firstName},`,
    "",
    ...(planLine ? [planLine, ""] : []),
    "Your AutoApply CV login:",
    `Website: ${siteUrl()}/login`,
    `Email: ${input.email}`,
    input.password ? `Password: ${input.password}` : `Password: use the "OTP Code" tab to log in with a code sent to your email.`,
    "",
    ...(input.password ? ['Please change it after logging in (use "Forgot password" on the login page).', ""] : []),
    "AutoApply CV",
  ].join("\n");
}
