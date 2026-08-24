import wordlist from "@/data/diceware-wordlist.json";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/";
const AMBIGUOUS = "0O1lI|`'\"";

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error("Web Crypto API is not available in this environment.");
  }
  return c;
}

/** Uniform random index in [0, max) using crypto.getRandomValues (rejection
 *  sampling over the full 32-bit range, so this stays correct for any max —
 *  including the 1000+ word diceware list, not just small character pools). */
function randomIndex(max: number): number {
  const crypto = getCrypto();
  const range = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= range);
  return x % max;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[randomIndex(arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type PasswordOptions = {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
};

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
};

export function generatePassword(options: PasswordOptions): string {
  const { length, uppercase, lowercase, numbers, symbols, excludeAmbiguous } =
    options;
  const strip = (s: string) =>
    excludeAmbiguous
      ? s
          .split("")
          .filter((c) => !AMBIGUOUS.includes(c))
          .join("")
      : s;

  const pools: string[] = [];
  if (lowercase) pools.push(strip(LOWER));
  if (uppercase) pools.push(strip(UPPER));
  if (numbers) pools.push(strip(DIGITS));
  if (symbols) pools.push(strip(SYMBOLS));

  if (pools.length === 0 || length < 1) return "";

  // Guarantee at least one character from each selected pool, then fill the
  // rest from the combined pool, then shuffle so required chars aren't
  // predictably placed at the front.
  const combined = pools.join("");
  const chars: string[] = pools.map((pool) => pickRandom(pool.split("")));
  while (chars.length < length) {
    chars.push(pickRandom(combined.split("")));
  }
  return shuffle(chars).slice(0, length).join("");
}

export type PassphraseOptions = {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
};

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  wordCount: 6,
  separator: "-",
  capitalize: true,
  includeNumber: true,
};

export function generatePassphrase(options: PassphraseOptions): string {
  const words: string[] = [];
  for (let i = 0; i < options.wordCount; i++) {
    let word = pickRandom(wordlist as string[]);
    if (options.capitalize) {
      word = word[0].toUpperCase() + word.slice(1);
    }
    words.push(word);
  }
  if (options.includeNumber) {
    words[randomIndex(words.length)] += String(randomIndex(100));
  }
  return words.join(options.separator);
}

/** Shannon entropy estimate in bits, for the strength meter. */
export function estimatePasswordEntropyBits(
  password: string,
  poolSize: number,
): number {
  if (password.length === 0 || poolSize <= 1) return 0;
  return password.length * Math.log2(poolSize);
}

export function poolSizeForOptions(options: PasswordOptions): number {
  let size = 0;
  const strip = (s: string) =>
    options.excludeAmbiguous
      ? s
          .split("")
          .filter((c) => !AMBIGUOUS.includes(c))
          .join("")
      : s;
  if (options.lowercase) size += strip(LOWER).length;
  if (options.uppercase) size += strip(UPPER).length;
  if (options.numbers) size += strip(DIGITS).length;
  if (options.symbols) size += strip(SYMBOLS).length;
  return size;
}
