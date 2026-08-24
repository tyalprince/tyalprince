"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw, Check } from "lucide-react";
import {
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
  generatePassword,
  generatePassphrase,
  type PasswordOptions,
  type PassphraseOptions,
} from "@/lib/crypto/generator";
import { copyWithAutoClear } from "@/lib/clipboard";
import { StrengthMeter } from "./strength-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGeneratedPasswordStash } from "@/lib/context/generated-password-context";

type Mode = "password" | "passphrase";

export function GeneratorPanel({
  onUse,
  showSaveToVault = true,
}: {
  /** When provided, renders a "Use this password" button that calls back
   *  instead of navigating (for embedding inside the new-entry form). */
  onUse?: (password: string) => void;
  showSaveToVault?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("password");
  const [pwOptions, setPwOptions] = useState<PasswordOptions>(
    DEFAULT_PASSWORD_OPTIONS,
  );
  const [phraseOptions, setPhraseOptions] = useState<PassphraseOptions>(
    DEFAULT_PASSPHRASE_OPTIONS,
  );
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const stash = useGeneratedPasswordStash();

  const regenerate = useMemo(
    () => () => {
      setValue(
        mode === "password"
          ? generatePassword(pwOptions)
          : generatePassphrase(phraseOptions),
      );
      setCopied(false);
    },
    [mode, pwOptions, phraseOptions],
  );

  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pwOptions, phraseOptions]);

  async function handleCopy() {
    await copyWithAutoClear(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveToVault() {
    stash.stash(value);
    router.push("/passwords?new=1");
  }

  const atLeastOneCharType =
    pwOptions.lowercase || pwOptions.uppercase || pwOptions.numbers || pwOptions.symbols;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {(["password", "passphrase"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              mode === m
                ? "bg-white shadow-sm dark:bg-neutral-950"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          className="font-mono text-sm"
          aria-label="Generated value"
        />
        <Button variant="secondary" onClick={regenerate} aria-label="Regenerate">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="secondary" onClick={handleCopy} aria-label="Copy">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <StrengthMeter password={value} />

      {mode === "password" ? (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <label htmlFor="pw-length">Length</label>
              <span>{pwOptions.length}</span>
            </div>
            <input
              id="pw-length"
              type="range"
              min={8}
              max={64}
              value={pwOptions.length}
              onChange={(e) =>
                setPwOptions((o) => ({ ...o, length: Number(e.target.value) }))
              }
              className="w-full accent-neutral-900 dark:accent-neutral-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <ToggleRow
              label="Uppercase (A-Z)"
              checked={pwOptions.uppercase}
              onChange={(v) => setPwOptions((o) => ({ ...o, uppercase: v }))}
            />
            <ToggleRow
              label="Lowercase (a-z)"
              checked={pwOptions.lowercase}
              onChange={(v) => setPwOptions((o) => ({ ...o, lowercase: v }))}
            />
            <ToggleRow
              label="Numbers (0-9)"
              checked={pwOptions.numbers}
              onChange={(v) => setPwOptions((o) => ({ ...o, numbers: v }))}
            />
            <ToggleRow
              label="Symbols (!@#...)"
              checked={pwOptions.symbols}
              onChange={(v) => setPwOptions((o) => ({ ...o, symbols: v }))}
            />
          </div>
          <ToggleRow
            label="Exclude ambiguous characters (0/O, l/1)"
            checked={pwOptions.excludeAmbiguous}
            onChange={(v) => setPwOptions((o) => ({ ...o, excludeAmbiguous: v }))}
          />
          {!atLeastOneCharType && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Select at least one character type.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <label htmlFor="word-count">Words</label>
              <span>{phraseOptions.wordCount}</span>
            </div>
            <input
              id="word-count"
              type="range"
              min={3}
              max={10}
              value={phraseOptions.wordCount}
              onChange={(e) =>
                setPhraseOptions((o) => ({
                  ...o,
                  wordCount: Number(e.target.value),
                }))
              }
              className="w-full accent-neutral-900 dark:accent-neutral-100"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="separator" className="text-sm">
              Separator
            </label>
            <Input
              id="separator"
              value={phraseOptions.separator}
              maxLength={3}
              onChange={(e) =>
                setPhraseOptions((o) => ({ ...o, separator: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <ToggleRow
              label="Capitalize words"
              checked={phraseOptions.capitalize}
              onChange={(v) => setPhraseOptions((o) => ({ ...o, capitalize: v }))}
            />
            <ToggleRow
              label="Include a number"
              checked={phraseOptions.includeNumber}
              onChange={(v) =>
                setPhraseOptions((o) => ({ ...o, includeNumber: v }))
              }
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {onUse && (
          <Button className="flex-1" onClick={() => onUse(value)}>
            Use this password
          </Button>
        )}
        {showSaveToVault && !onUse && (
          <Button className="flex-1" onClick={handleSaveToVault}>
            Generate &amp; save to vault
          </Button>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
      />
      {label}
    </label>
  );
}
