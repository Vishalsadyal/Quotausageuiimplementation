import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, fail, handleApiError, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import { forcedScreeningAnswerType } from "src/lib/screening-groups";
import {
  AnswerType,
  SourceType,
  CachedAnswerItem,
  getUserAnswersCache,
  setUserAnswersCache,
  invalidateUserAnswersCache,
  CACHE_TTL_MS,
} from "src/lib/screening-cache";

const answerTypeSchema = z.enum(["text", "boolean", "number", "choice", "multiselect"]);
const sourceSchema = z.enum(["manual", "linkedin_import", "resume_parse", "extension_capture", "system"]);

const saveAnswerSchema = z.object({
  questionKey: z.string().trim().min(1).max(160),
  questionLabel: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(1000),
  answerType: answerTypeSchema.optional().default("text"),
  source: sourceSchema.optional().default("manual"),
  lastUsed: z.string().trim().max(80).optional(),
});

const bulkSaveAnswerSchema = z.union([
  saveAnswerSchema,
  z.object({
    answers: z.array(saveAnswerSchema).min(1).max(500),
  }),
  z.array(saveAnswerSchema).min(1).max(500),
]);

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseAnswerType(value: unknown): AnswerType {
  const parsed = answerTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : "text";
}

function parseSource(value: unknown): SourceType {
  const parsed = sourceSchema.safeParse(value);
  return parsed.success ? parsed.data : "manual";
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const url = new URL(req.url);
    const scanLimitRaw = Number(url.searchParams.get("scanLimit") || 300);
    const scanLimit = Number.isFinite(scanLimitRaw)
      ? Math.max(50, Math.min(500, Math.floor(scanLimitRaw)))
      : 300;

    const cached = getUserAnswersCache(userId);
    let allAnswers: CachedAnswerItem[];

    if (cached && Date.now() - cached.cachedAtMs < CACHE_TTL_MS) {
      allAnswers = cached.answers;
    } else {
      const logs = await prisma.auditLog.findMany({
        where: {
          actorUserId: userId,
          action: "user.screening_answer_saved",
        },
        select: {
          metadataJson: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: scanLimit,
      });

      const latestByKey = new Map<
        string,
        {
          questionKey: string;
          questionLabel: string;
          answer: string;
          answerType: AnswerType;
          source: SourceType;
          lastUsed: string;
          updatedAt: string;
        }
      >();

      for (const log of logs) {
        const meta = asObject(log.metadataJson);
        if (!meta) continue;
        const questionKey = String(meta.questionKey || "").trim();
        const questionLabel = String(meta.questionLabel || "").trim();
        const answer = String(meta.answer || "").trim();
        if (!questionKey || !questionLabel || !answer) continue;
        if (!latestByKey.has(questionKey)) {
          latestByKey.set(questionKey, {
            questionKey,
            questionLabel,
            answer,
            answerType: parseAnswerType(meta.answerType),
            source: parseSource(meta.source),
            lastUsed: String(meta.lastUsed || "").trim() || log.createdAt.toISOString(),
            updatedAt: log.createdAt.toISOString(),
          });
        }
      }

      allAnswers = Array.from(latestByKey.values());
      setUserAnswersCache(userId, { answers: allAnswers, cachedAtMs: Date.now() });
    }

    const answers = allAnswers.slice(skip, skip + limit);
    return ok("Screening answers fetched", {
      answers,
      pagination: {
        page,
        limit,
        total: allAnswers.length,
        totalPages: Math.ceil(allAnswers.length / limit),
      },
      scanLimit,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch screening answers");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid or empty JSON body", 400);
    }

    const answersList: Array<{
      questionKey: string;
      questionLabel: string;
      answer: string;
      answerType: AnswerType;
      source: SourceType;
      lastUsed?: string;
    }> = [];

    if (Array.isArray(body)) {
      for (const item of body) {
        const parsed = saveAnswerSchema.safeParse(item);
        if (parsed.success) {
          answersList.push(parsed.data);
        }
      }
    } else {
      const parsed = saveAnswerSchema.safeParse(body);
      if (parsed.success) {
        answersList.push(parsed.data);
      }
    }

    if (!answersList.length) {
      return fail("Invalid answer payload", 400);
    }

    // A summary or other free-text answer is text, even when it has commas and was sent as multiselect.
    for (const item of answersList) {
      if (forcedScreeningAnswerType(item.questionKey)) item.answerType = "text";
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    invalidateUserAnswersCache(userId);

    if (answersList.length === 1) {
      const payload = answersList[0];
      await writeAuditLog({
        actorUserId: userId,
        action: "user.screening_answer_saved",
        targetType: "screening_answer",
        targetId: payload.questionKey,
        metadataJson: {
          ...payload,
          lastUsed: payload.lastUsed || new Date().toISOString(),
        },
      });
      return ok("Screening answer saved", { answer: payload });
    }

    if (answersList.length > 1) {
      await prisma.auditLog.createMany({
        data: answersList.map((payload) => ({
          actorUserId: userId,
          action: "user.screening_answer_saved",
          targetType: "screening_answer",
          targetId: payload.questionKey,
          metadataJson: {
            ...payload,
            lastUsed: payload.lastUsed || new Date().toISOString(),
          },
          ipAddress: ip,
          userAgent: userAgent,
        })),
      });
      return ok("Screening answers saved in bulk", { count: answersList.length });
    }

    return fail("No answers provided", 400);
  } catch (error) {
    return handleApiError(error, "Failed to save screening answer");
  }
}
