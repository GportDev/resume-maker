import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { requireUser } from "../lib/auth.server";
import {
  countCompanyExperiences,
  createCompany,
  deleteCompany,
  getCompany,
  updateCompany,
} from "../lib/repositories.server";
import { companyInputSchema, firstFormError } from "../lib/validation";
import type { Route } from "./+types/contribution-company";

const duplicateMessage = "You already have a company with this name.";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData?.company ? loaderData.company.name : "New company"} | Resume Fit`,
    },
  ];
}

function requireCompanyId(companyId: string): string {
  if (!z.uuid().safeParse(companyId).success) {
    throw new Response("Company not found.", { status: 404 });
  }
  return companyId;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  if (params.companyId === "new") {
    return { company: null, positionCount: 0 };
  }
  const companyId = requireCompanyId(params.companyId);
  const [company, positionCount] = await Promise.all([
    getCompany(user.id, companyId),
    countCompanyExperiences(user.id, companyId),
  ]);
  if (!company) throw new Response("Company not found.", { status: 404 });
  return { company, positionCount };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");
  const isNew = params.companyId === "new";

  if (intent === "delete") {
    if (isNew) throw new Response("Company not found.", { status: 404 });
    if (formData.get("confirm") !== "yes") {
      return data(
        { errors: { delete: "Confirm that you want to delete this company." } },
        { status: 400 },
      );
    }
    const result = await deleteCompany(
      user.id,
      requireCompanyId(params.companyId),
    );
    if (result === "not-found") {
      throw new Response("Company not found.", { status: 404 });
    }
    if (result === "has-positions") {
      return data(
        {
          errors: {
            delete:
              "Move or delete this company's positions before deleting it.",
          },
        },
        { status: 409 },
      );
    }
    return redirect("/contributions");
  }

  const parsed = companyInputSchema.safeParse({
    name: formData.get("name"),
    website: formData.get("website"),
    location: formData.get("location"),
  });
  if (!parsed.success) {
    return data({ errors: firstFormError(parsed.error) }, { status: 400 });
  }

  if (isNew) {
    const created = await createCompany(user.id, parsed.data);
    if ("error" in created) {
      return data({ errors: { name: duplicateMessage } }, { status: 409 });
    }
    return redirect(`/contributions/companies/${created.company.id}`);
  }

  const updated = await updateCompany(
    user.id,
    requireCompanyId(params.companyId),
    parsed.data,
  );
  if ("error" in updated) {
    if (updated.error === "not-found") {
      throw new Response("Company not found.", { status: 404 });
    }
    return data({ errors: { name: duplicateMessage } }, { status: 409 });
  }
  return data({ saved: true as const });
}

export default function ContributionCompany({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { company, positionCount } = loaderData;
  const errors: Record<string, string> =
    actionData && "errors" in actionData ? actionData.errors : {};
  const saved = Boolean(actionData && "saved" in actionData);
  const navigation = useNavigation();
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save";

  const fields = [
    { name: "name", label: "Company name", value: company?.name ?? "" },
    { name: "location", label: "Location", value: company?.location ?? "" },
    {
      name: "website",
      label: "Website",
      value: company?.website ?? "",
      type: "url",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">
          {company ? `Edit ${company.name}` : "New company"}
        </h2>
        <Form
          key={company?.id ?? "new"}
          method="post"
          className="mt-6 grid gap-5 sm:grid-cols-2"
        >
          {fields.map((field) => (
            <div
              key={field.name}
              className={field.name === "name" ? "sm:col-span-2" : undefined}
            >
              <label
                htmlFor={`company-${field.name}`}
                className="block text-sm font-medium"
              >
                {field.label}
              </label>
              <input
                id={`company-${field.name}`}
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={field.value}
                required={field.name === "name"}
                aria-invalid={errors[field.name] ? true : undefined}
                aria-describedby={
                  errors[field.name] ? `company-${field.name}-error` : undefined
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              />
              {errors[field.name] ? (
                <p
                  id={`company-${field.name}-error`}
                  className="mt-1 text-xs text-red-300"
                >
                  {errors[field.name]}
                </p>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={isSaving}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            >
              {isSaving
                ? "Saving…"
                : company
                  ? "Save company"
                  : "Create company"}
            </button>
            {company ? (
              <Link
                to={`/contributions/new?companyId=${company.id}`}
                className="rounded-xl border border-slate-700 px-4 py-3 hover:border-cyan-400"
              >
                New position at {company.name}
              </Link>
            ) : null}
            <span role="status" className="text-sm text-emerald-300">
              {saved ? "Company saved." : ""}
            </span>
          </div>
        </Form>
      </section>

      {company ? (
        <section className="rounded-2xl border border-red-950 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Delete company</h2>
          {positionCount > 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              This company has {positionCount}{" "}
              {positionCount === 1 ? "position" : "positions"}. Delete or move
              them to another company before deleting it.
            </p>
          ) : (
            <Form method="post" className="mt-3 space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="confirm"
                  value="yes"
                  required
                  className="size-4 accent-red-400"
                />
                I understand this permanently deletes {company.name}.
              </label>
              <button
                type="submit"
                name="intent"
                value="delete"
                className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:border-red-600"
              >
                Delete company
              </button>
            </Form>
          )}
          {errors.delete ? (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {errors.delete}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
