import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";

const reportIssueSchema = z.object({
  questionKey: z.string().trim().min(1).max(160),
  questionLabel: z.string().trim().min(1).max(500),
  validationMessage: z.string().trim().max(500).optional().default(""),
  // What the LinkedIn form asked for: the field type, the choices offered, a hint from its limits,
  // and the answer LinkedIn refused. Lets the dashboard ask for the right kind of answer.
  fieldType: z.string().trim().max(30).optional().default(""),
  options: z.array(z.string().trim().max(120)).max(40).optional().default([]),
  hint: z.string().trim().max(200).optional().default(""),
  rejectedAnswer: z.string().trim().max(500).optional().default(""),
});

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const url = new URL(req.url);
    const scanLimitRaw = Number(url.searchParams.get("scanLimit") || 1200);
    const scanLimit = Number.isFinite(scanLimitRaw)
      ? Math.max(200, Math.min(5000, Math.floor(scanLimitRaw)))
      : 1200;

    const logs = await prisma.auditLog.findMany({
      where: {
        actorUserId: authResult.auth.user.id,
        action: { in: ["user.screening_issue_detected", "user.screening_answer_saved"] },
      },
      orderBy: { createdAt: "desc" },
      take: scanLimit,
    });

    const latestStateByKey = new Map<
      string,
      {
        questionKey: string;
        questionLabel: string;
        status: "pending" | "resolved";
        validationMessage: string;
        fieldType: string;
        options: string[];
        hint: string;
        rejectedAnswer: string;
        updatedAt: string;
      }
    >();

    for (const log of logs) {
      const meta = asObject(log.metadataJson);
      if (!meta) continue;
      const questionKey = String(meta.questionKey || "").trim();
      if (!questionKey || latestStateByKey.has(questionKey)) continue;
      const questionLabel = String(meta.questionLabel || "").trim() || questionKey;
      const validationMessage = String(meta.validationMessage || "").trim();
      latestStateByKey.set(questionKey, {
        questionKey,
        questionLabel,
        status: log.action === "user.screening_issue_detected" ? "pending" : "resolved",
        validationMessage,
        fieldType: String(meta.fieldType || "").trim(),
        options: Array.isArray(meta.options) ? meta.options.map((o) => String(o)).filter(Boolean) : [],
        hint: String(meta.hint || "").trim(),
        rejectedAnswer: String(meta.rejectedAnswer || "").trim(),
        updatedAt: log.createdAt.toISOString(),
      });
    }

    const pending = Array.from(latestStateByKey.values()).filter((i) => i.status === "pending");
    const resolved = Array.from(latestStateByKey.values()).filter((i) => i.status === "resolved");
    const pendingPage = pending.slice(skip, skip + limit);
    const resolvedPage = resolved.slice(skip, skip + limit);
    return ok("Screening issues fetched", {
      pending: pendingPage,
      resolved: resolvedPage,
      counts: {
        pending: pending.length,
        resolved: resolved.length,
      },
      pagination: {
        page,
        limit,
        totalPages: {
          pending: Math.ceil(pending.length / limit),
          resolved: Math.ceil(resolved.length / limit),
        },
      },
      scanLimit,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch screening issues");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = reportIssueSchema.parse(await req.json());

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "user.screening_issue_detected",
      targetType: "screening_issue",
      targetId: payload.questionKey,
      metadataJson: payload,
    });

    return ok("Screening issue recorded", { issue: payload });
  } catch (error) {
    return handleApiError(error, "Failed to record screening issue");
  }
}

