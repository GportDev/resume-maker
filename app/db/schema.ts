import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { aiProviders } from "../lib/ai-providers";
import {
  applicationSources,
  applicationStatuses,
  salaryPeriods,
} from "../lib/applications";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("user_email_idx").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_idx").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    headline: text("headline").default("").notNull(),
    email: text("email").default("").notNull(),
    phone: text("phone").default("").notNull(),
    location: text("location").default("").notNull(),
    website: text("website").default("").notNull(),
    linkedin: text("linkedin").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("profiles_user_id_idx").on(table.userId)],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website").default("").notNull(),
    location: text("location").default("").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("companies_owner_name_idx").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
    uniqueIndex("companies_id_owner_idx").on(table.id, table.userId),
  ],
);

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    position: text("position").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    isCurrent: boolean("is_current").default(false).notNull(),
    markdown: text("markdown").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("experiences_user_id_idx").on(table.userId),
    index("experiences_company_id_idx").on(table.companyId),
    foreignKey({
      name: "experiences_company_owner_fk",
      columns: [table.companyId, table.userId],
      foreignColumns: [companies.id, companies.userId],
    }).onDelete("no action"),
    check(
      "experiences_dates_check",
      sql`${table.isCurrent} OR (${table.endDate} IS NOT NULL AND ${table.endDate} >= ${table.startDate})`,
    ),
  ],
);

export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    position: text("position").notNull(),
    location: text("location").default("").notNull(),
    jobDescription: text("job_description").default("").notNull(),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: char("salary_currency", { length: 3 })
      .default("USD")
      .notNull(),
    salaryPeriod: text("salary_period", { enum: salaryPeriods })
      .default("year")
      .notNull(),
    status: text("status", { enum: applicationStatuses })
      .default("saved")
      .notNull(),
    sortOrder: doublePrecision("sort_order").notNull(),
    source: text("source", { enum: applicationSources })
      .default("manual")
      .notNull(),
    externalId: text("external_id"),
    sourceUrl: text("source_url"),
    notes: text("notes").default("").notNull(),
    appliedAt: date("applied_at", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("job_applications_board_idx").on(
      table.userId,
      table.status,
      table.sortOrder,
    ),
    uniqueIndex("job_applications_external_idx")
      .on(table.userId, table.source, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    check(
      "job_applications_salary_check",
      sql`(${table.salaryMin} IS NULL OR ${table.salaryMin} >= 0) AND (${table.salaryMax} IS NULL OR ${table.salaryMax} >= 0) AND (${table.salaryMin} IS NULL OR ${table.salaryMax} IS NULL OR ${table.salaryMin} <= ${table.salaryMax})`,
    ),
    check(
      "job_applications_currency_check",
      sql`${table.salaryCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "job_applications_salary_period_check",
      sql`${table.salaryPeriod} IN ('year', 'month', 'hour')`,
    ),
    check(
      "job_applications_status_check",
      sql`${table.status} IN ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')`,
    ),
    check(
      "job_applications_source_check",
      sql`${table.source} IN ('manual', 'linkedin')`,
    ),
  ],
);

export const jobAnalyses = pgTable(
  "job_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => jobApplications.id, {
      onDelete: "set null",
    }),
    jobDescription: text("job_description").notNull(),
    jobTitle: text("job_title").notNull(),
    companyName: text("company_name").default("").notNull(),
    analysis: jsonb("analysis").notNull(),
    score: jsonb("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("job_analyses_user_id_idx").on(table.userId),
    index("job_analyses_application_id_idx").on(table.applicationId),
  ],
);

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => jobAnalyses.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => jobApplications.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resumes_user_id_idx").on(table.userId),
    index("resumes_analysis_id_idx").on(table.analysisId),
    index("resumes_application_id_idx").on(table.applicationId),
  ],
);

export const coverLetters = pgTable(
  "cover_letters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => jobApplications.id, {
      onDelete: "set null",
    }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => jobAnalyses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("cover_letters_user_id_idx").on(table.userId),
    index("cover_letters_application_id_idx").on(table.applicationId),
    index("cover_letters_analysis_id_idx").on(table.analysisId),
  ],
);

export const jobMatches = pgTable(
  "job_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => jobApplications.id, {
      onDelete: "set null",
    }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => jobAnalyses.id, { onDelete: "cascade" }),
    modelVersion: text("model_version").notNull(),
    questionVersion: text("question_version").notNull(),
    answers: jsonb("answers").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("job_matches_user_id_idx").on(table.userId),
    index("job_matches_application_id_idx").on(table.applicationId),
    index("job_matches_analysis_id_idx").on(table.analysisId),
  ],
);

export const userApiCredentials = pgTable(
  "user_api_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: aiProviders })
      .default("openai")
      .notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: text("key_version").default("v1").notNull(),
    lastFour: text("last_four").notNull(),
    testedAt: timestamp("tested_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_api_credentials_owner_provider_idx").on(
      table.userId,
      table.provider,
    ),
    check(
      "user_api_credentials_provider_check",
      sql`${table.provider} IN ('anthropic', 'openai')`,
    ),
  ],
);

export const userSettings = pgTable(
  "user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    aiProvider: text("ai_provider", { enum: aiProviders }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "user_settings_ai_provider_check",
      sql`${table.aiProvider} IN ('anthropic', 'openai')`,
    ),
  ],
);

export const authSchema = { user, session, account, verification };
