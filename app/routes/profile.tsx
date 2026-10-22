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

  const fields = [
    [
      "fullName",
      "Full name",
      profile?.fullName ?? account.name,
      "text",
      "name",
    ],
    ["headline", "Headline", profile?.headline ?? "", "text", "off"],
    [
      "email",
      "Resume email",
      profile?.email ?? account.email,
      "email",
      "email",
    ],
    ["phone", "Phone", profile?.phone ?? "", "tel", "tel"],
    ["location", "Location", profile?.location ?? "", "text", "address-level2"],
    ["website", "Website", profile?.website ?? "", "url", "url"],
    ["linkedin", "LinkedIn", profile?.linkedin ?? "", "url", "url"],
  ] as const;

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 pb-10 sm:px-6">
      <Sheet className="rounded-t-none">
        <PageHeader
          title="Profile"
          meta="Contact details printed at the top of every resume and cover letter."
        />
        <SheetSection title="Contact details" id="contact-heading">
          <Form method="post" className="grid max-w-3xl gap-5 sm:grid-cols-2">
            {fields.map(([name, label, defaultValue, type, autoComplete]) => (
              <Field key={name} id={name} label={label} error={errors[name]}>
                <input
                  id={name}
                  name={name}
                  type={type}
                  autoComplete={autoComplete}
                  defaultValue={defaultValue}
                  required={name === "fullName"}
                  aria-invalid={errors[name] ? true : undefined}
                  aria-describedby={describedBy(name, errors[name])}
                  className={fieldClass}
                />
              </Field>
            ))}
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" variant="primary" pending={saving}>
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </Form>
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
