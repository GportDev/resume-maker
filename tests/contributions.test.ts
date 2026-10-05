import { describe, expect, it } from "vitest";

import {
  contributionTemplate,
  formatRoleDates,
  groupExperiencesByCompany,
  markdownFileName,
  mergeImportedMarkdown,
} from "../app/lib/contributions";

function company(id: string, name: string, sortOrder = 0) {
  return { id, name, sortOrder };
}

function position(
  id: string,
  companyId: string,
  startDate: string,
  endDate: string | null,
  isCurrent = false,
) {
  return { id, companyId, startDate, endDate, isCurrent };
}

describe("groupExperiencesByCompany", () => {
  const companyList = [
    company("acme", "Acme"),
    company("globex", "Globex"),
    company("initech", "Initech"),
    company("empty", "Empty Co"),
  ];
  const experienceList = [
    position("acme-junior", "acme", "2016-01-01", "2018-06-01"),
    position("acme-senior", "acme", "2018-06-01", "2020-01-01"),
    position("globex-lead", "globex", "2023-02-01", null, true),
    position("globex-ic", "globex", "2021-01-01", "2023-02-01"),
    position("initech-dev", "initech", "2020-02-01", "2021-01-01"),
  ];

  it("puts companies with a current role first, then most recent", () => {
    const folders = groupExperiencesByCompany(experienceList, companyList);
    expect(folders.map((folder) => folder.company.id)).toEqual([
      "globex",
      "initech",
      "acme",
      "empty",
    ]);
  });

  it("orders positions current first, then newest start date", () => {
    const folders = groupExperiencesByCompany(experienceList, companyList);
    const byId = new Map(folders.map((folder) => [folder.company.id, folder]));
    expect(byId.get("globex")?.positions.map((item) => item.id)).toEqual([
      "globex-lead",
      "globex-ic",
    ]);
    expect(byId.get("acme")?.positions.map((item) => item.id)).toEqual([
      "acme-senior",
      "acme-junior",
    ]);
  });

  it("reports current-role and latest-date metadata", () => {
    const folders = groupExperiencesByCompany(experienceList, companyList);
    const byId = new Map(folders.map((folder) => [folder.company.id, folder]));
    expect(byId.get("globex")?.hasCurrentRole).toBe(true);
    expect(byId.get("acme")).toMatchObject({
      hasCurrentRole: false,
      latestDate: "2020-01-01",
    });
    expect(byId.get("empty")).toMatchObject({
      positions: [],
      hasCurrentRole: false,
      latestDate: null,
    });
  });

  it("breaks ties by sort order, then name", () => {
    const folders = groupExperiencesByCompany(
      [],
      [
        company("b", "Beta", 1),
        company("z", "Zeta", 0),
        company("a", "Alpha", 1),
      ],
    );
    expect(folders.map((folder) => folder.company.name)).toEqual([
      "Zeta",
      "Alpha",
      "Beta",
    ]);
  });

  it("ignores positions whose company is not in the list", () => {
    const folders = groupExperiencesByCompany(
      [position("orphan", "missing", "2020-01-01", "2021-01-01")],
      [company("acme", "Acme")],
    );
    expect(folders).toHaveLength(1);
    expect(folders[0]?.positions).toEqual([]);
  });

  it("does not mutate the input lists", () => {
    const companies = [company("b", "Beta"), company("a", "Alpha")];
    const positions = [
      position("old", "a", "2010-01-01", "2011-01-01"),
      position("new", "a", "2012-01-01", "2013-01-01"),
    ];
    groupExperiencesByCompany(positions, companies);
    expect(companies.map((item) => item.id)).toEqual(["b", "a"]);
    expect(positions.map((item) => item.id)).toEqual(["old", "new"]);
  });
});

describe("contributionTemplate", () => {
  it("contains the evidence sections", () => {
    const template = contributionTemplate();
    for (const heading of [
      "## Context",
      "## Contributions",
      "## Outcomes and metrics",
      "## Tools",
    ]) {
      expect(template).toContain(heading);
    }
  });
});

describe("mergeImportedMarkdown", () => {
  it("appends imported files after current text", () => {
    expect(
      mergeImportedMarkdown(
        "## Existing\n\n",
        ["# One\n", "\n# Two"],
        "append",
      ),
    ).toBe("## Existing\n\n# One\n\n# Two");
  });

  it("replaces current text", () => {
    expect(mergeImportedMarkdown("old", ["# New"], "replace")).toBe("# New");
  });

  it("uses imports directly when current text is blank", () => {
    expect(mergeImportedMarkdown("  \n", ["# New"], "append")).toBe("# New");
  });

  it("keeps current text when imports are blank", () => {
    expect(mergeImportedMarkdown("keep", ["  ", ""], "append")).toBe("keep");
  });
});

describe("markdownFileName", () => {
  it("slugs company and position", () => {
    expect(markdownFileName("Acme, Inc.", "Senior Engineer")).toBe(
      "acme-inc-senior-engineer.md",
    );
  });

  it("falls back when nothing is sluggable", () => {
    expect(markdownFileName("日本", "—")).toBe("experience.md");
  });
});

describe("formatRoleDates", () => {
  it("formats a past role", () => {
    expect(
      formatRoleDates({
        startDate: "2020-03-01",
        endDate: "2022-11-30",
        isCurrent: false,
      }),
    ).toBe("Mar 2020 – Nov 2022");
  });

  it("formats a current role", () => {
    expect(
      formatRoleDates({
        startDate: "2023-01-15",
        endDate: null,
        isCurrent: true,
      }),
    ).toBe("Jan 2023 – Present");
  });
});
