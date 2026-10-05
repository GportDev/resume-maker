import { data, Form, Link } from "react-router";
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Resume header
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Profile</h1>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">Contact details</h2>
        <Form method="post" className="mt-6 grid gap-5 sm:grid-cols-2">
          {[
            [
              "fullName",
              "Full name",
              profile?.fullName ?? account.name,
              "text",
            ],
            ["headline", "Headline", profile?.headline ?? "", "text"],
            ["email", "Resume email", profile?.email ?? account.email, "email"],
            ["phone", "Phone", profile?.phone ?? "", "tel"],
            ["location", "Location", profile?.location ?? "", "text"],
            ["website", "Website", profile?.website ?? "", "url"],
            ["linkedin", "LinkedIn", profile?.linkedin ?? "", "url"],
          ].map(([name, label, defaultValue, type]) => (
            <label key={name} className="block text-sm font-medium">
              {label}
              <input
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                name={name}
                type={type}
                defaultValue={defaultValue}
                required={name === "fullName"}
              />
              {errors?.[name] ? (
                <span className="mt-1 block text-xs text-red-300">
                  {errors[name]}
                </span>
              ) : null}
            </label>
          ))}
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              className="rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-950 hover:bg-white"
              type="submit"
            >
              Save profile
            </button>
            {actionData && "saved" in actionData ? (
              <span className="text-sm text-emerald-300" role="status">
                Profile saved.
              </span>
            ) : null}
          </div>
        </Form>
      </section>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <h2 className="text-xl font-semibold">Work experience</h2>
          <p className="mt-2 text-sm text-slate-400">
            {positionCount
              ? `${positionCount} ${positionCount === 1 ? "position" : "positions"} across ${companyCount} ${companyCount === 1 ? "company" : "companies"}.`
              : "No positions yet. Contribution files hold the evidence used for tailoring."}
          </p>
        </div>
        <Link
          to={positionCount ? "/contributions" : "/contributions/new"}
          className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          {positionCount ? "Open contributions" : "Add first position"}
        </Link>
      </section>
    </main>
  );
}
