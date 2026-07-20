import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { z } from "zod";

import { getServerEnv } from "./env.server";

export const encryptedCredentialSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  keyVersion: z.literal("v1"),
  lastFour: z.string().length(4),
});

export type EncryptedCredential = z.infer<typeof encryptedCredentialSchema>;

function decodeEncryptionKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }
  return key;
}

export function encryptCredential(
  plaintext: string,
  encodedKey: string,
): EncryptedCredential {
  const normalized = plaintext.trim();
  if (normalized.length < 20) {
    throw new Error("API key is too short.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    decodeEncryptionKey(encodedKey),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: "v1",
    lastFour: normalized.slice(-4),
  };
}

export function decryptCredential(
  credential: Pick<
    EncryptedCredential,
    "ciphertext" | "iv" | "authTag" | "keyVersion"
  >,
  encodedKey: string,
): string {
  if (credential.keyVersion !== "v1") {
    throw new Error("Unsupported credential key version.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      decodeEncryptionKey(encodedKey),
      Buffer.from(credential.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(credential.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(credential.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Stored API credential could not be decrypted.");
  }
}

export function encryptUserApiKey(apiKey: string): EncryptedCredential {
  return encryptCredential(apiKey, getServerEnv().CREDENTIAL_ENCRYPTION_KEY);
}

export function decryptUserApiKey(
  credential: Pick<
    EncryptedCredential,
    "ciphertext" | "iv" | "authTag" | "keyVersion"
  >,
): string {
  return decryptCredential(
    credential,
    getServerEnv().CREDENTIAL_ENCRYPTION_KEY,
  );
}

export function maskCredential(lastFour: string): string {
  return `••••••••${lastFour}`;
}
