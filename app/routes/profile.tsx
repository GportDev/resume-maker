import { data, Form, Link, redirect } from "react-router";
import { requireUser } from "../lib/auth.server";
import {
  deleteExperience,
  getProfile,
  listExperiences,
  saveProfile,
} from "../lib/repositories.server";
import { firstFormError, profileInputSchema } from "../lib/validation";
import type { Route } from "./+types/profile";

export function meta() {
  return [{ title: "Profile and experience | Resume Fit" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [profile, experienceList] = await Promise.all([
    getProfile(user.id),
    listExperiences(user.id),
  ]);
  return { profile, experienceList, account: user };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save-profile");

  if (intent === "delete-experience") {
    const experienceId = String(formData.get("experienceId") ?? "");
    const deleted = await deleteExperience(user.id, experienceId);
    if (!deleted) {
      return data(
        { errors: { form: "Experience not found." } },
        { status: 404 },
      );
    }
    return redirect("/profile");
  }

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

function formatDate(value: string | null, current: boolean): string {
  if (current) return "Present";
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function Profile({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { profile, experienceList, account } = loaderData;
  const errors: Record<string, string> =
    actionData && "errors" in actionData ? actionData.errors : {};

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Evidence library
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Profile and experience
          </h1>
        </div>
        <Link
          to="/profile/experiences/new"
          className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Add experience
        </Link>
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

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Work experience</h2>
        {experienceList.length ? (
          <div className="mt-4 grid gap-4">
            {experienceList.map((experience) => (
              <article
                key={experience.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{experience.position}</h3>
                    <p className="text-slate-400">{experience.company}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(experience.startDate, false)} –{" "}
                      {formatDate(experience.endDate, experience.isCurrent)}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Link
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400"
                      to={`/profile/experiences/${experience.id}`}
                    >
                      Edit
                    </Link>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="experienceId"
                        value={experience.id}
                      />
                      <button
                        type="submit"
                        name="intent"
                        value="delete-experience"
                        className="rounded-lg border border-red-950 px-3 py-2 text-sm text-red-300 hover:border-red-700"
                      >
                        Delete
                      </button>
                    </Form>
                  </div>
                </div>
                <p className="mt-4 line-clamp-2 whitespace-pre-wrap text-sm text-slate-400">
                  {experience.markdown}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-700 p-10 text-center">
            <p className="font-medium">No experience added yet.</p>
            <p className="mt-2 text-sm text-slate-500">
              Add concrete projects, outcomes, tools, and scope.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
