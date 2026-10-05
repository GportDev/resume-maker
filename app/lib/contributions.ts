import type { companies, experiences } from "../db/schema";

export type CompanyRecord = typeof companies.$inferSelect;
export type ExperienceWithCompany = typeof experiences.$inferSelect & {
  company: string;
};

type GroupableCompany = { id: string; name: string; sortOrder: number };
type GroupableExperience = {
  companyId: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
};

export type CompanyFolder<
  Company extends GroupableCompany,
  Experience extends GroupableExperience,
> = {
  company: Company;
  positions: Experience[];
  hasCurrentRole: boolean;
  latestDate: string | null;
};

function latestDateOf(experience: GroupableExperience): string {
  return experience.endDate ?? experience.startDate;
}

function compareDesc(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

export function groupExperiencesByCompany<
  Company extends GroupableCompany,
  Experience extends GroupableExperience,
>(
  experienceList: Experience[],
  companyList: Company[],
): CompanyFolder<Company, Experience>[] {
  const folders = companyList.map((company) => {
    const positions = experienceList
      .filter((experience) => experience.companyId === company.id)
      .sort((left, right) => {
        if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
        return compareDesc(left.startDate, right.startDate);
      });
    const latestDate = positions.reduce<string | null>((latest, position) => {
      const candidate = latestDateOf(position);
      return !latest || candidate > latest ? candidate : latest;
    }, null);
    return {
      company,
      positions,
      hasCurrentRole: positions.some((position) => position.isCurrent),
      latestDate,
    };
  });

  return folders.sort((left, right) => {
    if (left.hasCurrentRole !== right.hasCurrentRole) {
      return left.hasCurrentRole ? -1 : 1;
    }
    if (left.latestDate !== right.latestDate) {
      if (!left.latestDate) return 1;
      if (!right.latestDate) return -1;
      return compareDesc(left.latestDate, right.latestDate);
    }
    if (left.company.sortOrder !== right.company.sortOrder) {
      return left.company.sortOrder - right.company.sortOrder;
    }
    return left.company.name.localeCompare(right.company.name);
  });
}

export function contributionTemplate(): string {
  return [
    "## Context",
    "",
    "- Team, product, and scope:",
    "",
    "## Contributions",
    "",
    "- ",
    "",
    "## Outcomes and metrics",
    "",
    "- ",
    "",
    "## Tools",
    "",
    "- ",
    "",
  ].join("\n");
}

export type ImportMode = "append" | "replace";

export function mergeImportedMarkdown(
  current: string,
  imported: string[],
  mode: ImportMode,
): string {
  const incoming = imported
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n\n");
  if (mode === "replace" || !current.trim()) return incoming;
  if (!incoming) return current;
  return `${current.trimEnd()}\n\n${incoming}`;
}

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonth(value: string): string {
  return monthFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function formatRoleDates(experience: {
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}): string {
  const end = experience.isCurrent
    ? "Present"
    : experience.endDate
      ? formatMonth(experience.endDate)
      : "";
  return `${formatMonth(experience.startDate)} – ${end}`.trim();
}

export function markdownFileName(company: string, position: string): string {
  const slug = `${company}-${position}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "experience"}.md`;
}
