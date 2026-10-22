import { useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { Button, ButtonLink } from "../components/ui/button";
import { describedBy, Field, fieldClass } from "../components/ui/field";
import { PageHeader, Sheet, SheetSection } from "../components/ui/sheet";
import { useToast } from "../components/ui/toast";
import { requireUser } from "../lib/auth.server";
import {
  getProfile,
  listCompanies,
  listExperiences,
  saveProfile,
} from "../lib/repositories.server";
import { firstFormError, profileInputSchema } from "../lib/validation";
import type { Route } from "./+types/profile";

export function meta() {
  return [{ title: "Profile | Resume Fit" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [profile, companyList, experienceList] = await Promise.all([
    getProfile(user.id),
    listCompanies(user.id),
    listExperiences(user.id),
  ]);
  return {
    profile,
    account: user,
    companyCount: companyList.length,
    positionCount: experienceList.length,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const parsed = profileInputSchema.safeParse({
    fullName: formData.get("fullName"),
    headline: formData.get("headline"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    location: formData.get("location"),
    website: formData.get("website"),
    linkedin: formData.get("linkedin"),
  });
  if (!parsed.success) {
    return data({ errors: firstFormError(parsed.error) }, { status: 400 });
  }
  await saveProfile(user.id, parsed.data);
  return data({ saved: true });
}

export default function Profile({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { profile, account, companyCount, positionCount } = loaderData;
  const errors: Record<string, string> =
    actionData && "errors" in actionData ? actionData.errors : {};
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  useToast(
    actionData && "saved" in actionData ? "Profile saved." : null,
    actionData,
  );

  const fields: {
    name: string;
    label: string;
    value: string;
    type: string;
    autoComplete: string;
    hint?: string;
  }[] = [
    {
      name: "fullName",
      label: "Full name",
      value: profile?.fullName ?? account.name,
      type: "text",
      autoComplete: "name",
    },
    {
      name: "headline",
      label: "Headline",
      value: profile?.headline ?? "",
      type: "text",
      autoComplete: "off",
      hint: "One line under your name, like “Staff engineer, payments and platform”. Tailoring may replace it per job.",
    },
    {
      name: "email",
      label: "Resume email",
      value: profile?.email ?? account.email,
      type: "email",
      autoComplete: "email",
    },
    {
      name: "phone",
      label: "Phone",
      value: profile?.phone ?? "",
      type: "tel",
      autoComplete: "tel",
    },
    {
      name: "location",
      label: "Location",
      value: profile?.location ?? "",
      type: "text",
      autoComplete: "address-level2",
      hint: "City and country is enough.",
    },
    {
      name: "website",
      label: "Website",
      value: profile?.website ?? "",
      type: "url",
      autoComplete: "url",
      hint: "Full address, starting with https://",
    },
    {
      name: "linkedin",
      label: "LinkedIn",
      value: profile?.linkedin ?? "",
      type: "url",
      autoComplete: "url",
      hint: "Your public profile URL.",
    },
  ];
  const [preview, setPreview] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, field.value])),
  );

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 pb-10 sm:px-6">
      <Sheet className="rounded-t-none">
        <PageHeader
          title="Profile"
          meta="Contact details printed at the top of every resume and cover letter."
        />
        <SheetSection title="Contact details" id="contact-heading">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Form
              method="post"
              onChange={(event) =>
                setPreview(
                  Object.fromEntries(
                    [...new FormData(event.currentTarget)].map(
                      ([key, value]) => [key, String(value)],
                    ),
                  ),
                )
              }
              className="grid max-w-3xl gap-5 sm:grid-cols-2"
            >
              {fields.map(
                ({
                  name,
                  label,
                  value: defaultValue,
                  type,
                  autoComplete,
                  hint,
                }) => (
                  <Field
                    key={name}
                    id={name}
                    label={label}
                    error={errors[name]}
                    hint={hint}
                    className={
                      name === "headline" ? "sm:col-span-2" : undefined
                    }
                  >
                    <input
                      id={name}
                      name={name}
                      type={type}
                      autoComplete={autoComplete}
                      defaultValue={defaultValue}
                      required={name === "fullName"}
                      aria-invalid={errors[name] ? true : undefined}
                      aria-describedby={describedBy(
                        name,
                        errors[name],
                        Boolean(hint),
                      )}
                      className={fieldClass}
                    />
                  </Field>
                ),
              )}
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" variant="primary" pending={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </Form>
            <section aria-label="Resume header preview" className="xl:pt-1">
              <p className="mb-2 text-[0.8125rem] text-ink-3">
                Resume header preview
              </p>
              <div className="bg-white px-6 py-5 text-[#111] shadow-sheet">
                <p className="text-[22px] leading-tight font-bold">
                  {preview.fullName || "Your name"}
                </p>
                {preview.headline ? (
                  <p className="mt-0.5 text-[13px]">{preview.headline}</p>
                ) : null}
                <p className="mt-1.5 text-[11px] break-words text-[#444]">
                  {[
                    preview.email,
                    preview.phone,
                    preview.location,
                    preview.website,
                    preview.linkedin,
                  ]
                    .filter(Boolean)
                    .join(" | ") || "Contact details appear here."}
                </p>
              </div>
            </section>
          </div>
        </SheetSection>
        <SheetSection
          title="Work experience"
          description={
            positionCount
              ? `${positionCount} ${positionCount === 1 ? "position" : "positions"} across ${companyCount} ${companyCount === 1 ? "company" : "companies"}.`
              : "No positions yet. Contribution files hold the evidence used for tailoring."
          }
          actions={
            <ButtonLink
              to={positionCount ? "/contributions" : "/contributions/new"}
              variant="secondary"
            >
              {positionCount ? "Open contributions" : "Add first position"}
            </ButtonLink>
          }
        >
          {null}
        </SheetSection>
      </Sheet>
    </main>
  );
}
