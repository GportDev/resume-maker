// Local development seed. Creates a test account with realistic data so every
// page can be checked in a browser. Never run against a shared database.
//
// Usage: node scripts/seed-dev.mjs [baseUrl]
// Requires the dev server running and DATABASE_URL pointing at a local database.
import { readFileSync } from "node:fs";
import pg from "pg";

const devAccount = {
  name: "Dana Reyes",
  email: "dana@resume-fit.test",
  password: "local-dev-only-password",
};

function loadEnv() {
  const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const env = loadEnv();
const databaseUrl = env.DATABASE_URL ?? "";
const host = new URL(databaseUrl).hostname;
if (!["localhost", "127.0.0.1"].includes(host)) {
  throw new Error(`Refusing to seed non-local database host: ${host}`);
}
const baseUrl = process.argv[2] ?? env.BETTER_AUTH_URL;

const signUp = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: baseUrl },
  body: JSON.stringify(devAccount),
});
if (!signUp.ok && signUp.status !== 422) {
  throw new Error(`Sign-up failed with status ${signUp.status}`);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const {
  rows: [account],
} = await client.query(`select id from "user" where email = $1`, [
  devAccount.email,
]);
if (!account) throw new Error("Dev account not found after sign-up.");
const userId = account.id;

await client.query("begin");
for (const table of [
  "job_matches",
  "cover_letters",
  "resumes",
  "job_analyses",
  "job_applications",
  "experiences",
  "companies",
  "profiles",
]) {
  await client.query(`delete from ${table} where user_id = $1`, [userId]);
}

await client.query(
  `insert into profiles (user_id, full_name, headline, email, phone, location, website, linkedin)
   values ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [
    userId,
    devAccount.name,
    "Staff software engineer, payments and platform",
    devAccount.email,
    "+351 912 000 000",
    "Lisbon, Portugal",
    "https://dana.example",
    "https://www.linkedin.com/in/dana-example",
  ],
);

async function company(name, location, sortOrder) {
  const { rows } = await client.query(
    `insert into companies (user_id, name, location, sort_order) values ($1, $2, $3, $4) returning id`,
    [userId, name, location, sortOrder],
  );
  return rows[0].id;
}

async function experience(companyId, position, startDate, endDate, markdown) {
  const { rows } = await client.query(
    `insert into experiences (user_id, company_id, position, start_date, end_date, is_current, markdown)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      userId,
      companyId,
      position,
      startDate,
      endDate,
      endDate === null,
      markdown,
    ],
  );
  return rows[0].id;
}

const acme = await company("Acme Payments", "Lisbon", 0);
const northwind = await company("Northwind Logistics", "Remote", 1);
const brightlane = await company("Brightlane Health", "Porto", 2);

const staff = await experience(
  acme,
  "Staff Software Engineer",
  "2022-03-01",
  null,
  `## Context

Payments platform serving 4,000 merchants across 12 EU markets. Team of 6 engineers.

## Contributions

- Led the migration of card processing from a legacy gateway to Stripe, moving **€1.2B** annual volume with zero downtime.
- Designed an idempotent ledger service in TypeScript and PostgreSQL that reconciles 2M transactions per day.
- Mentored four engineers; two promoted to senior.

## Outcomes

- Cut checkout p95 latency by **40%** (820 ms to 490 ms).
- Reduced chargeback disputes by 18% with automated evidence collection.

## Tools

TypeScript, Node.js, PostgreSQL, Stripe, Kafka, AWS, Terraform
`,
);
const senior = await experience(
  acme,
  "Senior Software Engineer",
  "2020-01-15",
  "2022-02-28",
  `## Context

Checkout team for a fast-growing payments startup.

## Contributions

- Built the merchant onboarding flow in React, raising completion from 54% to 71%.
- Introduced contract tests between checkout and risk services.

## Tools

React, TypeScript, Go, PostgreSQL
`,
);
const lead = await experience(
  northwind,
  "Engineering Lead, Routing",
  "2017-06-01",
  "2019-12-20",
  `## Context

Route planning for 900 delivery vans in the Iberian peninsula.

## Contributions

- Led a team of 5 building a route optimizer that cut fuel cost by 11%.
- Owned on-call for the dispatch platform; brought incidents down from 9 to 2 per month.
`,
);
await experience(
  northwind,
  "Software Engineer",
  "2015-09-01",
  "2017-05-31",
  `## Contributions

- Wrote the driver mobile API in Python.
- Helped migrate the monolith to services
`,
);
await experience(
  brightlane,
  "Software Engineering Intern",
  "2014-06-01",
  "2014-09-30",
  `Worked on the patient scheduling app.
`,
);

const jobDescription = `Senior Backend Engineer, Payments — Lumen Bank (Lisbon, hybrid)

We are looking for a senior backend engineer to own our card payments platform. You will design reliable, idempotent services that move money for millions of customers.

Requirements
- 6+ years building backend systems in TypeScript, Go, or Java
- Deep experience with PostgreSQL and transactional data modeling
- Experience integrating payment processors such as Stripe or Adyen
- Experience with event streaming (Kafka)
- Strong ownership of on-call and incident response

Nice to have
- Terraform and AWS
- Experience mentoring engineers
- Knowledge of PCI DSS`;

async function application(fields) {
  const { rows } = await client.query(
    `insert into job_applications
      (user_id, company_name, position, location, job_description, salary_min, salary_max, salary_currency, salary_period, status, sort_order, source, external_id, source_url, notes, applied_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
    [
      userId,
      fields.company,
      fields.position,
      fields.location ?? "",
      fields.jobDescription ?? "",
      fields.salaryMin ?? null,
      fields.salaryMax ?? null,
      fields.currency ?? "EUR",
      fields.period ?? "year",
      fields.status,
      fields.sortOrder,
      fields.source ?? "manual",
      fields.externalId ?? null,
      fields.sourceUrl ?? null,
      fields.notes ?? "",
      fields.appliedAt ?? null,
    ],
  );
  return rows[0].id;
}

const lumen = await application({
  company: "Lumen Bank",
  position: "Senior Backend Engineer, Payments",
  location: "Lisbon, hybrid",
  jobDescription,
  salaryMin: 70000,
  salaryMax: 90000,
  status: "applied",
  sortOrder: 1,
  notes: "Recruiter: Inês. First call booked for Thursday.",
  appliedAt: "2026-10-14",
});
await application({
  company: "Tidewater Energy",
  position: "Platform Engineer",
  location: "Remote (EU)",
  status: "saved",
  sortOrder: 1,
  source: "linkedin",
  externalId: "4012345678",
  sourceUrl: "https://www.linkedin.com/jobs/view/4012345678",
  salaryMin: 65000,
  salaryMax: 80000,
});
await application({
  company: "Orbital Maps",
  position: "Staff Engineer, Routing",
  location: "Berlin",
  status: "saved",
  sortOrder: 2,
});
await application({
  company: "Kestrel Insurance",
  position: "Engineering Manager",
  location: "Lisbon",
  status: "interviewing",
  sortOrder: 1,
  appliedAt: "2026-09-30",
});
await application({
  company: "Fernhill Retail",
  position: "Senior Software Engineer, Checkout",
  location: "Porto",
  status: "offer",
  sortOrder: 1,
  salaryMin: 75000,
  salaryMax: 75000,
  appliedAt: "2026-09-02",
});
await application({
  company: "Quanta Labs",
  position: "Backend Engineer",
  location: "Remote",
  status: "rejected",
  sortOrder: 1,
  appliedAt: "2026-08-20",
});
await application({
  company: "Halcyon Travel",
  position: "Principal Engineer",
  location: "Madrid",
  status: "withdrawn",
  sortOrder: 1,
});

const analysis = {
  jobTitle: "Senior Backend Engineer, Payments",
  companyName: "Lumen Bank",
  seniority: "Senior",
  requiredSkills: [
    "TypeScript",
    "PostgreSQL",
    "Stripe",
    "Kafka",
    "Incident response",
  ],
  preferredSkills: ["Terraform", "AWS", "Mentoring", "PCI DSS"],
  keywords: [
    "payments",
    "idempotent",
    "PostgreSQL",
    "Kafka",
    "Stripe",
    "on-call",
    "TypeScript",
    "Go",
    "PCI DSS",
    "Adyen",
  ],
  responsibilities: [
    "Own the card payments platform",
    "Design reliable, idempotent services",
  ],
  matches: [
    {
      requirement: "Experience integrating payment processors such as Stripe",
      evidence:
        "Led the migration of card processing to Stripe, moving €1.2B annual volume with zero downtime.",
      experienceIds: [staff],
      strength: "strong",
    },
    {
      requirement: "Deep experience with PostgreSQL and transactional data",
      evidence:
        "Designed an idempotent ledger service in TypeScript and PostgreSQL reconciling 2M transactions per day.",
      experienceIds: [staff, senior],
      strength: "strong",
    },
    {
      requirement: "Strong ownership of on-call and incident response",
      evidence:
        "Owned on-call for the dispatch platform; brought incidents down from 9 to 2 per month.",
      experienceIds: [lead],
      strength: "partial",
    },
  ],
  missingSkills: ["PCI DSS", "Adyen"],
};
const score = {
  total: 78,
  keywordCoverage: 19,
  requiredSkillCoverage: 29,
  evidenceStrength: 18,
  titleAlignment: 8,
  profileCompleteness: 4,
};
const {
  rows: [createdAnalysis],
} = await client.query(
  `insert into job_analyses (user_id, application_id, job_description, job_title, company_name, analysis, score)
   values ($1,$2,$3,$4,$5,$6,$7) returning id`,
  [
    userId,
    lumen,
    jobDescription,
    analysis.jobTitle,
    analysis.companyName,
    analysis,
    score,
  ],
);

const resume = {
  targetTitle: "Senior Backend Engineer, Payments",
  contact: {
    fullName: devAccount.name,
    email: devAccount.email,
    phone: "+351 912 000 000",
    location: "Lisbon, Portugal",
    website: "https://dana.example",
    linkedin: "https://www.linkedin.com/in/dana-example",
  },
  summary:
    "Backend engineer with nine years building payment and logistics platforms in TypeScript and PostgreSQL. Led a zero-downtime Stripe migration moving €1.2B a year and owns reliability end to end.",
  skills: [
    "TypeScript",
    "PostgreSQL",
    "Stripe",
    "Kafka",
    "AWS",
    "Terraform",
    "Incident response",
  ],
  experiences: [
    {
      experienceId: staff,
      company: "Acme Payments",
      position: "Staff Software Engineer",
      startDate: "2022-03-01",
      endDate: null,
      isCurrent: true,
      bullets: [
        {
          text: "Led migration of card processing to Stripe, moving €1.2B annual volume with zero downtime.",
          sourceExperienceIds: [staff],
        },
        {
          text: "Designed an idempotent TypeScript and PostgreSQL ledger reconciling 2M transactions per day.",
          sourceExperienceIds: [staff],
        },
        {
          text: "Cut checkout p95 latency by 40%, from 820 ms to 490 ms.",
          sourceExperienceIds: [staff],
        },
      ],
    },
    {
      experienceId: lead,
      company: "Northwind Logistics",
      position: "Engineering Lead, Routing",
      startDate: "2017-06-01",
      endDate: "2019-12-20",
      isCurrent: false,
      bullets: [
        {
          text: "Owned on-call for the dispatch platform, reducing incidents from 9 to 2 per month.",
          sourceExperienceIds: [lead],
        },
      ],
    },
  ],
};
const coverLetter = {
  recipient: "Hiring team, Lumen Bank",
  opening:
    "I am applying for the Senior Backend Engineer, Payments role. I have spent the last four years building payment infrastructure that moves real money reliably.",
  bodyParagraphs: [
    {
      text: "At Acme Payments I led the migration of card processing to Stripe, moving €1.2B in annual volume with zero downtime, and designed an idempotent ledger that reconciles two million transactions per day.",
      sourceExperienceIds: [staff],
    },
    {
      text: "Before that I led routing at Northwind Logistics, where I owned on-call for the dispatch platform and brought monthly incidents down from nine to two.",
      sourceExperienceIds: [lead],
    },
  ],
  closing:
    "I would welcome the chance to talk about how I can help Lumen Bank's payments platform.",
};
for (const [table, title, content] of [
  ["resumes", "Senior Backend Engineer, Payments — Lumen Bank", resume],
  ["cover_letters", "Cover letter — Lumen Bank", coverLetter],
]) {
  await client.query(
    `insert into ${table} (user_id, application_id, analysis_id, title, content) values ($1,$2,$3,$4,$5)`,
    [userId, lumen, createdAnalysis.id, title, content],
  );
}

await client.query("commit");
await client.end();
console.log(
  `Seeded ${devAccount.email} with 5 positions, 7 applications, and one tailored application.`,
);
