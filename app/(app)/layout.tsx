import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Topbar } from "@/components/shell/topbar";
import { GeneratedPasswordProvider } from "@/lib/context/generated-password-context";
import { VaultLockProvider } from "@/components/vault/vault-lock-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <GeneratedPasswordProvider>
      <VaultLockProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar userLabel={session.user.email ?? session.user.name ?? "Account"} />
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
          </div>
          <BottomNav />
        </div>
      </VaultLockProvider>
    </GeneratedPasswordProvider>
  );
}
