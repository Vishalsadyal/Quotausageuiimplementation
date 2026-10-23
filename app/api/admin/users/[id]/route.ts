import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().min(6).max(30).optional(),
    role: z.enum(["user", "admin"]).optional(),
    plan: z.enum(["free", "pro", "coach", "connect"]).optional(),
    quotaTotal: z.number().int().min(0).max(100000).optional(),
    quotaUsed: z.number().int().min(0).max(100000).optional(),
    hireBalance: z.number().int().min(0).max(1000000).optional(),
    dailyHireCap: z.number().int().min(1).max(1000).optional(),
    dailyHireUsed: z.number().int().min(0).max(1000).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

export async function DELETE(_req: Request, context: RouteParams) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  if (!id) return fail("User id is required", 400, "VALIDATION_ERROR");

  if (id === authResult.auth.user.id) {
    return fail("You cannot delete your own admin account", 400, "SELF_DELETE_FORBIDDEN");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });
  if (!user) return fail("User not found", 404, "USER_NOT_FOUND");

  await prisma.user.delete({ where: { id } });

  await writeAuditLog({
    actorUserId: authResult.auth.user.id,
    action: "admin.user_delete",
    targetType: "user",
    targetId: user.id,
    metadataJson: {
      email: user.email,
      role: user.role,
    },
  });

  return ok("User deleted");
}

export async function PATCH(req: Request, context: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const { id } = await context.params;
    if (!id) return fail("User id is required", 400, "VALIDATION_ERROR");

    const payload = updateUserSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        plan: true,
        quotaUsed: true,
        quotaTotal: true,
        hireBalance: true,
        hireSpent: true,
        hirePurchased: true,
        dailyHireUsed: true,
        dailyHireCap: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!existing) return fail("User not found", 404, "USER_NOT_FOUND");

    if (id === authResult.auth.user.id && payload.role && payload.role !== "admin") {
      return fail("You cannot remove your own admin access", 400, "SELF_ROLE_CHANGE_FORBIDDEN");
    }

    const nextQuotaTotal = payload.quotaTotal ?? existing.quotaTotal;
    const nextQuotaUsed = payload.quotaUsed ?? existing.quotaUsed;
    if (nextQuotaUsed > nextQuotaTotal) {
      return fail("quotaUsed cannot exceed quotaTotal", 400, "VALIDATION_ERROR");
    }

    const nextDailyHireCap = payload.dailyHireCap ?? existing.dailyHireCap;
    const nextDailyHireUsed = payload.dailyHireUsed ?? existing.dailyHireUsed;
    if (nextDailyHireUsed > nextDailyHireCap) {
      return fail("dailyHireUsed cannot exceed dailyHireCap", 400, "VALIDATION_ERROR");
    }

    const normalizedEmail = payload.email ? payload.email.trim().toLowerCase() : undefined;
    if (normalizedEmail && normalizedEmail !== existing.email.toLowerCase()) {
      const already = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (already && already.id !== existing.id) {
        return fail("Email is already used by another user", 409, "EMAIL_ALREADY_EXISTS");
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.role !== undefined) updateData.role = payload.role;
    if (payload.plan !== undefined) updateData.plan = payload.plan;
    if (payload.quotaTotal !== undefined) updateData.quotaTotal = payload.quotaTotal;
    if (payload.quotaUsed !== undefined) updateData.quotaUsed = payload.quotaUsed;
    if (payload.hireBalance !== undefined) updateData.hireBalance = payload.hireBalance;
    if (payload.dailyHireCap !== undefined) updateData.dailyHireCap = payload.dailyHireCap;
    if (payload.dailyHireUsed !== undefined) updateData.dailyHireUsed = payload.dailyHireUsed;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        plan: true,
        quotaUsed: true,
        quotaTotal: true,
        hireBalance: true,
        hireSpent: true,
        hirePurchased: true,
        dailyHireUsed: true,
        dailyHireCap: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.user_update",
      targetType: "user",
      targetId: updated.id,
      metadataJson: {
        previous: {
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          role: existing.role,
          plan: existing.plan,
          quotaTotal: existing.quotaTotal,
          quotaUsed: existing.quotaUsed,
          hireBalance: existing.hireBalance,
          dailyHireCap: existing.dailyHireCap,
          dailyHireUsed: existing.dailyHireUsed,
        },
        next: {
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          role: updated.role,
          plan: updated.plan,
          quotaTotal: updated.quotaTotal,
          quotaUsed: updated.quotaUsed,
          hireBalance: updated.hireBalance,
          dailyHireCap: updated.dailyHireCap,
          dailyHireUsed: updated.dailyHireUsed,
        },
      },
    });

    return ok("User updated", { user: updated });
  } catch (error) {
    return handleApiError(error, "Failed to update user");
  }
}
