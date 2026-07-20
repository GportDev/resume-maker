import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decryptCredential,
  encryptCredential,
  maskCredential,
} from "../app/lib/credentials.server";

const encryptionKey = randomBytes(32).toString("base64");

describe("credential encryption", () => {
  it("round-trips an API key without storing plaintext", () => {
    const apiKey = "sk-test-abcdefghijklmnopqrstuvwxyz";
    const encrypted = encryptCredential(apiKey, encryptionKey);

    expect(encrypted.ciphertext).not.toContain(apiKey);
    expect(encrypted.lastFour).toBe("wxyz");
    expect(decryptCredential(encrypted, encryptionKey)).toBe(apiKey);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptCredential(
      "sk-test-abcdefghijklmnopqrstuvwxyz",
      encryptionKey,
    );

    expect(() =>
      decryptCredential(
        {
          ...encrypted,
          ciphertext: `${
            encrypted.ciphertext[0] === "A" ? "B" : "A"
          }${encrypted.ciphertext.slice(1)}`,
        },
        encryptionKey,
      ),
    ).toThrow("Stored API credential could not be decrypted.");
  });

  it("only reveals the credential suffix", () => {
    expect(maskCredential("wxyz")).toBe("••••••••wxyz");
  });
});
