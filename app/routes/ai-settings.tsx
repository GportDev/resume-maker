import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Field, fieldClass } from "../components/ui/field";
import { PageHeader, Sheet, SheetSection } from "../components/ui/sheet";
import { Stamp } from "../components/ui/stamp";
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
      <p role="alert" className="text-sm text-danger">
        {actionData.error}
      </p>
    );
  }
  return (
    <p role="status" className="fade-in text-sm text-ok">
      {actionData.success}
    </p>
  );
}

type ProviderItem = Route.ComponentProps["loaderData"]["providers"][number];

const testedFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function keySource(item: ProviderItem) {
  if (item.credential) return `your key ${item.credential.masked}`;
  if (item.hasPlatformKey) return "the platform key";
  return null;
}

function ProviderKeySection({
  item,
  isPreferred,
  actionData,
}: {
  item: ProviderItem;
  isPreferred: boolean;
  actionData: Route.ComponentProps["actionData"];
}) {
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const details = aiProviderDetails[item.provider];
  const [showKey, setShowKey] = useState(false);
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
    <SheetSection
      id={`${item.provider}-heading`}
      title={
        <span className="flex items-center gap-2">
          {details.label}
          {isPreferred ? <Stamp tone="exhibit">In use</Stamp> : null}
        </span>
      }
    >
      <div className="max-w-2xl space-y-4">
        {item.credential ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-rule bg-field px-4 py-3">
            <div className="text-sm">
              <p className="flex items-center gap-2 font-medium">
                <KeyRound aria-hidden="true" className="size-4 text-ok" />
                Personal key{" "}
                <span className="font-mono text-ink-2">
                  {item.credential.masked}
                </span>
              </p>
              {item.credential.testedAt ? (
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  Tested{" "}
                  {testedFormat.format(new Date(item.credential.testedAt))} UTC
                </p>
              ) : null}
            </div>
            <ConfirmDialog
              triggerLabel="Revoke key"
              title={`Revoke your ${details.label} key?`}
              description={
                item.hasPlatformKey
                  ? "The encrypted key is deleted. Requests fall back to the platform key."
                  : "The encrypted key is deleted. Analysis with this provider stops until you add a key."
              }
              confirmLabel="Revoke key"
              fields={{ intent: "revoke-key", provider: item.provider }}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            {item.hasPlatformKey
              ? "No personal key saved. The platform key is used."
              : "No personal key saved and no platform key configured."}
          </p>
        )}

        <Form ref={formRef} method="post" className="space-y-3">
          <input type="hidden" name="provider" value={item.provider} />
          <Field
            id={`${item.provider}-key`}
            label={item.credential ? "Replace API key" : "API key"}
            hint="Tested with the provider before saving. Stored encrypted; never shown again."
          >
            <div className="relative">
              <input
                id={`${item.provider}-key`}
                name="apiKey"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                required
                aria-describedby={`${item.provider}-key-hint`}
                className={`${fieldClass} pr-11 font-mono text-sm`}
                placeholder={details.keyPlaceholder}
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                aria-label={showKey ? "Hide key" : "Show key"}
                aria-pressed={showKey}
                className="absolute inset-y-0 right-1 my-auto grid size-8 place-items-center rounded-[4px] text-ink-3 hover:bg-sheet-sunk hover:text-ink"
              >
                {showKey ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              name="intent"
              value="save-key"
              variant="primary"
              pending={isSubmittingHere}
            >
              {isSubmittingHere ? "Testing…" : "Test and save"}
            </Button>
            <ActionMessage actionData={actionData} scope={item.provider} />
          </div>
        </Form>
      </div>
    </SheetSection>
  );
}

export default function AiSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const preferred = loaderData.providers.find(
    (item) => item.provider === loaderData.preferredProvider,
  );
  const source = preferred ? keySource(preferred) : null;
  const preferredLabel = aiProviderDetails[loaderData.preferredProvider].label;

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 pb-10 sm:px-6">
      <Sheet className="rounded-t-none">
        <PageHeader
          title="AI settings"
          meta={
            source ? (
              <span>
                Using {preferredLabel} with {source}.
              </span>
            ) : (
              <span className="text-warn">
                {preferredLabel} has no key. Add one below before analyzing a
                job.
              </span>
            )
          }
        />
        <SheetSection
          title="Provider"
          id="provider-heading"
          description="Which provider reads job descriptions and rewrites your evidence. Keys are encrypted and used only for your requests."
        >
          <Form method="post" className="max-w-2xl space-y-4">
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">AI provider</legend>
              {loaderData.providers.map((item) => (
                <label
                  key={item.provider}
                  className="flex cursor-pointer items-center gap-3 rounded-control border border-rule-strong bg-field p-3.5 has-[:checked]:border-exhibit has-[:checked]:bg-exhibit-tint/40"
                >
                  <input
                    type="radio"
                    name="provider"
                    value={item.provider}
                    defaultChecked={
                      item.provider === loaderData.preferredProvider
                    }
                    className="size-4 accent-exhibit"
                  />
                  <span>
                    <span className="block font-medium">
                      {aiProviderDetails[item.provider].label}
                    </span>
                    <span className="block text-[0.8125rem] text-ink-3">
                      {item.credential
                        ? `Personal key ${item.credential.masked}`
                        : item.hasPlatformKey
                          ? "Platform key available"
                          : "Needs a key"}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" name="intent" value="set-provider">
                Save provider
              </Button>
              <ActionMessage actionData={actionData} scope="preference" />
            </div>
          </Form>
        </SheetSection>

        {loaderData.providers.map((item) => (
          <ProviderKeySection
            key={item.provider}
            item={item}
            isPreferred={item.provider === loaderData.preferredProvider}
            actionData={actionData}
          />
        ))}
      </Sheet>
    </main>
  );
}
