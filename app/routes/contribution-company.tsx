import { data, Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { Button, ButtonLink } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { describedBy, Field, fieldClass } from "../components/ui/field";
import { useToast } from "../components/ui/toast";
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
    website: formData.get("website") ?? undefined,
    location: formData.get("location") ?? undefined,
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

  useToast(saved ? "Company saved." : null, actionData);

  return (
    <section className="rounded-sheet bg-sheet p-6 shadow-sheet sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-5">
        <div>
          <h2 className="text-[1.375rem] font-bold tracking-[-0.01em]">
            {company ? company.name : "New company"}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {company
              ? `${positionCount} ${positionCount === 1 ? "position" : "positions"} filed under this company.`
              : "Positions are grouped under their company."}
          </p>
        </div>
        {company ? (
          <ButtonLink to={`/contributions/new?companyId=${company.id}`}>
            New position here
          </ButtonLink>
        ) : null}
      </div>
      <Form
        key={company?.id ?? "new"}
        method="post"
        className="mt-6 grid max-w-2xl gap-5 sm:grid-cols-2"
      >
        {fields.map((field) => (
          <Field
            key={field.name}
            id={`company-${field.name}`}
            label={field.label}
            error={errors[field.name]}
            className={field.name === "name" ? "sm:col-span-2" : undefined}
          >
            <input
              id={`company-${field.name}`}
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={field.value}
              required={field.name === "name"}
              aria-invalid={errors[field.name] ? true : undefined}
              aria-describedby={describedBy(
                `company-${field.name}`,
                errors[field.name],
              )}
              className={fieldClass}
            />
          </Field>
        ))}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button
            type="submit"
            name="intent"
            value="save"
            variant="primary"
            pending={isSaving}
          >
            {company ? "Save company" : "Create company"}
          </Button>
        </div>
      </Form>

      {company ? (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
          {positionCount > 0 ? (
            <p className="text-sm text-ink-3">
              To delete this company, first delete or move its{" "}
              {positionCount === 1 ? "position" : `${positionCount} positions`}.
            </p>
          ) : (
            <ConfirmDialog
              triggerLabel="Delete company"
              title={`Delete ${company.name}?`}
              description="The company has no positions. Deleting it cannot be undone."
              confirmLabel="Delete company"
              fields={{ intent: "delete" }}
              error={errors.delete}
            />
          )}
          {errors.delete && positionCount > 0 ? (
            <p role="alert" className="text-sm text-danger">
              {errors.delete}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
