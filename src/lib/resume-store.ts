import { prisma } from "src/lib/prisma";
import { writeAuditLog } from "src/lib/audit";
import type { parseResumeFile } from "src/lib/resume-parser";
import type { AiParsedResume } from "src/lib/resume-ai-parser";

type ParsedResumeFile = Awaited<ReturnType<typeof parseResumeFile>>;

// Combines the regex and AI reads of a resume, AI values winning where present.
export function mergeResumeFields(parsed: ParsedResumeFile, aiParsed: AiParsedResume | null) {
  return {
    ...parsed.extracted,
    ...(aiParsed ? {
      city: aiParsed.city || parsed.extracted.currentCity,
      state: aiParsed.state,
      country: aiParsed.country,
      name: aiParsed.name || parsed.extracted.name,
      email: aiParsed.email || parsed.extracted.email,
      phone: aiParsed.phone || parsed.extracted.phone,
      linkedinUrl: aiParsed.linkedinUrl || parsed.extracted.linkedinUrl,
      portfolioUrl: aiParsed.portfolioUrl || parsed.extracted.portfolioUrl,
      yearsOfExperience: aiParsed.yearsOfExperience,
      educationLevel: aiParsed.educationLevel,
      skills: aiParsed.skills,
      jobTitles: aiParsed.jobTitles,
      workAuthorization: aiParsed.workAuthorization,
      summary: aiParsed.summary,
      experience: aiParsed.experience,
      projects: aiParsed.projects,
      education: aiParsed.education,
      certifications: aiParsed.certifications,
    } : {}),
  };
}

// Saves an uploaded resume to the account, along with the job titles and summary
// as screening answers the dashboard and extension read.
export async function saveResumeForUser(
  userId: string,
  file: { name: string; size: number },
  parsed: ParsedResumeFile,
  mergedExtracted: ReturnType<typeof mergeResumeFields>,
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      resumeFileName: file.name,
      resumeFilePath: null,
    },
  });

  await prisma.userResume.upsert({
    where: { userId },
    update: {
      resumeText: parsed.text.slice(0, 100000),
      parsedData: mergedExtracted,
      uploadedAt: new Date(),
    },
    create: {
      userId,
      resumeText: parsed.text.slice(0, 100000),
      parsedData: mergedExtracted,
    },
  });

  // Auto-save generated summary / description to screening answers so the extension and dashboard have it instantly
  if (mergedExtracted.summary) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "description",
      metadataJson: {
        questionKey: "description",
        questionLabel: "Professional Description / Summary",
        answer: mergedExtracted.summary,
        answerType: "text",
        source: "resume_parse",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);

    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "summary",
      metadataJson: {
        questionKey: "summary",
        questionLabel: "Summary of Experience",
        answer: mergedExtracted.summary,
        answerType: "text",
        source: "resume_parse",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);
  }

  if (Array.isArray(mergedExtracted.jobTitles) && mergedExtracted.jobTitles.length > 0) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "preferred_job_titles",
      metadataJson: {
        questionKey: "preferred_job_titles",
        questionLabel: "Preferred Job Titles / Search Terms",
        answer: mergedExtracted.jobTitles.join(", "),
        answerType: "multiselect",
        source: "resume_parse",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);

    await writeAuditLog({
      actorUserId: userId,
      action: "user.screening_answer_saved",
      targetType: "screening_answer",
      targetId: "cp_pref_search_terms",
      metadataJson: {
        questionKey: "cp_pref_search_terms",
        questionLabel: "Preferred Job Titles / Search Terms",
        answer: mergedExtracted.jobTitles.join(", "),
        answerType: "multiselect",
        source: "resume_parse",
        lastUsed: new Date().toISOString(),
      },
    }).catch(() => null);
  }

  await writeAuditLog({
    actorUserId: userId,
    action: "user.resume_uploaded",
    targetType: "resume",
    metadataJson: {
      fileName: file.name,
      size: file.size,
    },
  });
}
