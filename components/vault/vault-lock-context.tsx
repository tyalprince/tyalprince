"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AUTO_LOCK_MS = 10 * 60 * 1000; // 10 minutes idle
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

type Ctx = {
  unlocked: boolean;
  /** In-memory only — never persisted to storage. Null while locked. */
  vaultKey: CryptoKey | null;
  unlock: (key: CryptoKey) => void;
  lock: () => void;
};

const VaultLockContext = createContext<Ctx | null>(null);

export function VaultLockProvider({ children }: { children: React.ReactNode }) {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    setVaultKey(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const unlock = useCallback((key: CryptoKey) => {
    setVaultKey(key);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVaultKey(null);
    }, AUTO_LOCK_MS);
  }, []);

  useEffect(() => {
    if (!vaultKey) return;
    resetTimer();
    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handler));
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [vaultKey, resetTimer]);

  // Best-effort clear of the in-memory key on tab close — decrypted state
  // (and the derived key) must never be persisted to storage.
  useEffect(() => {
    const onUnload = () => setVaultKey(null);
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, []);

  return (
    <VaultLockContext.Provider
      value={{ unlocked: vaultKey !== null, vaultKey, unlock, lock }}
    >
      {children}
    </VaultLockContext.Provider>
  );
}

export function useVaultLock() {
  const ctx = useContext(VaultLockContext);
  if (!ctx) throw new Error("useVaultLock must be used within VaultLockProvider");
  return ctx;
}
