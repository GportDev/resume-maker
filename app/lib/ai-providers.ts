import { z } from "zod";

export const aiProviders = ["anthropic", "openai"] as const;

export const aiProviderSchema = z.enum(aiProviders);

export type AiProvider = z.infer<typeof aiProviderSchema>;

export const aiProviderDetails = {
  anthropic: { label: "Anthropic", keyPlaceholder: "sk-ant-..." },
  openai: { label: "OpenAI", keyPlaceholder: "sk-..." },
} as const satisfies Record<
  AiProvider,
  { label: string; keyPlaceholder: string }
>;
