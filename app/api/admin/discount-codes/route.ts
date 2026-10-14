import { z } from "zod";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { isValidDiscountCodeFormat, normalizeDiscountCode } from "src/lib/discounts";

const createDiscountSchema = z.object({
  code: z.string().trim().min(3).max(32),
  description: z.string().trim().max(240).optional().default(""),
  type: z.enum(["percent", "flat_rupees", "fixed_price"]),
  target: z.enum(["all", "wallet_topup", "plan_pro", "plan_coach", "plan_connect"]).default("wallet_topup"),
  percentOff: z.number().int().min(1).max(95).optional(),
  flatAmountRupees: z.number().int().min(1).max(200000).optional(),
  fixedPriceRupees: z.number().int().min(1).max(200000).optional(),
  maxDiscountRupees: z.number().int().min(1).max(200000).optional(),
  minOrderRupees: z.number().int().min(1).max(200000).optional(),
  usageLimitTotal: z.number().int().min(1).max(100000).optional(),
  usageLimitPerUser: z.number().int().min(1).max(1000).optional(),
  active: z.boolean().optional().default(true),
  startsAt: z.string().trim().optional().default(""),
  endsAt: z.string().trim().optional().default(""),
});

function toNullableDate(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const [codes, total] = await Promise.all([
      prisma.discountCode.findMany({
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          description: true,
          type: true,
          target: true,
          percentOff: true,
          flatAmountRupees: true,
          fixedPriceRupees: true,
          maxDiscountRupees: true,
          minOrderRupees: true,
          usageLimitTotal: true,
          usageLimitPerUser: true,
          usedCount: true,
          active: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.discountCode.count(),
    ]);

    return ok("Discount codes fetched", {
      codes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch discount codes");
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const payload = createDiscountSchema.parse(await req.json());
    const code = normalizeDiscountCode(payload.code);
    if (!isValidDiscountCodeFormat(code)) {
      return fail("Code must be 3-32 chars and use A-Z, 0-9, _ or -", 400, "VALIDATION_ERROR");
    }

    if (payload.type === "percent" && !payload.percentOff) {
      return fail("percentOff is required for percent discounts", 400, "VALIDATION_ERROR");
    }
    if (payload.type === "fixed_price" && !payload.fixedPriceRupees) {
      return fail("fixedPriceRupees is required for fixed-price coupons", 400, "VALIDATION_ERROR");
    }
    if (payload.type === "flat_rupees" && !payload.flatAmountRupees) {
      return fail("flatAmountRupees is required for flat discounts", 400, "VALIDATION_ERROR");
    }

    const startsAt = toNullableDate(payload.startsAt);
    const endsAt = toNullableDate(payload.endsAt);
    if (payload.startsAt && !startsAt) return fail("Invalid startsAt date", 400, "VALIDATION_ERROR");
    if (payload.endsAt && !endsAt) return fail("Invalid endsAt date", 400, "VALIDATION_ERROR");
    if (startsAt && endsAt && endsAt < startsAt) {
      return fail("endsAt must be after startsAt", 400, "VALIDATION_ERROR");
    }

    const created = await prisma.discountCode.create({
      data: {
        code,
        description: payload.description || null,
        type: payload.type,
        target: payload.target,
        percentOff: payload.type === "percent" ? payload.percentOff || null : null,
        flatAmountRupees: payload.type === "flat_rupees" ? payload.flatAmountRupees || null : null,
        fixedPriceRupees: payload.type === "fixed_price" ? payload.fixedPriceRupees || null : null,
        maxDiscountRupees: payload.maxDiscountRupees || null,
        minOrderRupees: payload.minOrderRupees || null,
        usageLimitTotal: payload.usageLimitTotal || null,
        usageLimitPerUser: payload.usageLimitPerUser || null,
        active: payload.active,
        startsAt,
        endsAt,
        createdById: authResult.auth.user.id,
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.discount_code_create",
      targetType: "discount_code",
      targetId: created.id,
      metadataJson: {
        code: created.code,
        type: created.type,
        target: created.target,
      },
    });

    return ok("Discount code created", { code: created }, 201);
  } catch (error) {
    return handleApiError(error, "Failed to create discount code");
  }
}
