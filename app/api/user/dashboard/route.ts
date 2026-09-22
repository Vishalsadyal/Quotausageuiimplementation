import { prisma } from "src/lib/prisma";
import { handleApiError, ok } from "src/lib/api";
import { buildJobSourceUrl, cleanJobText, inferJobProvider, jobProviderLabel, parseExternalJobId } from "src/lib/job-source";
import { requireAuth } from "src/lib/guards";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
type RecentStatus = "Submitted" | "Running" | "Queued" | "Failed" | "Cancelled";

type UserSnapshot = {
  onboardingCompleted: boolean;
  resumeFileName: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  currentCity: string | null;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recentStatusLabel(status: JobStatus): RecentStatus {
  if (status === "succeeded") return "Submitted";
  if (status === "running") return "Running";
  if (status === "queued") return "Queued";
  if (status === "cancelled") return "Cancelled";
  return "Failed";
}

function buildActivityByDay(values: Array<{ createdAt: Date }>) {
  const dayMap = new Map<string, number>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }

  for (const value of values) {
    const date = new Date(value.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    if (!dayMap.has(key)) continue;
    dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }

  return Array.from(dayMap.entries()).map(([key, count]) => {
    const date = new Date(`${key}T00:00:00.000Z`);
    return {
      key,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: count,
    };
  });
}

function buildProTip(user: UserSnapshot, summary: { submitted: number; failedJobs: number; activeJobs: number }) {
  if (!user.onboardingCompleted) {
    return {
      title: "Complete onboarding",
      body: "Finish your profile and resume setup to reduce auto-apply errors and unlock better matches.",
      ctaLabel: "Finish setup",
      ctaHref: "/dashboard/onboarding",
    };
  }

  if (!user.resumeFileName) {
    return {
      title: "Upload your latest resume",
      body: "A current resume improves ATS targeting and keeps your application data aligned with new roles.",
      ctaLabel: "Open resume",
      ctaHref: "/dashboard/resume",
    };
  }

  if (!user.linkedinUrl) {
    return {
      title: "Add your LinkedIn URL",
      body: "Keeping your LinkedIn profile linked helps you stay consistent across automated applications.",
      ctaLabel: "Edit profile",
      ctaHref: "/dashboard/profile",
    };
  }

  if (summary.failedJobs > 0) {
    return {
      title: "Review failed applications",
      body: "Recent failures usually point to missing fields or weak targeting. Fix those before the next run.",
      ctaLabel: "Open applications",
      ctaHref: "/dashboard/applications",
    };
  }

  if (summary.activeJobs > 0) {
    return {
      title: "Keep the pipeline moving",
      body: "You have active jobs in progress. Review new matches and keep your search filters tight.",
      ctaLabel: "Find jobs",
      ctaHref: "/dashboard/jobs",
    };
  }

  if (summary.submitted === 0) {
    return {
      title: "Start your first run",
      body: "You are set up. Launch a job search run and begin filling your pipeline with live applications.",
      ctaLabel: "Apply now",
      ctaHref: "/dashboard/jobs",
    };
  }

  return {
    title: "Keep your profile fresh",
    body: "The dashboard is live. Update your resume and links regularly so future applications stay high quality.",
    ctaLabel: "View settings",
    ctaHref: "/dashboard/settings",
  };
}

function buildInterviewCard(summary: {
  submitted: number;
  activeJobs: number;
  failedJobs: number;
  readiness: number;
}) {
  if (summary.submitted === 0) {
    return {
      upcomingCount: 0,
      title: "No interviews tracked yet",
      body: "Start an application run to build your pipeline. Interview insights will improve after your first submissions.",
      ctaLabel: "Find jobs",
      ctaHref: "/dashboard/jobs",
    };
  }

  if (summary.failedJobs > summary.submitted) {
    return {
      upcomingCount: 0,
      title: "Fix blockers before the next round",
      body: `Your readiness score is ${summary.readiness}%. Reducing repeated failures will improve interview quality faster than sending more volume.`,
      ctaLabel: "Review failures",
      ctaHref: "/dashboard/applications",
    };
  }

  return {
    upcomingCount: 0,
    title: "Pipeline is warming up",
    body: `${summary.submitted} applications are submitted and ${summary.activeJobs} jobs are still active. Use Interview Prep to practice against your latest roles.`,
    ctaLabel: "Open interview prep",
    ctaHref: "/dashboard/interview",
  };
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const userId = authResult.auth.user.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      user,
      jobStatusGroups,
      appStatusGroups,
      recentJobs,
      jobsLast7Days,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          onboardingCompleted: true,
          resumeFileName: true,
          linkedinUrl: true,
          portfolioUrl: true,
          currentCity: true,
        },
      }),
      prisma.autoApplyJob.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.application.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.autoApplyJob.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          createdAt: true,
          criteriaJson: true,
        },
      }),
      prisma.autoApplyJob.findMany({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true },
      }),
    ]);

    // Map job status counts from groupBy aggregation
    const jobCounts: Record<string, number> = {};
    let jobsTotal = 0;
    for (const group of jobStatusGroups) {
      const count = group._count._all || 0;
      jobCounts[group.status] = count;
      jobsTotal += count;
    }

    const jobsQueued = jobCounts["queued"] || 0;
    const jobsRunning = jobCounts["running"] || 0;
    const jobsSucceeded = jobCounts["succeeded"] || 0;
    const jobsCancelled = jobCounts["cancelled"] || 0;
    const jobsDeadLetter = jobCounts["dead_letter"] || 0;
    const jobsFailed = jobCounts["failed"] || 0;

    // Map application status counts from groupBy aggregation
    const appCounts: Record<string, number> = {};
    for (const group of appStatusGroups) {
      appCounts[group.status] = group._count._all || 0;
    }

    const applicationsSubmitted = appCounts["submitted"] || 0;
    const applicationsSkipped = appCounts["skipped"] || 0;
    const applicationsFailed = appCounts["failed"] || 0;

    const userSnapshot: UserSnapshot = {
      onboardingCompleted: Boolean(user?.onboardingCompleted),
      resumeFileName: user?.resumeFileName || null,
      linkedinUrl: user?.linkedinUrl || null,
      portfolioUrl: user?.portfolioUrl || null,
      currentCity: user?.currentCity || null,
    };

    const activeJobs = jobsQueued + jobsRunning;
    const failedJobs = jobsFailed + jobsDeadLetter;
    const applicationsTotal = applicationsSubmitted + applicationsSkipped + applicationsFailed;
    const responseRate =
      applicationsSubmitted + applicationsFailed > 0
        ? Math.round((applicationsSubmitted / (applicationsSubmitted + applicationsFailed)) * 100)
        : 0;
    const completionRate =
      jobsTotal > 0
        ? Math.round(((jobsSucceeded + jobsCancelled + failedJobs) / jobsTotal) * 100)
        : 0;
    const interviewReadiness =
      applicationsSubmitted > 0
        ? Math.min(100, 40 + applicationsSubmitted * 10)
        : userSnapshot.onboardingCompleted
        ? 20
        : 10;

    const recent = recentJobs.map((job) => {
      const criteria = asRecord(job.criteriaJson);
      const provider = inferJobProvider(criteria);
      const sourceUrl = buildJobSourceUrl(criteria, provider);
      const externalJobId =
        parseExternalJobId(criteria.jobId, provider) ||
        parseExternalJobId(criteria.externalJobId, provider) ||
        parseExternalJobId(sourceUrl, provider);
      const matchValue = Number(criteria.matchScore || 0);
      return {
        id: job.id,
        company: cleanJobText(criteria.company) || jobProviderLabel(provider),
        position: cleanJobText(criteria.title || criteria.keywords) || "Auto-Apply Job",
        status: recentStatusLabel(job.status as JobStatus),
        date: new Date(job.createdAt).toLocaleDateString(),
        match: Number.isFinite(matchValue) && matchValue > 0 ? matchValue : null,
        provider,
        sourceLabel: jobProviderLabel(provider),
        sourceUrl,
        externalJobId,
      };
    });

    const proTip = buildProTip(userSnapshot, {
      submitted: applicationsSubmitted,
      failedJobs,
      activeJobs,
    });

    const interview = buildInterviewCard({
      submitted: applicationsSubmitted,
      activeJobs,
      failedJobs,
      readiness: interviewReadiness,
    });

    return ok("Dashboard summary fetched", {
      jobs: {
        total: jobsTotal,
        queued: jobsQueued,
        running: jobsRunning,
        active: activeJobs,
        succeeded: jobsSucceeded,
        failed: failedJobs,
        cancelled: jobsCancelled,
        deadLetter: jobsDeadLetter,
      },
      applications: {
        total: applicationsTotal,
        submitted: applicationsSubmitted,
        skipped: applicationsSkipped,
        failed: applicationsFailed,
      },
      metrics: {
        responseRate,
        completionRate,
        interviewReadiness,
      },
      recent,
      activityByDay: buildActivityByDay(jobsLast7Days),
      proTip,
      interview,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch dashboard summary");
  }
}
