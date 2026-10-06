import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNotNull,
  max,
  or,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";
import {
  companies,
  coverLetters,
  experiences,
  jobAnalyses,
  jobApplications,
  profiles,
  resumes,
  userApiCredentials,
  userSettings,
} from "../db/schema";
import type { AiProvider } from "./ai-providers";
import {
  type ApplicationInput,
  type ApplicationSource,
  type ApplicationStatus,
  computeSortOrder,
  type MovePlacement,
  planMove,
} from "./applications";
import type { CompanyRecord, ExperienceWithCompany } from "./contributions";
import { type Database, db } from "./db.server";
import type {
  companyInputSchema,
  experienceInputSchema,
  profileInputSchema,
} from "./validation";

type ProfileInput = z.infer<typeof profileInputSchema>;
type CompanyInput = z.output<typeof companyInputSchema>;
type ExperienceInput = z.output<typeof experienceInputSchema>;
type ExperienceWriteInput = Omit<ExperienceInput, "company"> & {
  companyId: string;
};

export async function getProfile(userId: string) {
  return db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
}

export async function saveProfile(userId: string, input: ProfileInput) {
  const [profile] = await db
    .insert(profiles)
    .values({ ...input, userId })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return profile;
}

function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, error instanceof Error ? error.cause : undefined];
  return candidates.some(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      candidate.code === "23505",
  );
}

export async function listCompanies(userId: string) {
  return db.query.companies.findMany({
    where: eq(companies.userId, userId),
    orderBy: [asc(companies.sortOrder), asc(companies.name)],
  });
}

export async function getCompany(userId: string, companyId: string) {
  return db.query.companies.findFirst({
    where: and(eq(companies.id, companyId), eq(companies.userId, userId)),
  });
}

async function findCompanyByName(userId: string, name: string) {
  return db.query.companies.findFirst({
    where: and(
      eq(companies.userId, userId),
      sql`lower(${companies.name}) = lower(${name})`,
    ),
  });
}

export async function createCompany(
  userId: string,
  input: CompanyInput,
): Promise<{ company: CompanyRecord } | { error: "duplicate" }> {
  const [company] = await db
    .insert(companies)
    .values({ ...input, userId })
    .onConflictDoNothing()
    .returning();
  return company ? { company } : { error: "duplicate" };
}

export async function findOrCreateCompany(userId: string, name: string) {
  const existing = await findCompanyByName(userId, name);
  if (existing) return existing;
  const created = await createCompany(userId, {
    name,
    website: "",
    location: "",
  });
  if ("company" in created) return created.company;
  const raced = await findCompanyByName(userId, name);
  if (!raced) throw new Error("Company could not be created.");
  return raced;
}

export async function updateCompany(
  userId: string,
  companyId: string,
  input: CompanyInput,
): Promise<{ company: CompanyRecord } | { error: "duplicate" | "not-found" }> {
  const clash = await findCompanyByName(userId, input.name);
  if (clash && clash.id !== companyId) return { error: "duplicate" };
  try {
    const [company] = await db
      .update(companies)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
      .returning();
    return company ? { company } : { error: "not-found" };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "duplicate" };
    throw error;
  }
}

export async function countCompanyExperiences(
  userId: string,
  companyId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(experiences)
    .where(
      and(eq(experiences.companyId, companyId), eq(experiences.userId, userId)),
    );
  return row?.total ?? 0;
}

export async function deleteCompany(
  userId: string,
  companyId: string,
): Promise<"deleted" | "has-positions" | "not-found"> {
  if ((await countCompanyExperiences(userId, companyId)) > 0) {
    return "has-positions";
  }
  const [deleted] = await db
    .delete(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .returning({ id: companies.id });
  return deleted ? "deleted" : "not-found";
}

export async function resolveExperienceCompany(
  userId: string,
  company: ExperienceInput["company"],
): Promise<CompanyRecord | undefined> {
  if (company.kind === "new") return findOrCreateCompany(userId, company.name);
  return getCompany(userId, company.id);
}

const experienceWithCompanyColumns = {
  ...getTableColumns(experiences),
  company: companies.name,
};

function selectExperiencesWithCompany() {
  return db
    .select(experienceWithCompanyColumns)
    .from(experiences)
    .innerJoin(
      companies,
      and(
        eq(companies.id, experiences.companyId),
        eq(companies.userId, experiences.userId),
      ),
    );
}

export async function listExperiences(
  userId: string,
): Promise<ExperienceWithCompany[]> {
  return selectExperiencesWithCompany()
    .where(eq(experiences.userId, userId))
    .orderBy(desc(experiences.startDate));
}

export async function getExperience(
  userId: string,
  experienceId: string,
): Promise<ExperienceWithCompany | undefined> {
  const [experience] = await selectExperiencesWithCompany().where(
    and(eq(experiences.id, experienceId), eq(experiences.userId, userId)),
  );
  return experience;
}

export async function createExperience(
  userId: string,
  input: ExperienceWriteInput,
) {
  const [experience] = await db
    .insert(experiences)
    .values({ ...input, userId })
    .returning();
  return experience;
}

export async function updateExperience(
  userId: string,
  experienceId: string,
  input: ExperienceWriteInput,
) {
  const [experience] = await db
    .update(experiences)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(eq(experiences.id, experienceId), eq(experiences.userId, userId)),
    )
    .returning();
  return experience;
}

export async function updateExperienceMarkdown(
  userId: string,
  experienceId: string,
  markdown: string,
) {
  const [experience] = await db
    .update(experiences)
    .set({ markdown, updatedAt: new Date() })
    .where(
      and(eq(experiences.id, experienceId), eq(experiences.userId, userId)),
    )
    .returning({ id: experiences.id, updatedAt: experiences.updatedAt });
  return experience;
}

export async function deleteExperience(userId: string, experienceId: string) {
  const [experience] = await db
    .delete(experiences)
    .where(
      and(eq(experiences.id, experienceId), eq(experiences.userId, userId)),
    )
    .returning({ id: experiences.id });
  return experience;
}

const applicationBoardColumns = {
  id: jobApplications.id,
  companyName: jobApplications.companyName,
  position: jobApplications.position,
  location: jobApplications.location,
  salaryMin: jobApplications.salaryMin,
  salaryMax: jobApplications.salaryMax,
  salaryCurrency: jobApplications.salaryCurrency,
  salaryPeriod: jobApplications.salaryPeriod,
  status: jobApplications.status,
  sortOrder: jobApplications.sortOrder,
  source: jobApplications.source,
  appliedAt: jobApplications.appliedAt,
  updatedAt: jobApplications.updatedAt,
};

export type ApplicationSummary = Awaited<
  ReturnType<typeof listApplications>
>[number];

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function applicationOwner(userId: string, applicationId: string) {
  return and(
    eq(jobApplications.id, applicationId),
    eq(jobApplications.userId, userId),
  );
}

export async function listApplications(
  userId: string,
  options: { q?: string } = {},
) {
  const query = options.q?.trim();
  const pattern = query ? `%${escapeLikePattern(query)}%` : undefined;
  return db
    .select(applicationBoardColumns)
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.userId, userId),
        pattern
          ? or(
              ilike(jobApplications.companyName, pattern),
              ilike(jobApplications.position, pattern),
              ilike(jobApplications.location, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(asc(jobApplications.sortOrder), asc(jobApplications.createdAt));
}

export async function getApplication(userId: string, applicationId: string) {
  return db.query.jobApplications.findFirst({
    where: applicationOwner(userId, applicationId),
  });
}

async function endOfColumnSortOrder(
  executor: Pick<Database, "select">,
  userId: string,
  status: ApplicationStatus,
): Promise<number> {
  const [row] = await executor
    .select({ last: max(jobApplications.sortOrder) })
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.userId, userId),
        eq(jobApplications.status, status),
      ),
    );
  return computeSortOrder(row?.last ?? undefined);
}

export async function createApplication(
  userId: string,
  input: ApplicationInput,
  origin: {
    source: ApplicationSource;
    externalId?: string | null;
  } = { source: "manual" },
) {
  const sortOrder = await endOfColumnSortOrder(db, userId, input.status);
  const [application] = await db
    .insert(jobApplications)
    .values({
      ...input,
      ...origin,
      userId,
      sortOrder,
    })
    .returning();
  return application;
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  input: ApplicationInput,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: jobApplications.status,
        sortOrder: jobApplications.sortOrder,
      })
      .from(jobApplications)
      .where(applicationOwner(userId, applicationId))
      .for("update");
    if (!current) return undefined;
    const sortOrder =
      current.status === input.status
        ? current.sortOrder
        : await endOfColumnSortOrder(tx, userId, input.status);
    const [application] = await tx
      .update(jobApplications)
      .set({ ...input, sortOrder, updatedAt: new Date() })
      .where(applicationOwner(userId, applicationId))
      .returning();
    return application;
  });
}

export async function moveApplication(
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
  sortOrder: number,
) {
  const [application] = await db
    .update(jobApplications)
    .set({ status, sortOrder, updatedAt: new Date() })
    .where(applicationOwner(userId, applicationId))
    .returning({ id: jobApplications.id });
  return application;
}

export async function placeApplication(
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
  placement: MovePlacement,
): Promise<"moved" | "not-found" | "invalid"> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: jobApplications.id })
      .from(jobApplications)
      .where(applicationOwner(userId, applicationId))
      .for("update");
    if (!current) return "not-found";

    const column = await tx
      .select({ id: jobApplications.id, sortOrder: jobApplications.sortOrder })
      .from(jobApplications)
      .where(
        and(
          eq(jobApplications.userId, userId),
          eq(jobApplications.status, status),
        ),
      )
      .for("update");
    const plan = planMove(column, applicationId, placement);
    if (plan.kind === "invalid") return "invalid";

    const now = new Date();
    if (plan.kind === "place") {
      await tx
        .update(jobApplications)
        .set({ status, sortOrder: plan.sortOrder, updatedAt: now })
        .where(applicationOwner(userId, applicationId));
      return "moved";
    }

    for (const order of plan.orders) {
      await tx
        .update(jobApplications)
        .set(
          order.id === applicationId
            ? { status, sortOrder: order.sortOrder, updatedAt: now }
            : { sortOrder: order.sortOrder },
        )
        .where(applicationOwner(userId, order.id));
    }
    return "moved";
  });
}

export async function deleteApplication(userId: string, applicationId: string) {
  const [application] = await db
    .delete(jobApplications)
    .where(applicationOwner(userId, applicationId))
    .returning({ id: jobApplications.id });
  return application;
}

export async function listApplicationOptions(userId: string) {
  return db
    .select({
      id: jobApplications.id,
      companyName: jobApplications.companyName,
      position: jobApplications.position,
      status: jobApplications.status,
    })
    .from(jobApplications)
    .where(eq(jobApplications.userId, userId))
    .orderBy(desc(jobApplications.updatedAt));
}

export async function saveApplicationJobDescription(
  userId: string,
  applicationId: string,
  jobDescription: string,
) {
  const [application] = await db
    .update(jobApplications)
    .set({ jobDescription, updatedAt: new Date() })
    .where(applicationOwner(userId, applicationId))
    .returning();
  return application;
}

export async function listAnalyses(userId: string) {
  return db.query.jobAnalyses.findMany({
    where: eq(jobAnalyses.userId, userId),
    orderBy: [desc(jobAnalyses.createdAt)],
  });
}

export async function getAnalysis(userId: string, analysisId: string) {
  return db.query.jobAnalyses.findFirst({
    where: and(eq(jobAnalyses.id, analysisId), eq(jobAnalyses.userId, userId)),
  });
}

export async function getLatestApplicationAnalysis(
  userId: string,
  applicationId: string,
) {
  return db.query.jobAnalyses.findFirst({
    where: and(
      eq(jobAnalyses.userId, userId),
      eq(jobAnalyses.applicationId, applicationId),
    ),
    orderBy: [desc(jobAnalyses.createdAt)],
  });
}

export type AnalysisInput = {
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  analysis: unknown;
  score: unknown;
};

async function ownsApplication(
  executor: Pick<Database, "select">,
  userId: string,
  applicationId: string,
): Promise<boolean> {
  const [row] = await executor
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .where(applicationOwner(userId, applicationId))
    .for("share");
  return Boolean(row);
}

export async function createAnalysis(
  userId: string,
  input: AnalysisInput & { applicationId?: string | null },
) {
  return db.transaction(async (tx) => {
    if (
      input.applicationId &&
      !(await ownsApplication(tx, userId, input.applicationId))
    ) {
      return undefined;
    }
    const [analysis] = await tx
      .insert(jobAnalyses)
      .values({ ...input, userId })
      .returning();
    return analysis;
  });
}

export async function createApplicationWithAnalysis(
  userId: string,
  application: ApplicationInput,
  analysis: AnalysisInput,
) {
  return db.transaction(async (tx) => {
    const sortOrder = await endOfColumnSortOrder(
      tx,
      userId,
      application.status,
    );
    const [createdApplication] = await tx
      .insert(jobApplications)
      .values({ ...application, source: "manual", userId, sortOrder })
      .returning({ id: jobApplications.id });
    if (!createdApplication) throw new Error("Application insert failed.");
    const [createdAnalysis] = await tx
      .insert(jobAnalyses)
      .values({ ...analysis, applicationId: createdApplication.id, userId })
      .returning({ id: jobAnalyses.id });
    if (!createdAnalysis) throw new Error("Analysis insert failed.");
    return {
      applicationId: createdApplication.id,
      analysisId: createdAnalysis.id,
    };
  });
}

export type TailoredDocumentsInput = {
  applicationId: string;
  analysisId: string;
  resume: { title: string; content: unknown };
  coverLetter: { title: string; content: unknown };
};

export async function createTailoredDocuments(
  userId: string,
  input: TailoredDocumentsInput,
): Promise<{ resumeId: string; coverLetterId: string } | undefined> {
  return db.transaction(async (tx) => {
    if (!(await ownsApplication(tx, userId, input.applicationId))) {
      return undefined;
    }
    const [analysis] = await tx
      .select({ id: jobAnalyses.id })
      .from(jobAnalyses)
      .where(
        and(
          eq(jobAnalyses.id, input.analysisId),
          eq(jobAnalyses.userId, userId),
          eq(jobAnalyses.applicationId, input.applicationId),
        ),
      );
    if (!analysis) return undefined;

    const link = {
      userId,
      applicationId: input.applicationId,
      analysisId: input.analysisId,
    };
    const [resume] = await tx
      .insert(resumes)
      .values({ ...link, ...input.resume })
      .returning({ id: resumes.id });
    const [coverLetter] = await tx
      .insert(coverLetters)
      .values({ ...link, ...input.coverLetter })
      .returning({ id: coverLetters.id });
    if (!resume || !coverLetter) throw new Error("Document insert failed.");
    return { resumeId: resume.id, coverLetterId: coverLetter.id };
  });
}

export type ApplicationDocumentSummary = {
  applicationId: string;
  analysisId: string | null;
  score: unknown;
  resumeId: string | null;
  coverLetterId: string | null;
};

export async function listApplicationDocumentSummaries(
  userId: string,
  applicationId?: string,
): Promise<Map<string, ApplicationDocumentSummary>> {
  const scope = (column: AnyPgColumn) =>
    applicationId ? eq(column, applicationId) : isNotNull(column);

  const [analysisRows, resumeRows, coverLetterRows] = await Promise.all([
    db
      .selectDistinctOn([jobAnalyses.applicationId], {
        applicationId: jobAnalyses.applicationId,
        id: jobAnalyses.id,
        score: jobAnalyses.score,
      })
      .from(jobAnalyses)
      .where(
        and(eq(jobAnalyses.userId, userId), scope(jobAnalyses.applicationId)),
      )
      .orderBy(jobAnalyses.applicationId, desc(jobAnalyses.createdAt)),
    db
      .selectDistinctOn([resumes.applicationId], {
        applicationId: resumes.applicationId,
        id: resumes.id,
      })
      .from(resumes)
      .where(and(eq(resumes.userId, userId), scope(resumes.applicationId)))
      .orderBy(resumes.applicationId, desc(resumes.createdAt)),
    db
      .selectDistinctOn([coverLetters.applicationId], {
        applicationId: coverLetters.applicationId,
        id: coverLetters.id,
      })
      .from(coverLetters)
      .where(
        and(eq(coverLetters.userId, userId), scope(coverLetters.applicationId)),
      )
      .orderBy(coverLetters.applicationId, desc(coverLetters.createdAt)),
  ]);

  const summaries = new Map<string, ApplicationDocumentSummary>();
  const entry = (id: string) => {
    let summary = summaries.get(id);
    if (!summary) {
      summary = {
        applicationId: id,
        analysisId: null,
        score: null,
        resumeId: null,
        coverLetterId: null,
      };
      summaries.set(id, summary);
    }
    return summary;
  };
  for (const row of analysisRows) {
    if (!row.applicationId) continue;
    Object.assign(entry(row.applicationId), {
      analysisId: row.id,
      score: row.score,
    });
  }
  for (const row of resumeRows) {
    if (row.applicationId) entry(row.applicationId).resumeId = row.id;
  }
  for (const row of coverLetterRows) {
    if (row.applicationId) entry(row.applicationId).coverLetterId = row.id;
  }
  return summaries;
}

export async function getResume(userId: string, resumeId: string) {
  return db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
  });
}

export async function getCoverLetter(userId: string, coverLetterId: string) {
  return db.query.coverLetters.findFirst({
    where: and(
      eq(coverLetters.id, coverLetterId),
      eq(coverLetters.userId, userId),
    ),
  });
}

export async function updateCoverLetter(
  userId: string,
  coverLetterId: string,
  input: { title: string; content: unknown },
) {
  const [coverLetter] = await db
    .update(coverLetters)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(eq(coverLetters.id, coverLetterId), eq(coverLetters.userId, userId)),
    )
    .returning();
  return coverLetter;
}

export async function listAnalysisDocuments(
  userId: string,
  analysisId: string,
) {
  const [resumeRows, coverLetterRows] = await Promise.all([
    db
      .select({ id: resumes.id, title: resumes.title })
      .from(resumes)
      .where(
        and(eq(resumes.userId, userId), eq(resumes.analysisId, analysisId)),
      )
      .orderBy(desc(resumes.createdAt)),
    db
      .select({ id: coverLetters.id, title: coverLetters.title })
      .from(coverLetters)
      .where(
        and(
          eq(coverLetters.userId, userId),
          eq(coverLetters.analysisId, analysisId),
        ),
      )
      .orderBy(desc(coverLetters.createdAt)),
  ]);
  return { resumes: resumeRows, coverLetters: coverLetterRows };
}

export async function updateResume(
  userId: string,
  resumeId: string,
  input: { title: string; content: unknown },
) {
  const [resume] = await db
    .update(resumes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .returning();
  return resume;
}

export async function getUserApiCredential(
  userId: string,
  provider: AiProvider,
) {
  return db.query.userApiCredentials.findFirst({
    where: and(
      eq(userApiCredentials.userId, userId),
      eq(userApiCredentials.provider, provider),
    ),
  });
}

export async function listUserApiCredentials(userId: string) {
  return db.query.userApiCredentials.findMany({
    where: eq(userApiCredentials.userId, userId),
  });
}

export async function saveUserApiCredential(
  userId: string,
  provider: AiProvider,
  credential: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: string;
    lastFour: string;
  },
) {
  const [saved] = await db
    .insert(userApiCredentials)
    .values({ ...credential, userId, provider, testedAt: new Date() })
    .onConflictDoUpdate({
      target: [userApiCredentials.userId, userApiCredentials.provider],
      set: { ...credential, testedAt: new Date(), updatedAt: new Date() },
    })
    .returning();
  return saved;
}

export async function deleteUserApiCredential(
  userId: string,
  provider: AiProvider,
) {
  const [deleted] = await db
    .delete(userApiCredentials)
    .where(
      and(
        eq(userApiCredentials.userId, userId),
        eq(userApiCredentials.provider, provider),
      ),
    )
    .returning({ id: userApiCredentials.id });
  return deleted;
}

export async function getUserSettings(userId: string) {
  return db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
}

export async function saveUserSettings(
  userId: string,
  input: { aiProvider: AiProvider },
) {
  const [settings] = await db
    .insert(userSettings)
    .values({ ...input, userId })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return settings;
}
