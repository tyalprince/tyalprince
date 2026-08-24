"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useVaultLock } from "./vault-lock-context";
import { VaultSetup } from "./vault-setup";
import { VaultUnlock } from "./vault-unlock";
import { VaultDashboard } from "./vault-dashboard";
import type { VaultSettingsRow } from "@/lib/vault/types";

export function VaultApp() {
  const { unlocked, vaultKey, unlock, lock } = useVaultLock();
  const [settings, setSettings] = useState<VaultSettingsRow | null | undefined>(
    undefined,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ settings: VaultSettingsRow | null }>("/api/vault/settings")
      .then((res) => setSettings(res.settings))
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load vault."),
      );
  }, []);

  if (loadError) {
    return <p className="p-6 text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  }

  if (settings === undefined) {
    return <p className="p-6 text-sm text-neutral-500">Loading vault...</p>;
  }

  if (settings === null) {
    return (
      <div className="p-4 sm:p-6">
        <VaultSetup
          onReady={(s, key) => {
            setSettings(s);
            unlock(key);
          }}
        />
      </div>
    );
  }

  if (!unlocked || !vaultKey) {
    return (
      <div className="p-4 sm:p-6">
        <VaultUnlock settings={settings} onUnlocked={unlock} />
      </div>
    );
  }

  return <VaultDashboard vaultKey={vaultKey} onLock={lock} />;
}
