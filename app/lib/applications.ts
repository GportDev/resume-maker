import { z } from "zod";

export const applicationStatuses = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const salaryPeriods = ["year", "month", "hour"] as const;
export type SalaryPeriod = (typeof salaryPeriods)[number];

export const salaryPeriodLabels: Record<SalaryPeriod, string> = {
  year: "per year",
  month: "per month",
  hour: "per hour",
};

const salaryPeriodSuffix: Record<SalaryPeriod, string> = {
  year: "/yr",
  month: "/mo",
  hour: "/hr",
};

export const applicationSources = ["manual", "linkedin"] as const;
export type ApplicationSource = (typeof applicationSources)[number];

export const commonCurrencies = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "BRL",
  "INR",
  "JPY",
  "CHF",
  "SEK",
  "MXN",
] as const;

export const maxSalaryAmount = 100_000_000;

const salaryAmountSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const cleaned = value.replace(/[,\s_]/g, "");
  return cleaned === "" ? null : Number(cleaned);
}, z
  .number({ error: "Enter a whole number." })
  .int("Enter a whole number.")
  .min(0, "Salary cannot be negative.")
  .max(maxSalaryAmount, "Salary is too large.")
  .nullable());

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2_000)
  .refine(
    (value) => !value || /^https?:\/\//i.test(value),
    "Use an http or https link.",
  )
  .refine(
    (value) => !value || z.url().safeParse(value).success,
    "Enter a valid URL.",
  );

export const applicationInputSchema = z
  .object({
    companyName: z
      .string({ error: "Company name is required." })
      .trim()
      .min(1, "Company name is required.")
      .max(160),
    position: z
      .string({ error: "Position is required." })
      .trim()
      .min(1, "Position is required.")
      .max(160),
    location: z.string().trim().max(160).default(""),
    jobDescription: z.string().trim().max(50_000).default(""),
    salaryMin: salaryAmountSchema,
    salaryMax: salaryAmountSchema,
    salaryCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code.")
      .default("USD"),
    salaryPeriod: z.enum(salaryPeriods).default("year"),
    status: z.enum(applicationStatuses).default("saved"),
    sourceUrl: optionalHttpUrl.default(""),
    notes: z.string().trim().max(10_000).default(""),
    appliedAt: z.union([z.literal(""), z.iso.date()]).default(""),
  })
  .superRefine((value, context) => {
    if (
      value.salaryMin !== null &&
      value.salaryMax !== null &&
      value.salaryMin > value.salaryMax
    ) {
      context.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Maximum salary must be at least the minimum.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    sourceUrl: value.sourceUrl || null,
    appliedAt: value.appliedAt || null,
  }));

export type ApplicationInput = z.output<typeof applicationInputSchema>;

export function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string,
  period: SalaryPeriod,
): string | null {
  if (min === null && max === null) return null;
  const formatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const suffix = salaryPeriodSuffix[period];
  if (min !== null && max !== null) {
    return min === max
      ? `${formatter.format(min)}${suffix}`
      : `${formatter.format(min)}–${formatter.format(max)}${suffix}`;
  }
  if (min !== null) return `From ${formatter.format(min)}${suffix}`;
  return `Up to ${formatter.format(max ?? 0)}${suffix}`;
}

export const sortOrderStep = 1024;
const minSortGap = 1e-6;

export function computeSortOrder(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return sortOrderStep;
  if (before === undefined) return (after ?? 0) - sortOrderStep;
  if (after === undefined) return before + sortOrderStep;
  return (before + after) / 2;
}

export function needsRebalance(before?: number, after?: number): boolean {
  if (before === undefined || after === undefined) return false;
  if (after - before < minSortGap) return true;
  const midpoint = computeSortOrder(before, after);
  return !(midpoint > before && midpoint < after);
}

type Sortable = { id: string; sortOrder: number };

export type MovePlacement = { beforeId?: string; afterId?: string };

export type MovePlan =
  | { kind: "place"; sortOrder: number }
  | { kind: "rebalance"; orders: { id: string; sortOrder: number }[] }
  | { kind: "invalid" };

export function planMove(
  column: Sortable[],
  movingId: string,
  placement: MovePlacement,
): MovePlan {
  const others = column
    .filter((item) => item.id !== movingId)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  let index = others.length;
  if (placement.afterId) {
    index = others.findIndex((item) => item.id === placement.afterId);
    if (index === -1) return { kind: "invalid" };
    if (placement.beforeId && others[index - 1]?.id !== placement.beforeId) {
      return { kind: "invalid" };
    }
  } else if (placement.beforeId) {
    const beforeIndex = others.findIndex(
      (item) => item.id === placement.beforeId,
    );
    if (beforeIndex === -1) return { kind: "invalid" };
    index = beforeIndex + 1;
  }

  const before = others[index - 1]?.sortOrder;
  const after = others[index]?.sortOrder;
  if (!needsRebalance(before, after)) {
    return { kind: "place", sortOrder: computeSortOrder(before, after) };
  }

  const orderedIds = others.map((item) => item.id);
  orderedIds.splice(index, 0, movingId);
  return {
    kind: "rebalance",
    orders: orderedIds.map((id, position) => ({
      id,
      sortOrder: (position + 1) * sortOrderStep,
    })),
  };
}

type BoardCard = { id: string; status: ApplicationStatus; sortOrder: number };

export type BoardColumns<Card extends BoardCard> = Record<
  ApplicationStatus,
  Card[]
>;

export function groupApplicationsByStatus<Card extends BoardCard>(
  cards: Card[],
): BoardColumns<Card> {
  const columns = Object.fromEntries(
    applicationStatuses.map((status) => [status, [] as Card[]]),
  ) as BoardColumns<Card>;
  for (const card of cards) columns[card.status].push(card);
  for (const status of applicationStatuses) {
    columns[status].sort((left, right) => left.sortOrder - right.sortOrder);
  }
  return columns;
}

export type PendingMove = {
  id: string;
  status: ApplicationStatus;
} & MovePlacement;

export function applyPendingMove<Card extends BoardCard>(
  columns: BoardColumns<Card>,
  move: PendingMove,
): BoardColumns<Card> {
  const card = applicationStatuses
    .flatMap((status) => columns[status])
    .find((item) => item.id === move.id);
  if (!card) return columns;

  const next = Object.fromEntries(
    applicationStatuses.map((status) => [
      status,
      columns[status].filter((item) => item.id !== move.id),
    ]),
  ) as BoardColumns<Card>;
  const target = next[move.status];
  let index = target.length;
  const afterIndex = move.afterId
    ? target.findIndex((item) => item.id === move.afterId)
    : -1;
  const beforeIndex = move.beforeId
    ? target.findIndex((item) => item.id === move.beforeId)
    : -1;
  if (afterIndex !== -1) index = afterIndex;
  else if (beforeIndex !== -1) index = beforeIndex + 1;
  target.splice(index, 0, { ...card, status: move.status });
  return next;
}

export type ApplicationCardData = BoardCard & {
  companyName: string;
  position: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  source: ApplicationSource;
};

const optionalId = z
  .union([z.literal(""), z.uuid()])
  .optional()
  .transform((value) => value || undefined);

export const moveInputSchema = z.object({
  id: z.uuid(),
  status: z.enum(applicationStatuses),
  beforeId: optionalId,
  afterId: optionalId,
});

export function parseMoveFormData(formData: FormData): PendingMove | null {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const parsed = moveInputSchema.safeParse({
    id: field("id"),
    status: field("status"),
    beforeId: field("beforeId"),
    afterId: field("afterId"),
  });
  return parsed.success ? parsed.data : null;
}

export function parseApplicationStatus(
  value: unknown,
): ApplicationStatus | null {
  const parsed = z.enum(applicationStatuses).safeParse(value);
  return parsed.success ? parsed.data : null;
}
