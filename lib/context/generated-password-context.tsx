"use client";

import { createContext, useContext, useRef } from "react";

type Ctx = {
  /** Stash a freshly generated password in memory (never localStorage) so
   *  the vault "new entry" form can pick it up after navigation. */
  stash: (password: string) => void;
  /** Read + clear the stashed password. Returns null if none pending. */
  consume: () => string | null;
};

const GeneratedPasswordContext = createContext<Ctx | null>(null);

export function GeneratedPasswordProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<string | null>(null);

  const value: Ctx = {
    stash: (password) => {
      ref.current = password;
    },
    consume: () => {
      const v = ref.current;
      ref.current = null;
      return v;
    },
  };

  return (
    <GeneratedPasswordContext.Provider value={value}>
      {children}
    </GeneratedPasswordContext.Provider>
  );
}

export function useGeneratedPasswordStash() {
  const ctx = useContext(GeneratedPasswordContext);
  if (!ctx) {
    throw new Error(
      "useGeneratedPasswordStash must be used within GeneratedPasswordProvider",
    );
  }
  return ctx;
}
