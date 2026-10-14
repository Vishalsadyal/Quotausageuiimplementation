import { DiscountCodeTarget, DiscountCodeType } from "@prisma/client";
import { prisma } from "./prisma";

export type DiscountContext = "wallet_topup" | "plan_pro" | "plan_coach" | "plan_connect";

/** Discount context for buying a plan. */
export function planDiscountContext(plan: "pro" | "coach" | "connect"): DiscountContext {
  return `plan_${plan}`;
}

export type AppliedDiscount = {
  discountCodeId: string;
  code: string;
  description: string | null;
  type: DiscountCodeType;
  target: DiscountCodeTarget;
  percentOff: number | null;
  flatAmountRupees: number | null;
  fixedPriceRupees: number | null;
  baseRupees: number;
  discountRupees: number;
  finalRupees: number;
};

export class DiscountValidationError extends Error {
  status: number;
  errorCode: string;

  constructor(message: string, errorCode = "INVALID_DISCOUNT", status = 400) {
    super(message);
    this.name = "DiscountValidationError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

const DISCOUNT_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export function normalizeDiscountCode(input: unknown) {
  return String(input || "").trim().toUpperCase();
}

export function isValidDiscountCodeFormat(input: unknown) {
  return DISCOUNT_CODE_REGEX.test(normalizeDiscountCode(input));
}

function targetMatches(target: DiscountCodeTarget, context: DiscountContext) {
  if (target === "all") return true;
  if (context === "wallet_topup") return target === "wallet_topup";
  if (context === "plan_pro") return target === "plan_pro";
  if (context === "plan_coach") return target === "plan_coach";
  if (context === "plan_connect") return target === "plan_connect";
  return false;
}

function clampDiscount(baseRupees: number, discountRupees: number) {
  if (!Number.isFinite(baseRupees) || baseRupees <= 0) return 0;
  const maxAllowed = Math.max(0, Math.floor(baseRupees) - 1);
  return Math.max(0, Math.min(maxAllowed, Math.floor(discountRupees)));
}

function computeDiscountRupees(input: {
  type: DiscountCodeType;
  percentOff: number | null;
  flatAmountRupees: number | null;
  fixedPriceRupees: number | null;
  maxDiscountRupees: number | null;
  baseRupees: number;
}) {
  const base = Math.max(0, Math.floor(input.baseRupees));
  let discount = 0;

  if (input.type === "percent") {
    const percent = Math.max(0, Math.min(100, Math.floor(input.percentOff || 0)));
    discount = Math.floor((base * percent) / 100);
  } else if (input.type === "fixed_price") {
    // "Pay ₹99": the discount is whatever brings the regular price down to the fixed price.
    const price = Math.floor(input.fixedPriceRupees ?? -1);
    discount = price >= 1 ? base - price : 0;
  } else {
    discount = Math.max(0, Math.floor(input.flatAmountRupees || 0));
  }

  if (input.maxDiscountRupees && input.maxDiscountRupees > 0) {
    discount = Math.min(discount, Math.floor(input.maxDiscountRupees));
  }

  return clampDiscount(base, discount);
}

export async function evaluateDiscountForOrder(input: {
  codeInput?: string | null;
  userId: string;
  context: DiscountContext;
  baseRupees: number;
  now?: Date;
}) {
  const baseRupees = Math.max(0, Math.floor(input.baseRupees));
  if (baseRupees <= 0) {
    throw new DiscountValidationError("Order amount must be positive", "INVALID_AMOUNT", 400);
  }

  const normalized = normalizeDiscountCode(input.codeInput);
  if (!normalized) return null;
  if (!isValidDiscountCodeFormat(normalized)) {
    throw new DiscountValidationError(
      "Discount code format is invalid",
      "INVALID_DISCOUNT_FORMAT",
      400,
    );
  }

  const discountCode = await prisma.discountCode.findUnique({
    where: { code: normalized },
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
    },
  });

  if (!discountCode) {
    throw new DiscountValidationError("Discount code not found", "DISCOUNT_NOT_FOUND", 404);
  }
  if (!discountCode.active) {
    throw new DiscountValidationError("Discount code is inactive", "DISCOUNT_INACTIVE", 400);
  }
  if (!targetMatches(discountCode.target, input.context)) {
    throw new DiscountValidationError(
      "Discount code is not valid for this purchase",
      "DISCOUNT_TARGET_MISMATCH",
      400,
    );
  }

  const now = input.now || new Date();
  if (discountCode.startsAt && discountCode.startsAt > now) {
    throw new DiscountValidationError("Discount code is not active yet", "DISCOUNT_NOT_STARTED", 400);
  }
  if (discountCode.endsAt && discountCode.endsAt < now) {
    throw new DiscountValidationError("Discount code has expired", "DISCOUNT_EXPIRED", 400);
  }
  if (discountCode.minOrderRupees && baseRupees < discountCode.minOrderRupees) {
    throw new DiscountValidationError(
      `Minimum order for this code is INR ${discountCode.minOrderRupees}`,
      "DISCOUNT_MIN_ORDER",
      400,
    );
  }
  if (discountCode.usageLimitTotal !== null && discountCode.usedCount >= discountCode.usageLimitTotal) {
    throw new DiscountValidationError("Discount code usage limit reached", "DISCOUNT_USAGE_LIMIT", 400);
  }

  if (discountCode.usageLimitPerUser !== null) {
    const usedByUser = await prisma.discountRedemption.count({
      where: { discountCodeId: discountCode.id, userId: input.userId },
    });
    if (usedByUser >= discountCode.usageLimitPerUser) {
      throw new DiscountValidationError(
        "You have already used this discount code",
        "DISCOUNT_USER_LIMIT",
        400,
      );
    }
  }

  const discountRupees = computeDiscountRupees({
    type: discountCode.type,
    percentOff: discountCode.percentOff,
    flatAmountRupees: discountCode.flatAmountRupees,
    fixedPriceRupees: discountCode.fixedPriceRupees,
    maxDiscountRupees: discountCode.maxDiscountRupees,
    baseRupees,
  });

  if (discountRupees <= 0) {
    throw new DiscountValidationError(
      "Discount code does not reduce this order amount",
      "DISCOUNT_NOT_APPLICABLE",
      400,
    );
  }

  return {
    discountCodeId: discountCode.id,
    code: discountCode.code,
    description: discountCode.description,
    type: discountCode.type,
    target: discountCode.target,
    percentOff: discountCode.percentOff,
    flatAmountRupees: discountCode.flatAmountRupees,
    fixedPriceRupees: discountCode.fixedPriceRupees,
    baseRupees,
    discountRupees,
    finalRupees: baseRupees - discountRupees,
  } satisfies AppliedDiscount;
}

export async function registerDiscountRedemption(input: {
  discountCodeId: string;
  userId: string;
  context: DiscountContext;
  orderId?: string;
  paymentId?: string;
  baseRupees: number;
  discountRupees: number;
  finalRupees: number;
}) {
  if (!input.discountCodeId || input.discountRupees <= 0) return null;

  return prisma.$transaction(async (tx) => {
    if (input.paymentId) {
      const existing = await tx.discountRedemption.findUnique({
        where: { paymentId: input.paymentId },
      });
      if (existing) return existing;
    }

    const redemption = await tx.discountRedemption.create({
      data: {
        discountCodeId: input.discountCodeId,
        userId: input.userId,
        context: input.context,
        orderId: input.orderId || null,
        paymentId: input.paymentId || null,
        baseRupees: Math.max(0, Math.floor(input.baseRupees)),
        discountRupees: Math.max(0, Math.floor(input.discountRupees)),
        finalRupees: Math.max(0, Math.floor(input.finalRupees)),
      },
    });

    await tx.discountCode.update({
      where: { id: input.discountCodeId },
      data: { usedCount: { increment: 1 } },
    });

    return redemption;
  });
}
