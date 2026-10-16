import { requireAdmin } from "src/lib/guards";
import { ok, handleApiError, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { forcedScreeningAnswerType, screeningGroupFor, screeningKeyStem } from "src/lib/screening-groups";

type LatestRow = {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  questionKey: string;
  questionLabel: string | null;
  answer: string | null;
  source: string | null;
  answerType: string | null;
  action: string;
  updatedAt: Date;
};

// Latest save-or-issue entry per user and question, same rule as /api/admin/screening/issues:
// a newer "issue detected" entry makes the question pending again.
async function loadLatestRows(questionKey?: string): Promise<LatestRow[]> {
  return prisma.$queryRaw<LatestRow[]>`
    SELECT DISTINCT ON (a."actorUserId", a."metadataJson"->>'questionKey')
      a."actorUserId" AS "userId",
      u."name" AS "userName",
      u."email" AS "userEmail",
      a."metadataJson"->>'questionKey' AS "questionKey",
      a."metadataJson"->>'questionLabel' AS "questionLabel",
      a."metadataJson"->>'answer' AS "answer",
      a."metadataJson"->>'source' AS "source",
      a."metadataJson"->>'answerType' AS "answerType",
      a."action" AS "action",
      a."createdAt" AS "updatedAt"
    FROM "AuditLog" a
    JOIN "User" u ON u."id" = a."actorUserId"
    WHERE a."action" IN ('user.screening_answer_saved', 'user.screening_issue_detected')
      AND a."metadataJson"->>'questionKey' IS NOT NULL
      AND a."metadataJson"->>'questionKey' <> ''
      AND (${questionKey ?? null}::text IS NULL OR a."metadataJson"->>'questionKey' = ${questionKey ?? null}::text)
    ORDER BY a."actorUserId", a."metadataJson"->>'questionKey', a."createdAt" DESC
  `;
}

function isPending(row: LatestRow) {
  return row.action === "user.screening_issue_detected";
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const params = new URL(req.url).searchParams;
    const questionKey = params.get("questionKey")?.trim() || "";
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

    // One question: the users' current answers, one page at a time.
    if (questionKey) {
      const rows = await loadLatestRows(questionKey);
      const users = rows
        .map((row) => ({
          userId: row.userId,
          userName: row.userName || "Unknown",
          userEmail: row.userEmail || "",
          status: isPending(row) ? ("pending" as const) : ("answered" as const),
          answer: isPending(row) ? "" : String(row.answer || "").trim(),
          source: String(row.source || "").trim() || "manual",
          updatedAt: row.updatedAt.toISOString(),
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return ok("Screening answers for question fetched", {
        questionKey,
        users: users.slice(skip, skip + limit),
        pagination: { page, limit, total: users.length, totalPages: Math.max(1, Math.ceil(users.length / limit)) },
      });
    }

    // All questions grouped across users.
    const rows = await loadLatestRows();
    const byKey = new Map<string, LatestRow[]>();
    for (const row of rows) {
      const list = byKey.get(row.questionKey);
      if (list) list.push(row);
      else byKey.set(row.questionKey, [row]);
    }

    const questions = Array.from(byKey.entries()).map(([key, list]) => {
      const answeredRows = list.filter((row) => !isPending(row) && String(row.answer || "").trim());
      const labels = mostCommon(list.map((row) => String(row.questionLabel || "").trim()).filter(Boolean));
      const sources = mostCommon(list.map((row) => String(row.source || "").trim() || "manual"));
      const topAnswers = mostCommon(answeredRows.map((row) => String(row.answer).trim().slice(0, 140)))
        .slice(0, 5)
        .map(([answer, users]) => ({ answer, users }));
      const answerType =
        forcedScreeningAnswerType(key) ||
        mostCommon(list.map((row) => String(row.answerType || "").trim()).filter(Boolean))[0]?.[0] ||
        "text";
      return {
        questionKey: key,
        group: screeningGroupFor(key),
        answerType,
        questionLabel: labels[0]?.[0] || key,
        labelVariants: Math.max(0, labels.length - 1),
        users: list.length,
        answered: answeredRows.length,
        pending: list.filter(isPending).length,
        distinctAnswers: new Set(answeredRows.map((row) => String(row.answer).trim().toLowerCase())).size,
        sources: sources.map(([source, count]) => ({ source, count })),
        topAnswers,
        lastUpdatedAt: list.reduce((max, row) => (row.updatedAt > max ? row.updatedAt : max), list[0].updatedAt).toISOString(),
      };
    });
    questions.sort((a, b) => b.users - a.users || a.questionLabel.localeCompare(b.questionLabel));

    const search = (params.get("q") || "").trim().toLowerCase();
    const filter = params.get("filter") || "all";
    const groupFilter = params.get("group") || "";

    // Related questions: keys that ask for the same thing, so one answer could serve them all.
    const groupMap = new Map<string, typeof questions>();
    for (const q of questions) {
      if (!q.group) continue;
      const list = groupMap.get(q.group);
      if (list) list.push(q);
      else groupMap.set(q.group, [q]);
    }
    const groups = Array.from(groupMap.entries())
      .map(([name, members]) => ({
        name,
        keys: members.length,
        savedAnswers: members.reduce((sum, q) => sum + q.answered, 0),
        pending: members.reduce((sum, q) => sum + q.pending, 0),
        users: members.reduce((max, q) => Math.max(max, q.users), 0),
        members: members.map((q) => ({
          questionKey: q.questionKey,
          questionLabel: q.questionLabel,
          users: q.users,
          answered: q.answered,
          topAnswer: q.topAnswers[0]?.answer || "",
        })),
      }))
      .sort((a, b) => b.keys - a.keys || b.savedAnswers - a.savedAnswers);
    const stems = new Map<string, number>();
    for (const q of questions) {
      const stem = screeningKeyStem(q.questionKey);
      stems.set(stem, (stems.get(stem) || 0) + 1);
    }
    const duplicateWordings = Array.from(stems.values()).filter((count) => count > 1).length;
    const groupedKeys = groups.reduce((sum, g) => sum + g.keys, 0);

    const matching = questions.filter((q) => {
      if (filter === "pending" && !q.pending) return false;
      if (filter === "answered" && !q.answered) return false;
      if (groupFilter === "__none__" ? q.group : groupFilter && q.group !== groupFilter) return false;
      if (!search) return true;
      return (
        q.questionLabel.toLowerCase().includes(search) ||
        q.questionKey.toLowerCase().includes(search) ||
        q.topAnswers.some((item) => item.answer.toLowerCase().includes(search))
      );
    });

    return ok("Global screening questions fetched", {
      questions: matching.slice(skip, skip + limit),
      pagination: { page, limit, total: matching.length, totalPages: Math.max(1, Math.ceil(matching.length / limit)) },
      totals: {
        questions: questions.length,
        users: new Set(rows.map((row) => row.userId)).size,
        answers: questions.reduce((sum, q) => sum + q.answered, 0),
        pending: questions.reduce((sum, q) => sum + q.pending, 0),
        groupedKeys,
        ungroupedKeys: questions.length - groupedKeys,
        groups: groups.length,
        duplicateWordings,
      },
      groups,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch global screening questions");
  }
}
