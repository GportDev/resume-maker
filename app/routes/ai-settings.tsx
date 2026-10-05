import { useEffect, useRef } from "react";
import { data, Form, useNavigation } from "react-router";
import { z } from "zod";
import {
  getPreferredAiProvider,
  logProviderError,
  testProviderKey,
} from "../lib/ai-provider.server";
import {
  type AiProvider,
  aiProviderDetails,
  aiProviderSchema,
  aiProviders,
} from "../lib/ai-providers";
import { requireUser } from "../lib/auth.server";
import { encryptUserApiKey, maskCredential } from "../lib/credentials.server";
import { getServerEnv } from "../lib/env.server";
import {
  deleteUserApiCredential,
  listUserApiCredentials,
  saveUserApiCredential,
  saveUserSettings,
} from "../lib/repositories.server";
import type { Route } from "./+types/ai-settings";

const settingsActionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("set-provider"), provider: aiProviderSchema }),
  z.object({
    intent: z.literal("save-key"),
    provider: aiProviderSchema,
    apiKey: z.string().trim().min(20).max(300),
  }),
  z.object({ intent: z.literal("revoke-key"), provider: aiProviderSchema }),
]);

type ActionScope = AiProvider | "preference";

export function meta() {
  return [{ title: "AI settings | Resume Fit" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [preferredProvider, credentials] = await Promise.all([
    getPreferredAiProvider(user.id),
    listUserApiCredentials(user.id),
  ]);
  const env = getServerEnv();
  const platformKeys: Record<AiProvider, boolean> = {
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
  };

  return {
    preferredProvider,
    providers: aiProviders.map((provider) => {
      const credential = credentials.find((item) => item.provider === provider);
      return {
        provider,
        hasPlatformKey: platformKeys[provider],
        credential: credential
          ? {
              masked: maskCredential(credential.lastFour),
              testedAt: credential.testedAt,
            }
          : null,
      };
    }),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const parsed = settingsActionSchema.safeParse({
    intent: formData.get("intent"),
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey") ?? undefined,
  });

  if (!parsed.success) {
    const provider = aiProviderSchema.safeParse(formData.get("provider"));
    const scope: ActionScope = provider.success ? provider.data : "preference";
    return data(
      {
        scope,
        error:
          scope === "preference"
            ? "Choose a supported provider."
            : `Enter a valid ${aiProviderDetails[scope].label} API key.`,
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const label = aiProviderDetails[input.provider].label;

  if (input.intent === "set-provider") {
    await saveUserSettings(user.id, { aiProvider: input.provider });
    return data({
      scope: "preference" as ActionScope,
      success: `${label} is now your AI provider.`,
    });
  }

  if (input.intent === "revoke-key") {
    await deleteUserApiCredential(user.id, input.provider);
    return data({
      scope: input.provider as ActionScope,
      success: `Personal ${label} key removed.`,
    });
  }

  try {
    await testProviderKey(input.provider, input.apiKey);
  } catch (error) {
    logProviderError("test-key", input.provider, error);
    return data(
      {
        scope: input.provider as ActionScope,
        error: `${label} rejected this key. Check the key and account access.`,
      },
      { status: 400 },
    );
  }
  await saveUserApiCredential(
    user.id,
    input.provider,
    encryptUserApiKey(input.apiKey),
  );
  return data({
    scope: input.provider as ActionScope,
    success: `${label} key tested and saved.`,
  });
}

function ActionMessage({
  actionData,
  scope,
}: {
  actionData: Route.ComponentProps["actionData"];
  scope: ActionScope;
}) {
  if (!actionData || actionData.scope !== scope) return null;
  if ("error" in actionData) {
    return (
      <p role="alert" className="text-sm text-red-300">
        {actionData.error}
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-emerald-300">
      {actionData.success}
    </p>
  );
}

function ProviderKeyCard({
  item,
  isPreferred,
  actionData,
}: {
  item: Route.ComponentProps["loaderData"]["providers"][number];
  isPreferred: boolean;
  actionData: Route.ComponentProps["actionData"];
}) {
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const details = aiProviderDetails[item.provider];
  const isSubmittingHere =
    navigation.state === "submitting" &&
    navigation.formData?.get("provider") === item.provider &&
    navigation.formData?.get("intent") === "save-key";
  const savedHere =
    actionData?.scope === item.provider && "success" in actionData;

  useEffect(() => {
    if (savedHere) formRef.current?.reset();
  }, [savedHere]);

  return (
    <section
      aria-labelledby={`${item.provider}-heading`}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${item.provider}-heading`} className="text-xl font-semibold">
          {details.label}
        </h2>
        {isPreferred ? (
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs text-cyan-300">
            In use
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        {item.credential ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-950 bg-emerald-950/30 p-4">
            <div>
              <p className="text-sm text-emerald-300">Personal key active</p>
              <p className="mt-1 font-mono">{item.credential.masked}</p>
            </div>
            <Form method="post">
              <input type="hidden" name="provider" value={item.provider} />
              <button
                type="submit"
                name="intent"
                value="revoke-key"
                className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:border-red-700"
              >
                Revoke key
              </button>
            </Form>
          </div>
        ) : (
          <p className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            {item.hasPlatformKey
              ? "No personal key saved. Platform key will be used."
              : "No personal key saved and no platform key configured."}
          </p>
        )}

        <Form ref={formRef} method="post" className="space-y-4">
          <input type="hidden" name="provider" value={item.provider} />
          <label className="block text-sm font-medium">
            {item.credential ? "Replace API key" : "API key"}
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono outline-none focus:border-cyan-400"
              placeholder={details.keyPlaceholder}
            />
          </label>
          <ActionMessage actionData={actionData} scope={item.provider} />
          <button
            disabled={isSubmittingHere}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
            type="submit"
            name="intent"
            value="save-key"
          >
            {isSubmittingHere ? "Testing…" : "Test and save"}
          </button>
        </Form>
      </div>
    </section>
  );
}

export default function AiSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
        Bring your own key
      </p>
      <h1 className="mt-2 text-3xl font-semibold">AI settings</h1>
      <p className="mt-3 text-slate-400">
        Choose which provider reads job descriptions and rewrites your resume.
        Keys are encrypted before storage, used only for your requests, and
        never shown again after saving.
      </p>

      <section
        aria-labelledby="provider-heading"
        className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <h2 id="provider-heading" className="text-xl font-semibold">
          Provider
        </h2>
        <Form method="post" className="mt-5 space-y-4">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">AI provider</legend>
            {loaderData.providers.map((item) => (
              <label
                key={item.provider}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 has-[:checked]:border-cyan-400"
              >
                <input
                  type="radio"
                  name="provider"
                  value={item.provider}
                  defaultChecked={
                    item.provider === loaderData.preferredProvider
                  }
                  className="size-4 accent-cyan-400"
                />
                <span>
                  <span className="block font-medium">
                    {aiProviderDetails[item.provider].label}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {item.credential
                      ? "Personal key saved"
                      : item.hasPlatformKey
                        ? "Platform key available"
                        : "Needs a key"}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <ActionMessage actionData={actionData} scope="preference" />
          <button
            type="submit"
            name="intent"
            value="set-provider"
            className="rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-950 hover:bg-white"
          >
            Save provider
          </button>
        </Form>
      </section>

      <div className="mt-8 space-y-8">
        {loaderData.providers.map((item) => (
          <ProviderKeyCard
            key={item.provider}
            item={item}
            isPreferred={item.provider === loaderData.preferredProvider}
            actionData={actionData}
          />
        ))}
      </div>
    </main>
  );
}
