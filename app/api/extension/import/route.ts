import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok, parsePagination } from "src/lib/api";
import {
  extensionIdempotencyPrefix,
  extensionSourceKey,
  listExtensionProviderConfigs,
  normalizeExtensionProvider,
  type ExtensionProvider,
} from "src/lib/extension-providers";
import { requireAuth } from "src/lib/guards";
import { consumeHiresForApplies } from "src/lib/hires";
import { inferJobProvider, parseExternalJobId } from "src/lib/job-source";

type IncomingEntry = {
  ts: string;
  outcomeType: string;
  entryId?: string;
  runId?: string;
  provider?: ExtensionProvider;
  data?: Record<string, unknown>;
};

type ImportBilling = {
  charged: boolean;
  consumed: number;
  sourceBreakdown: { free: number; paid: number };
  reason: string;
};

const DEFAULT_IMPORT_LIMIT = 120;
const MAX_IMPORT_LIMIT = 200;

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeOutcome(value: unknown) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "APPLIED" || v === "FAILED" || v === "SKIPPED" || v === "EXTERNAL") return v;
  return "SKIPPED";
}

function buildEntryId(input: IncomingEntry) {
  const data = input.data || {};
  const provider = normalizeExtensionProvider(input.provider || inferJobProvider(data));
  const stableJobId =
    parseExternalJobId(data.jobUrl, provider) ||
    parseExternalJobId(data.pageUrl, provider) ||
    parseExternalJobId(data.jobId, provider) ||
    parseExternalJobId(data.externalJobId, provider) ||
    String(data.jobId || data.externalJobId || "").trim() ||
    "unknown";
  const reasonCode = String(data.reasonCode || "").trim().toUpperCase() || "na";
  return `${provider}:${normalizeOutcome(input.outcomeType)}:${stableJobId}:${reasonCode}:${String(input.ts || "").trim()}`;
}

function toJobStatus(outcomeType: string) {
  if (outcomeType === "APPLIED") return "succeeded";
  if (outcomeType === "FAILED") return "failed";
  return "cancelled";
}

function toAppStatus(outcomeType: string) {
  if (outcomeType === "APPLIED") return "submitted";
  if (outcomeType === "FAILED") return "failed";
  return "skipped";
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const body = await req.json().catch(() => null);
    const requestedLimit = parseBoundedInt(
      body?.limit ?? new URL(req.url).searchParams.get("limit"),
      DEFAULT_IMPORT_LIMIT,
      1,
      MAX_IMPORT_LIMIT,
    );
    const entriesRaw = Array.isArray(body?.entries) ? body.entries : [];
    const entries: IncomingEntry[] = entriesRaw
      .map((e: any) => ({
        ts: String(e?.ts || ""),
        outcomeType: normalizeOutcome(e?.outcomeType),
        entryId: String(e?.entryId || "").trim(),
        runId: String(e?.runId || "").trim(),
        provider: normalizeExtensionProvider(e?.provider || inferJobProvider(e?.data)),
        data: e?.data && typeof e.data === "object" ? (e.data as Record<string, unknown>) : {},
      }))
      .filter((e) => Boolean(e.ts));
    const totalReceived = entries.length;
    const entriesToProcess = entries.slice(0, requestedLimit);
    const dropped = Math.max(0, totalReceived - entriesToProcess.length);

    if (!entriesToProcess.length) return fail("No entries to import", 400, "NO_ENTRIES");

    const userId = authResult.auth.user.id;
    const seenEntryIds = new Set<string>();

    const results: Array<{
      jobId: string;
      externalJobId: string;
      outcomeType: string;
      entryId: string;
      title: string;
      company: string;
      billing: ImportBilling;
    }> = [];
    const billingTotals = {
      chargedJobs: 0,
      consumedTotal: 0,
      freeConsumed: 0,
      paidConsumed: 0,
      chargeFailures: 0,
    };
    for (const entry of entriesToProcess) {
      const effectiveEntryId = entry.entryId || buildEntryId(entry);
      if (seenEntryIds.has(effectiveEntryId)) continue;
      seenEntryIds.add(effectiveEntryId);
      const data = entry.data || {};
      const provider = normalizeExtensionProvider(entry.provider || inferJobProvider(data));
      const jobUrlId = parseExternalJobId(data.jobUrl, provider);
      const pageUrlId = parseExternalJobId(data.pageUrl, provider);
      // Prefer the canonical /jobs/view/<id> value when available; card "jobId" can be an internal id in some views.
      const jobId =
        jobUrlId ||
        pageUrlId ||
        parseExternalJobId(data.jobId, provider) ||
        parseExternalJobId(data.externalJobId, provider) ||
        String(data.jobId || data.externalJobId || "").trim();
      if (!jobId) continue;

      const idempotencyKey = `${extensionIdempotencyPrefix(provider)}${jobId}`;
      const jobUrl = String(data.jobUrl || "").trim();
      const pageUrl = String(data.pageUrl || "").trim();
      const title = String(data.title || "").trim();
      const company = String(data.company || "").trim();
      const workLocation = String(data.workLocation || "").trim();
      const reasonCode = String(data.reasonCode || "").trim();
      // Why it was skipped, in words, and the exclude word that caused it ("Sales" found in the job description).
      const reason = entry.outcomeType === "SKIPPED" ? String(data.reason || "").trim().slice(0, 200) : "";
      const matchedWord = String(data.matchedWord || "").trim().slice(0, 80);
      const runId = String(entry.runId || "").trim();
      const sourceKey = extensionSourceKey(provider);

      const status = toJobStatus(entry.outcomeType);
      const criteriaJson = {
        provider,
        source: sourceKey,
        entryId: effectiveEntryId,
        runId,
        jobId,
        jobUrl,
        pageUrl,
        title,
        company,
        workLocation,
        reasonCode,
        reason,
        matchedWord,
      };

      // Upsert a synthetic "job" so existing dashboard pages can reuse /api/auto-apply/jobs.
      const job = await prisma.autoApplyJob.upsert({
        where: { idempotencyKey },
        create: {
          userId,
          idempotencyKey,
          criteriaJson,
          status,
          scheduledAt: new Date(entry.ts),
          startedAt: new Date(entry.ts),
          finishedAt: entry.outcomeType === "APPLIED" || entry.outcomeType === "FAILED" ? new Date(entry.ts) : null,
          errorMessage: entry.outcomeType === "FAILED" ? String(data.reason || "Extension reported failure") : null,
        },
        update: {
          status,
          criteriaJson,
          finishedAt: entry.outcomeType === "APPLIED" || entry.outcomeType === "FAILED" ? new Date(entry.ts) : null,
          errorMessage: entry.outcomeType === "FAILED" ? String(data.reason || "Extension reported failure") : null,
        },
      });

      // Idempotent application: one record per imported job.
      const appStatus = toAppStatus(entry.outcomeType);
      const existingApp = await prisma.application.findFirst({
        where: { userId, jobId: job.id },
        orderBy: { createdAt: "desc" },
      });
      const prevStatus = existingApp?.status ? String(existingApp.status) : "";
      const shouldCharge = entry.outcomeType === "APPLIED" && (!existingApp || prevStatus !== "submitted");
      if (!existingApp) {
        await prisma.application.create({
          data: {
            userId,
            jobId: job.id,
            externalJobId: jobId,
            company: company || null,
            title: title || null,
            status: appStatus as any,
            submittedAt: new Date(entry.ts),
            metadataJson: {
              provider,
              source: sourceKey,
              entryId: effectiveEntryId,
              runId,
              reasonCode,
              reason,
              matchedWord,
              jobUrl,
              pageUrl,
              workLocation,
              importedAt: new Date().toISOString(),
              historyTs: entry.ts,
            },
          },
        });
      } else {
        await prisma.application.update({
          where: { id: existingApp.id },
          data: {
            status: appStatus as any,
            submittedAt: new Date(entry.ts),
            metadataJson: {
              ...(typeof existingApp.metadataJson === "object" && existingApp.metadataJson ? (existingApp.metadataJson as any) : {}),
              provider,
              source: sourceKey,
              entryId: effectiveEntryId,
              runId,
              reasonCode,
              reason,
              matchedWord,
              jobUrl,
              pageUrl,
              workLocation,
              importedAt: new Date().toISOString(),
              historyTs: entry.ts,
            },
          },
        });
      }

      // Charge Hires only once per successful submit.
      let billing: ImportBilling = {
        charged: false,
        consumed: 0,
        sourceBreakdown: { free: 0, paid: 0 },
        reason: shouldCharge ? "PENDING_CHARGE" : "NOT_CHARGED_ALREADY_SUBMITTED",
      };
      if (shouldCharge) {
        const chargeResult = await consumeHiresForApplies({
          userId,
          count: 1,
          referenceType: "extension_apply",
          referenceId: String(job.id),
          idempotencyPrefix: `ext_apply:${provider}:${jobId}:${entry.ts}`,
          metadataJson: {
            provider,
            source: sourceKey,
            entryId: effectiveEntryId,
            runId,
            externalJobId: jobId,
            jobUrl,
            pageUrl,
            title,
            company,
          },
        }).catch(() => null);

        if (chargeResult && chargeResult.ok) {
          const free = Math.max(0, Number(chargeResult.sourceBreakdown?.free || 0));
          const paid = Math.max(0, Number(chargeResult.sourceBreakdown?.paid || 0));
          const consumed = Math.max(0, Number(chargeResult.consumed || 0));
          billing = {
            charged: consumed > 0,
            consumed,
            sourceBreakdown: { free, paid },
            reason: consumed > 0 ? "CHARGED" : "NO_CONSUMPTION",
          };
          billingTotals.consumedTotal += consumed;
          billingTotals.freeConsumed += free;
          billingTotals.paidConsumed += paid;
          if (billing.charged) billingTotals.chargedJobs += 1;
        } else {
          const reason = chargeResult && !chargeResult.ok
            ? String(chargeResult.reason || "CHARGE_BLOCKED")
            : "CHARGE_FAILED";
          billing = {
            charged: false,
            consumed: 0,
            sourceBreakdown: { free: 0, paid: 0 },
            reason,
          };
          billingTotals.chargeFailures += 1;
        }
      }

      await prisma.autoApplyJobLog.create({
        data: {
          jobId: job.id,
          level: entry.outcomeType === "FAILED" ? "error" : entry.outcomeType === "SKIPPED" ? "warn" : "info",
          step: "import",
          message: `Imported from extension (${entry.outcomeType}${reasonCode ? `:${reasonCode}` : ""})`,
          metadataJson: criteriaJson,
        },
      });

      results.push({
        jobId: job.id,
        externalJobId: jobId,
        outcomeType: entry.outcomeType,
        entryId: effectiveEntryId,
        title,
        company,
        billing,
      });
    }

    return ok("Imported extension pipeline events", {
      imported: results.length,
      received: totalReceived,
      processed: entriesToProcess.length,
      dropped,
      hasMore: dropped > 0,
      limit: requestedLimit,
      results,
      billing: billingTotals,
    });
  } catch (error) {
    return handleApiError(error, "Failed to import extension events");
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 25, maxLimit: 100 });
    const url = new URL(req.url);
    const statusRaw = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const providerRaw = String(url.searchParams.get("provider") || "").trim().toLowerCase();
    const status =
      statusRaw === "submitted" || statusRaw === "skipped" || statusRaw === "failed"
        ? statusRaw
        : "";
    const provider =
      providerRaw === "linkedin" || providerRaw === "indeed"
        ? normalizeExtensionProvider(providerRaw)
        : null;

    const providerPrefixes = provider
      ? [extensionIdempotencyPrefix(provider)]
      : listExtensionProviderConfigs().map((item) => extensionIdempotencyPrefix(item.provider));

    const where = {
      userId,
      ...(status ? { status: status as any } : {}),
      job: {
        OR: providerPrefixes.map((prefix) => ({
          idempotencyKey: { startsWith: prefix },
        })),
      },
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          job: {
            select: { id: true, status: true, idempotencyKey: true },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return ok("Extension applications fetched", {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch extension applications");
  }
}
