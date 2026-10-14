import { z } from "zod";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { isValidDiscountCodeFormat, normalizeDiscountCode } from "src/lib/discounts";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const updateDiscountSchema = z
  .object({
    code: z.string().trim().min(3).max(32).optional(),
    description: z.string().trim().max(240).optional(),
    type: z.enum(["percent", "flat_rupees", "fixed_price"]).optional(),
    target: z.enum(["all", "wallet_topup", "plan_pro", "plan_coach", "plan_connect"]).optional(),
    percentOff: z.number().int().min(1).max(95).optional(),
    flatAmountRupees: z.number().int().min(1).max(200000).optional(),
    fixedPriceRupees: z.number().int().min(1).max(200000).optional(),
    maxDiscountRupees: z.number().int().min(1).max(200000).optional().nullable(),
    minOrderRupees: z.number().int().min(1).max(200000).optional().nullable(),
    usageLimitTotal: z.number().int().min(1).max(100000).optional().nullable(),
    usageLimitPerUser: z.number().int().min(1).max(1000).optional().nullable(),
    active: z.boolean().optional(),
    startsAt: z.string().trim().optional(),
    endsAt: z.string().trim().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

function toNullableDate(input: string | undefined) {
  if (input === undefined) return undefined;
  const raw = String(input || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return Symbol("invalid_date");
  return date;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const { id } = await params;
    if (!id) return fail("Discount code id is required", 400, "VALIDATION_ERROR");

    const existing = await prisma.discountCode.findUnique({ where: { id } });
    if (!existing) return fail("Discount code not found", 404, "NOT_FOUND");

    const payload = updateDiscountSchema.parse(await req.json());
    const nextType = payload.type || existing.type;
    const nextCode = payload.code ? normalizeDiscountCode(payload.code) : existing.code;
    if (!isValidDiscountCodeFormat(nextCode)) {
      return fail("Code must be 3-32 chars and use A-Z, 0-9, _ or -", 400, "VALIDATION_ERROR");
    }

    const startsAtParsed = toNullableDate(payload.startsAt);
    const endsAtParsed = toNullableDate(payload.endsAt);
    if (typeof startsAtParsed === "symbol" || typeof endsAtParsed === "symbol") {
      return fail("Invalid startsAt or endsAt date", 400, "VALIDATION_ERROR");
    }
    const startsAt = startsAtParsed === undefined ? existing.startsAt : startsAtParsed;
    const endsAt = endsAtParsed === undefined ? existing.endsAt : endsAtParsed;
    if (startsAt && endsAt && endsAt < startsAt) {
      return fail("endsAt must be after startsAt", 400, "VALIDATION_ERROR");
    }

    const nextPercentOff =
      nextType === "percent"
        ? payload.percentOff !== undefined
          ? payload.percentOff
          : existing.percentOff
        : null;
    const nextFlatAmount =
      nextType === "flat_rupees"
        ? payload.flatAmountRupees !== undefined
          ? payload.flatAmountRupees
          : existing.flatAmountRupees
        : null;

    const nextFixedPrice =
      nextType === "fixed_price"
        ? payload.fixedPriceRupees !== undefined
          ? payload.fixedPriceRupees
          : existing.fixedPriceRupees
        : null;
    if (nextType === "fixed_price" && !nextFixedPrice) {
      return fail("fixedPriceRupees is required for fixed-price coupons", 400, "VALIDATION_ERROR");
    }

    if (nextType === "percent" && !nextPercentOff) {
      return fail("percentOff is required for percent discounts", 400, "VALIDATION_ERROR");
    }
    if (nextType === "flat_rupees" && !nextFlatAmount) {
      return fail("flatAmountRupees is required for flat discounts", 400, "VALIDATION_ERROR");
    }

    const updated = await prisma.discountCode.update({
      where: { id: existing.id },
      data: {
        code: nextCode,
        description: payload.description !== undefined ? payload.description || null : existing.description,
        type: nextType,
        target: payload.target || existing.target,
        percentOff: nextPercentOff || null,
        flatAmountRupees: nextFlatAmount || null,
        fixedPriceRupees: nextFixedPrice || null,
        maxDiscountRupees:
          payload.maxDiscountRupees !== undefined ? payload.maxDiscountRupees : existing.maxDiscountRupees,
        minOrderRupees: payload.minOrderRupees !== undefined ? payload.minOrderRupees : existing.minOrderRupees,
        usageLimitTotal:
          payload.usageLimitTotal !== undefined ? payload.usageLimitTotal : existing.usageLimitTotal,
        usageLimitPerUser:
          payload.usageLimitPerUser !== undefined ? payload.usageLimitPerUser : existing.usageLimitPerUser,
        active: payload.active !== undefined ? payload.active : existing.active,
        startsAt,
        endsAt,
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.discount_code_update",
      targetType: "discount_code",
      targetId: updated.id,
      metadataJson: {
        code: updated.code,
        active: updated.active,
        type: updated.type,
      },
    });

    return ok("Discount code updated", { code: updated });
  } catch (error) {
    return handleApiError(error, "Failed to update discount code");
  }
}
