import { describe, expect, it } from "vitest";
import {
  checkVerifier,
  createVerifier,
  decryptJSON,
  decryptString,
  deriveVaultKey,
  encryptJSON,
  encryptString,
  generateSaltBase64,
} from "@/lib/crypto/vault-crypto";

describe("vault-crypto", () => {
  it("round-trips a string through encrypt/decrypt with the same key", async () => {
    const salt = generateSaltBase64();
    const key = await deriveVaultKey("correct horse battery staple", salt, 100_000);

    const { ciphertext, iv } = await encryptString(key, "hello vault");
    const plaintext = await decryptString(key, ciphertext, iv);

    expect(plaintext).toBe("hello vault");
  });

  it("round-trips a JSON vault entry secret", async () => {
    const salt = generateSaltBase64();
    const key = await deriveVaultKey("master-password-123", salt, 100_000);

    const secret = { username: "alice", password: "S3cret!", notes: "test note" };
    const { ciphertext, iv } = await encryptJSON(key, secret);
    const decrypted = await decryptJSON<typeof secret>(key, ciphertext, iv);

    expect(decrypted).toEqual(secret);
  });

  it("fails to decrypt with the wrong key (auth tag mismatch)", async () => {
    const salt = generateSaltBase64();
    const key1 = await deriveVaultKey("password-one", salt, 100_000);
    const key2 = await deriveVaultKey("password-two", salt, 100_000);

    const { ciphertext, iv } = await encryptString(key1, "secret data");

    await expect(decryptString(key2, ciphertext, iv)).rejects.toThrow();
  });

  it("derives different keys for different salts from the same password", async () => {
    const password = "same-password";
    const saltA = generateSaltBase64();
    const saltB = generateSaltBase64();

    const keyA = await deriveVaultKey(password, saltA, 100_000);
    const keyB = await deriveVaultKey(password, saltB, 100_000);

    const { ciphertext, iv } = await encryptString(keyA, "payload");
    await expect(decryptString(keyB, ciphertext, iv)).rejects.toThrow();
  });

  it("verifier confirms the correct master password and rejects the wrong one", async () => {
    const salt = generateSaltBase64();
    const rightKey = await deriveVaultKey("right-password", salt, 100_000);
    const wrongKey = await deriveVaultKey("wrong-password", salt, 100_000);

    const verifier = await createVerifier(rightKey);

    await expect(
      checkVerifier(rightKey, verifier.ciphertext, verifier.iv),
    ).resolves.toBe(true);
    await expect(
      checkVerifier(wrongKey, verifier.ciphertext, verifier.iv),
    ).resolves.toBe(false);
  });

  it("never emits the plaintext password anywhere in the ciphertext/iv payload", async () => {
    const salt = generateSaltBase64();
    const key = await deriveVaultKey("master-pw", salt, 100_000);
    const plaintext = "hunter2-super-secret";

    const { ciphertext, iv } = await encryptString(key, plaintext);

    expect(ciphertext).not.toContain(plaintext);
    expect(iv).not.toContain(plaintext);
  });
});
