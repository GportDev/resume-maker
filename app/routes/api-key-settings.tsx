import { data, Form, useNavigation } from "react-router";
import { z } from "zod";
import { testOpenAiKey } from "../lib/ai.server";
import { requireUser } from "../lib/auth.server";
import { encryptUserApiKey, maskCredential } from "../lib/credentials.server";
import {
  deleteUserApiCredential,
  getUserApiCredential,
  saveUserApiCredential,
} from "../lib/repositories.server";
import type { Route } from "./+types/api-key-settings";

const apiKeySchema = z.string().trim().min(20).max(300);

export function meta() {
  return [{ title: "API key settings | Resume Fit" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const credential = await getUserApiCredential(user.id);
  return {
    credential: credential
      ? {
          masked: maskCredential(credential.lastFour),
          testedAt: credential.testedAt,
        }
      : null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");

  if (intent === "revoke") {
    await deleteUserApiCredential(user.id);
    return data({ success: "Personal API key removed." });
  }

  const parsed = apiKeySchema.safeParse(formData.get("apiKey"));
  if (!parsed.success) {
    return data({ error: "Enter a valid OpenAI API key." }, { status: 400 });
  }

  try {
    await testOpenAiKey(parsed.data);
    await saveUserApiCredential(user.id, encryptUserApiKey(parsed.data));
    return data({ success: "API key tested and saved." });
  } catch {
    return data(
      { error: "OpenAI rejected this key. Check the key and account access." },
      { status: 400 },
    );
  }
}

export default function ApiKeySettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
        Bring your own key
      </p>
      <h1 className="mt-2 text-3xl font-semibold">OpenAI API key</h1>
      <p className="mt-3 text-slate-400">
        Your key is encrypted before storage and used only for your requests. It
        is never shown again after saving.
      </p>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        {loaderData.credential ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-950 bg-emerald-950/30 p-4">
            <div>
              <p className="text-sm text-emerald-300">Personal key active</p>
              <p className="mt-1 font-mono">{loaderData.credential.masked}</p>
            </div>
            <Form method="post">
              <button
                type="submit"
                name="intent"
                value="revoke"
                className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:border-red-700"
              >
                Revoke key
              </button>
            </Form>
          </div>
        ) : (
          <p className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            No personal key saved. Platform key will be used when available.
          </p>
        )}

        <Form method="post" className="space-y-4">
          <label className="block text-sm font-medium">
            {loaderData.credential ? "Replace API key" : "API key"}
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono outline-none focus:border-cyan-400"
              placeholder="sk-..."
            />
          </label>
          {actionData && "error" in actionData ? (
            <p role="alert" className="text-sm text-red-300">
              {actionData.error}
            </p>
          ) : null}
          {actionData && "success" in actionData ? (
            <p role="status" className="text-sm text-emerald-300">
              {actionData.success}
            </p>
          ) : null}
          <button
            disabled={isSaving}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
            type="submit"
          >
            {isSaving ? "Testing…" : "Test and save"}
          </button>
        </Form>
      </section>
    </main>
  );
}
