import { prisma } from "./prisma";
import { getWalletSummary } from "./hires";

export const SUPPORT_WHATSAPP_NUMBER = String(process.env.SUPPORT_WHATSAPP_NUMBER || "919805559015").replace(/\D/g, "");

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function fmtDate(value: Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "-";
}

/** Paid = an active Pro/Coach plan, or anyone who has bought Hires. */
export function isPaidUser(user: { plan: string; hirePurchased: number }) {
  return user.plan !== "free" || user.hirePurchased > 0;
}

/** Builds a plain-text snapshot of the signed-in user's account for the assistant prompt. */
export async function buildUserContext(userId: string) {
  const wallet = await getWalletSummary(userId);
  const user = wallet.user;

  const [subscription, resume, appGroups, recentApps, recentJobs] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    }),
    prisma.userResume.findUnique({ where: { userId }, select: { parsedData: true, updatedAt: true } }),
    prisma.application.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.application.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: { company: true, title: true, status: true, submittedAt: true },
    }),
    prisma.autoApplyJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { status: true, createdAt: true, errorMessage: true, criteriaJson: true },
    }),
  ]);

  const appCounts = appGroups.map((g) => `${g.status}: ${g._count._all}`).join(", ") || "none yet";
  const parsed = asRecord(resume?.parsedData);
  const skills = Array.isArray(parsed.skills) ? parsed.skills.slice(0, 25).join(", ") : "";
  const jobTitles = Array.isArray(parsed.jobTitles) ? parsed.jobTitles.slice(0, 10).join(", ") : "";

  const lines = [
    `Name: ${user.name}`,
    `Email: ${user.email}`,
    `City: ${user.currentCity || "-"}`,
    `Member since: ${fmtDate(user.createdAt)}`,
    `Onboarding completed: ${user.onboardingCompleted ? "yes" : "no"}`,
    `Resume uploaded: ${user.resumeFileName ? `yes (${user.resumeFileName}, updated ${fmtDate(resume?.updatedAt)})` : "no"}`,
    jobTitles ? `Resume job titles: ${jobTitles}` : "",
    skills ? `Resume skills: ${skills}` : "",
    `LinkedIn URL set: ${user.linkedinUrl ? "yes" : "no"}`,
    "",
    `Plan: ${user.plan}${user.plan === "free" ? " (3 free auto-applies per day)" : ""}`,
    subscription
      ? `Subscription: ${subscription.plan} / ${subscription.status}, renews or ends ${fmtDate(subscription.currentPeriodEnd)}${subscription.cancelAtPeriodEnd ? " (set to cancel)" : ""}`
      : "Subscription: none",
    `Hires wallet balance: ${user.hireBalance} (purchased ${user.hirePurchased}, spent ${user.hireSpent})`,
    user.plan === "pro" || user.plan === "connect"
      ? "Applies left today: unlimited"
      : `Free applies used today: ${user.dailyHireUsed} of ${user.dailyHireCap}; free left today: ${wallet.freeRemaining}; total spendable now: ${wallet.spendable}`,
    `Daily allowance resets at: ${user.dailyHireResetTime.toISOString()}`,
    "",
    `Applications by status: ${appCounts}`,
    "Latest applications:",
    ...(recentApps.length
      ? recentApps.map((a) => `- ${fmtDate(a.submittedAt)} ${a.title || "Role"} at ${a.company || "Company"} [${a.status}]`)
      : ["- none"]),
    "Latest auto-apply runs:",
    ...(recentJobs.length
      ? recentJobs.map((j) => {
          const c = asRecord(j.criteriaJson);
          const label = String(c.title || c.keywords || "run").slice(0, 80);
          const err = j.errorMessage ? ` — error: ${j.errorMessage.slice(0, 200)}` : "";
          return `- ${fmtDate(j.createdAt)} ${label} [${j.status}]${err}`;
        })
      : ["- none"]),
  ];

  const lastFailed = recentJobs.find((j) => j.errorMessage);

  return {
    user,
    isPaid: isPaidUser(user),
    text: lines.filter((l) => l !== null).join("\n"),
    facts: {
      firstName: user.name.split(" ")[0] || "",
      plan: user.plan,
      freeRemaining: wallet.freeRemaining,
      spendable: wallet.spendable,
      hireBalance: user.hireBalance,
      resetAt: user.dailyHireResetTime,
      hasResume: Boolean(user.resumeFileName),
      onboardingCompleted: user.onboardingCompleted,
      appCounts: Object.fromEntries(appGroups.map((g) => [g.status, g._count._all])) as Record<string, number>,
      lastError: lastFailed?.errorMessage?.slice(0, 200) || "",
    },
  };
}
