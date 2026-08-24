/**
 * Zero-knowledge client-side crypto for the password vault.
 *
 * Everything here runs in the browser (or in tests, under Node's built-in
 * Web Crypto). The derived key and any plaintext must never be sent to the
 * server — only ciphertext (`encryptedBlob`/`iv`) and the KDF salt leave
 * this module's callers.
 */

const PBKDF2_HASH = "SHA-256";
export const DEFAULT_KDF_ITERATIONS = 600_000;
const AES_ALGO = "AES-GCM";
const IV_BYTES = 12;

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }
  return c;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function generateSaltBase64(byteLength = 16): string {
  const crypto = getCrypto();
  const salt = new Uint8Array(byteLength);
  crypto.getRandomValues(salt);
  return bytesToBase64(salt);
}

/** Derives an AES-256-GCM key from the master password via PBKDF2-SHA256. */
export async function deriveVaultKey(
  masterPassword: string,
  saltBase64: string,
  iterations: number = DEFAULT_KDF_ITERATIONS,
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltBase64) as BufferSource,
      iterations,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: AES_ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type EncryptedPayload = { ciphertext: string; iv: string };

export async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<EncryptedPayload> {
  const crypto = getCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    key,
    enc.encode(plaintext),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptString(
  key: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string,
): Promise<string> {
  const crypto = getCrypto();
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: AES_ALGO, iv: base64ToBytes(ivBase64) as BufferSource },
    key,
    base64ToBytes(ciphertextBase64) as BufferSource,
  );
  return new TextDecoder().decode(plaintextBuf);
}

export async function encryptJSON<T>(
  key: CryptoKey,
  value: T,
): Promise<EncryptedPayload> {
  return encryptString(key, JSON.stringify(value));
}

export async function decryptJSON<T>(
  key: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string,
): Promise<T> {
  const json = await decryptString(key, ciphertextBase64, ivBase64);
  return JSON.parse(json) as T;
}

const VERIFIER_PLAINTEXT = "life-os-vault-verifier-v1";

/** A small known-plaintext blob used only to confirm the master password on unlock. */
export async function createVerifier(key: CryptoKey): Promise<EncryptedPayload> {
  return encryptString(key, VERIFIER_PLAINTEXT);
}

export async function checkVerifier(
  key: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string,
): Promise<boolean> {
  try {
    const decrypted = await decryptString(key, ciphertextBase64, ivBase64);
    return decrypted === VERIFIER_PLAINTEXT;
  } catch {
    // AES-GCM auth tag mismatch throws — wrong master password.
    return false;
  }
}

export type VaultEntrySecret = {
  username: string;
  password: string;
  notes: string;
};
