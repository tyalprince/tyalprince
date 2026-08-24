import { Suspense } from "react";
import { VaultApp } from "@/components/vault/vault-app";

export default function PasswordsPage() {
  return (
    <Suspense>
      <VaultApp />
    </Suspense>
  );
}
